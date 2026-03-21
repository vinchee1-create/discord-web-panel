/**
 * Мониторинг тегов роли Fraction Curator на фракционных серверах в заданных каналах.
 * Периодические напоминания в канал «ID Теги» основного сервера с пингом Fraction Role,
 * пока на исходное сообщение не ответит участник с ролью Fraction Curator.
 */

const FACTION_SCOPES = [
    { scope: 'ballas', label: 'The Ballas Gang' },
    { scope: 'vagos', label: 'Los Santos Vagos' },
    { scope: 'families', label: 'The Families' },
    { scope: 'bloods', label: 'The Bloods Gang' },
    { scope: 'marabunta', label: 'Marabunta Grande' }
];

/** Каналы под разделителем в настройках фракции (ID Curator Leader — роль, не канал). */
function channelKeysForScope(scope) {
    return [
        `${scope}_curators_news_channel_id`,
        `${scope}_player_requests_channel_id`,
        `${scope}_curators_questions_channel_id`,
        `${scope}_treasury_channel_id`
    ];
}

async function loadSettingsKeys(pool, keys) {
    if (!pool || !keys.length) return {};
    const { rows } = await pool.query('SELECT key, value FROM app_settings WHERE key = ANY($1::text[])', [keys]);
    const m = {};
    rows.forEach(r => { m[r.key] = r.value || ''; });
    return m;
}

async function loadFactionMonitorConfigs(pool) {
    const keys = FACTION_SCOPES.flatMap(({ scope }) => [
        `${scope}_guild_id`,
        `${scope}_fraction_curator_role_id`,
        `${scope}_fraction_role_id`,
        ...channelKeysForScope(scope)
    ]);
    const kv = await loadSettingsKeys(pool, keys);
    const out = [];
    for (const { scope, label } of FACTION_SCOPES) {
        const guildId = kv[`${scope}_guild_id`] || '';
        const fractionCuratorRoleId = kv[`${scope}_fraction_curator_role_id`] || '';
        const fractionRoleId = kv[`${scope}_fraction_role_id`] || '';
        const channels = channelKeysForScope(scope)
            .map(k => kv[k] || '')
            .filter(id => /^\d{5,30}$/.test(id));
        if (!guildId || !/^\d{5,30}$/.test(guildId)) continue;
        if (!fractionCuratorRoleId || !/^\d{5,30}$/.test(fractionCuratorRoleId)) continue;
        if (!channels.length) continue;
        out.push({
            scope,
            label,
            guildId,
            fractionCuratorRoleId,
            fractionRoleId: /^\d{5,30}$/.test(fractionRoleId) ? fractionRoleId : '',
            channelIds: new Set(channels)
        });
    }
    return out;
}

async function loadMainReminderSettings(pool) {
    const kv = await loadSettingsKeys(pool, ['main_guild_id', 'main_tags_id', 'main_period_minutes']);
    const guildId = kv.main_guild_id || '';
    const tagsChannelId = kv.main_tags_id || '';
    let periodMinutes = parseInt(kv.main_period_minutes, 10);
    if (Number.isNaN(periodMinutes) || periodMinutes < 1) periodMinutes = 30;
    if (periodMinutes > 10080) periodMinutes = 10080;
    return {
        guildId: /^\d{5,30}$/.test(guildId) ? guildId : '',
        tagsChannelId: /^\d{5,30}$/.test(tagsChannelId) ? tagsChannelId : '',
        periodMinutes
    };
}

function findConfigForMessage(configs, guildId, channelId) {
    for (const c of configs) {
        if (c.guildId !== guildId) continue;
        if (c.channelIds.has(channelId)) return c;
    }
    return null;
}

async function insertWatch(pool, row) {
    await pool.query(
        `INSERT INTO curator_tag_watches (
           faction_scope, source_guild_id, source_channel_id, source_message_id,
           fraction_curator_role_id, reminders_sent, started_at
         ) VALUES ($1, $2, $3, $4, $5, 0, NOW())
         ON CONFLICT (source_guild_id, source_channel_id, source_message_id) DO NOTHING`,
        [
            row.factionScope,
            row.sourceGuildId,
            row.sourceChannelId,
            row.sourceMessageId,
            row.fractionCuratorRoleId
        ]
    );
}

async function resolveWatch(pool, guildId, channelId, parentMessageId) {
    await pool.query(
        `UPDATE curator_tag_watches SET resolved_at = NOW()
         WHERE source_guild_id = $1 AND source_channel_id = $2 AND source_message_id = $3 AND resolved_at IS NULL`,
        [guildId, channelId, parentMessageId]
    );
}

async function fetchActiveWatches(pool) {
    const { rows } = await pool.query(
        `SELECT id, faction_scope, source_guild_id, source_channel_id, source_message_id,
                fraction_curator_role_id, reminders_sent, started_at
         FROM curator_tag_watches WHERE resolved_at IS NULL`
    );
    return rows;
}

async function bumpReminder(pool, id) {
    await pool.query(
        `UPDATE curator_tag_watches
         SET reminders_sent = reminders_sent + 1, last_reminder_at = NOW()
         WHERE id = $1`,
        [id]
    );
}

module.exports = function registerCuratorTagWatch(client, pool) {
    if (!pool) {
        console.warn('⚠️ curatorTagWatch: pool отсутствует, мониторинг тегов отключён');
        return;
    }

    let tickRunning = false;
    let configCache = { list: null, at: 0 };
    const CONFIG_TTL_MS = 30_000;

    async function getFactionConfigsCached() {
        const now = Date.now();
        if (configCache.list && now - configCache.at < CONFIG_TTL_MS) return configCache.list;
        const list = await loadFactionMonitorConfigs(pool);
        configCache = { list, at: now };
        return list;
    }

    async function processReminders() {
        if (tickRunning) return;
        tickRunning = true;
        try {
            const main = await loadMainReminderSettings(pool);
            if (!main.guildId || !main.tagsChannelId) return;

            const mainGuild = client.guilds.cache.get(main.guildId);
            if (!mainGuild) return;
            const tagsChannel = await mainGuild.channels.fetch(main.tagsChannelId).catch(() => null);
            if (!tagsChannel || !tagsChannel.isTextBased()) return;

            const configs = await getFactionConfigsCached();
            const cfgByScope = new Map(configs.map(c => [c.scope, c]));

            const watches = await fetchActiveWatches(pool);
            const now = Date.now();

            for (const w of watches) {
                const cfg = cfgByScope.get(w.faction_scope);
                if (!cfg || !cfg.fractionRoleId) continue;

                const started = new Date(w.started_at).getTime();
                const elapsedMin = Math.floor((now - started) / 60000);
                const sent = Number(w.reminders_sent) || 0;
                const need = sent + 1;
                if (elapsedMin < need * main.periodMinutes) continue;

                const msgLink = `https://discord.com/channels/${w.source_guild_id}/${w.source_channel_id}/${w.source_message_id}`;
                const rolePing = `<@&${cfg.fractionRoleId}>`;
                const text = `${rolePing} **${cfg.label}** — тег роли куратора фракции без ответа уже **${elapsedMin}** мин. [Исходное сообщение](${msgLink})`;

                try {
                    await tagsChannel.send({
                        content: text,
                        allowedMentions: { roles: [cfg.fractionRoleId] }
                    });
                    await bumpReminder(pool, w.id);
                } catch (e) {
                    console.error('curatorTagWatch reminder send:', e.message);
                }
            }
        } catch (e) {
            console.error('curatorTagWatch processReminders:', e.message);
        } finally {
            tickRunning = false;
        }
    }

    client.on('messageCreate', async (message) => {
        try {
            if (!pool || message.author?.bot) return;
            const guildId = message.guildId || message.guild?.id;
            if (!guildId) return;
            const channelId = message.channel?.id;
            if (!channelId) return;

            const configs = await getFactionConfigsCached();
            const cfg = findConfigForMessage(configs, guildId, channelId);
            if (cfg && message.mentions?.roles?.has(cfg.fractionCuratorRoleId)) {
                await insertWatch(pool, {
                    factionScope: cfg.scope,
                    sourceGuildId: guildId,
                    sourceChannelId: channelId,
                    sourceMessageId: message.id,
                    fractionCuratorRoleId: cfg.fractionCuratorRoleId
                });
                return;
            }

            const refId = message.reference?.messageId;
            if (!refId || !message.reference?.channelId) return;
            const refChannelId = message.reference.channelId;
            const refGuildId = message.guild?.id;
            if (!refGuildId || refGuildId !== guildId) return;

            const cfgReply = findConfigForMessage(configs, guildId, refChannelId);
            if (!cfgReply) return;

            const member = message.member || (await message.guild.members.fetch(message.author.id).catch(() => null));
            if (!member || !member.roles.cache.has(cfgReply.fractionCuratorRoleId)) return;

            await resolveWatch(pool, refGuildId, refChannelId, refId);
        } catch (e) {
            console.error('curatorTagWatch messageCreate:', e.message);
        }
    });

    setInterval(() => {
        processReminders().catch(() => {});
    }, 60_000);
    setTimeout(() => processReminders().catch(() => {}), 15_000);

    console.log('✅ Мониторинг тегов Fraction Curator (напоминания в канал «Теги») включён');
};
