/**
 * Мониторинг тегов роли Fraction Curator на фракционных серверах.
 * — Вопросы кураторам, Curator Leader: закрытие ответом (reply) куратора.
 * — Запросы от игроков, Казна: закрытие реакцией куратора на исходное сообщение.
 * — Новости кураторов: мониторинг тегов отключён.
 */

const FACTION_SCOPES = [
    { scope: 'ballas', label: 'The Ballas Gang' },
    { scope: 'vagos', label: 'Los Santos Vagos' },
    { scope: 'families', label: 'The Families' },
    { scope: 'bloods', label: 'The Bloods Gang' },
    { scope: 'marabunta', label: 'Marabunta Grande' }
];

function isSnowflake(v) {
    return typeof v === 'string' && /^\d{5,30}$/.test(v);
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
        `${scope}_curators_news_channel_id`,
        `${scope}_curator_leader_channel_id`,
        `${scope}_curator_leader_role_id`, // legacy: был ошибочно назван «role», значение — ID канала
        `${scope}_player_requests_channel_id`,
        `${scope}_curators_questions_channel_id`,
        `${scope}_treasury_channel_id`
    ]);
    const kv = await loadSettingsKeys(pool, keys);
    const out = [];
    for (const { scope, label } of FACTION_SCOPES) {
        const guildId = kv[`${scope}_guild_id`] || '';
        const fractionCuratorRoleId = kv[`${scope}_fraction_curator_role_id`] || '';
        const fractionRoleId = kv[`${scope}_fraction_role_id`] || '';
        const replyChannelIds = new Set();
        const reactionChannelIds = new Set();
        if (isSnowflake(kv[`${scope}_curators_questions_channel_id`])) {
            replyChannelIds.add(kv[`${scope}_curators_questions_channel_id`]);
        }
        const leaderCh = kv[`${scope}_curator_leader_channel_id`] || kv[`${scope}_curator_leader_role_id`] || '';
        if (isSnowflake(leaderCh)) {
            replyChannelIds.add(leaderCh);
        }
        if (isSnowflake(kv[`${scope}_player_requests_channel_id`])) {
            reactionChannelIds.add(kv[`${scope}_player_requests_channel_id`]);
        }
        if (isSnowflake(kv[`${scope}_treasury_channel_id`])) {
            reactionChannelIds.add(kv[`${scope}_treasury_channel_id`]);
        }
        if (!isSnowflake(guildId)) continue;
        if (!isSnowflake(fractionCuratorRoleId)) continue;
        if (replyChannelIds.size === 0 && reactionChannelIds.size === 0) continue;
        out.push({
            scope,
            label,
            guildId,
            fractionCuratorRoleId,
            fractionRoleId: isSnowflake(fractionRoleId) ? fractionRoleId : '',
            replyChannelIds,
            reactionChannelIds
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

/** @returns {{ cfg: object, closeMode: 'reply'|'reaction' } | null} */
function findChannelMatch(configs, guildId, channelId) {
    for (const c of configs) {
        if (c.guildId !== guildId) continue;
        if (c.replyChannelIds.has(channelId)) return { cfg: c, closeMode: 'reply' };
        if (c.reactionChannelIds.has(channelId)) return { cfg: c, closeMode: 'reaction' };
    }
    return null;
}

async function insertWatch(pool, row) {
    await pool.query(
        `INSERT INTO curator_tag_watches (
           faction_scope, source_guild_id, source_channel_id, source_message_id,
           fraction_curator_role_id, reminders_sent, started_at, close_mode
         ) VALUES ($1, $2, $3, $4, $5, 0, NOW(), $6)
         ON CONFLICT (source_guild_id, source_channel_id, source_message_id) DO NOTHING`,
        [
            row.factionScope,
            row.sourceGuildId,
            row.sourceChannelId,
            row.sourceMessageId,
            row.fractionCuratorRoleId,
            row.closeMode
        ]
    );
}

/** Закрывает слежение и возвращает id сообщений напоминаний в канале «Теги». closeMode: reply | reaction */
async function resolveWatchAndGetReminderMessageIds(pool, guildId, channelId, parentMessageId, closeMode) {
    const { rows } = await pool.query(
        `SELECT id, COALESCE(tags_reminder_message_ids, ARRAY[]::varchar(32)[]) AS mids
         FROM curator_tag_watches
         WHERE source_guild_id = $1 AND source_channel_id = $2 AND source_message_id = $3
               AND resolved_at IS NULL AND close_mode = $4`,
        [guildId, channelId, parentMessageId, closeMode]
    );
    if (!rows[0]) return [];
    const mids = rows[0].mids;
    await pool.query(
        `UPDATE curator_tag_watches SET resolved_at = NOW() WHERE id = $1`,
        [rows[0].id]
    );
    return Array.isArray(mids) ? mids.filter(Boolean) : [];
}

async function fetchActiveWatches(pool) {
    const { rows } = await pool.query(
        `SELECT id, faction_scope, source_guild_id, source_channel_id, source_message_id,
                fraction_curator_role_id, reminders_sent, started_at, tags_reminder_message_ids
         FROM curator_tag_watches WHERE resolved_at IS NULL`
    );
    return rows;
}

/** Одно актуальное напоминание в «Теги»: при обновлении заменяем массив целиком. */
async function bumpReminderSetTagMessages(pool, watchId, tagsMessageId) {
    await pool.query(
        `UPDATE curator_tag_watches
         SET reminders_sent = reminders_sent + 1,
             last_reminder_at = NOW(),
             tags_reminder_message_ids = ARRAY[$2::varchar(32)]
         WHERE id = $1`,
        [watchId, tagsMessageId]
    );
}

/** Есть ли на сообщении реакция ✅ (напоминание уже отмечено). */
async function messageHasCheckReaction(msg) {
    if (!msg) return false;
    try {
        await msg.reactions.fetch().catch(() => {});
        const r = msg.reactions.cache.find(
            x => x.emoji.name === '✅' || x.emoji.identifier === '✅'
        );
        return Boolean(r && r.count > 0);
    } catch (_) {
        return false;
    }
}

/** Удаляет прошлые напоминания в «Теги», если на них ещё нет ✅. */
async function deletePreviousTagRemindersWithoutCheck(tagsChannel, messageIds) {
    if (!messageIds?.length) return;
    for (const mid of messageIds) {
        try {
            const old = await tagsChannel.messages.fetch(String(mid)).catch(() => null);
            if (!old) continue;
            if (await messageHasCheckReaction(old)) continue;
            await old.delete().catch(() => {});
        } catch (_) { /* ignore */ }
    }
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

    async function addCheckmarkReactionsToTagMessages(mainGuildId, tagsChannelId, messageIds) {
        if (!messageIds?.length) return;
        const guild = client.guilds.cache.get(mainGuildId);
        if (!guild) return;
        const channel = await guild.channels.fetch(tagsChannelId).catch(() => null);
        if (!channel || !channel.isTextBased()) return;
        for (const mid of messageIds) {
            try {
                const msg = await channel.messages.fetch(String(mid)).catch(() => null);
                if (msg) await msg.react('✅').catch(() => {});
            } catch (e) {
                console.error('curatorTagWatch addCheckmarkReactions:', e.message);
            }
        }
    }

    async function finalizeResolvedWatch(guildId, channelId, sourceMessageId, closeMode) {
        const reminderMsgIds = await resolveWatchAndGetReminderMessageIds(
            pool,
            guildId,
            channelId,
            sourceMessageId,
            closeMode
        );
        const mainSet = await loadMainReminderSettings(pool);
        if (mainSet.guildId && mainSet.tagsChannelId && reminderMsgIds.length) {
            await addCheckmarkReactionsToTagMessages(
                mainSet.guildId,
                mainSet.tagsChannelId,
                reminderMsgIds
            );
        }
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
                const sentCount = Number(w.reminders_sent) || 0;
                const need = sentCount + 1;
                if (elapsedMin < need * main.periodMinutes) continue;

                const msgLink = `https://discord.com/channels/${w.source_guild_id}/${w.source_channel_id}/${w.source_message_id}`;
                const rolePing = `<@&${cfg.fractionRoleId}>`;
                const text = `${rolePing} **${cfg.label}** — тег роли куратора фракции без ответа уже **${elapsedMin}** мин. [Исходное сообщение](${msgLink})`;

                try {
                    const prevIds = Array.isArray(w.tags_reminder_message_ids)
                        ? w.tags_reminder_message_ids.filter(Boolean)
                        : [];
                    await deletePreviousTagRemindersWithoutCheck(tagsChannel, prevIds);

                    const reminderMsg = await tagsChannel.send({
                        content: text,
                        allowedMentions: { roles: [cfg.fractionRoleId] }
                    });
                    await bumpReminderSetTagMessages(pool, w.id, reminderMsg.id);
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
            const match = findChannelMatch(configs, guildId, channelId);
            if (match && message.mentions?.roles?.has(match.cfg.fractionCuratorRoleId)) {
                await insertWatch(pool, {
                    factionScope: match.cfg.scope,
                    sourceGuildId: guildId,
                    sourceChannelId: channelId,
                    sourceMessageId: message.id,
                    fractionCuratorRoleId: match.cfg.fractionCuratorRoleId,
                    closeMode: match.closeMode
                });
                return;
            }

            const refId = message.reference?.messageId;
            if (!refId || !message.reference?.channelId) return;
            const refChannelId = message.reference.channelId;
            const refGuildId = message.guild?.id;
            if (!refGuildId || refGuildId !== guildId) return;

            const replyMatch = findChannelMatch(configs, guildId, refChannelId);
            if (!replyMatch || replyMatch.closeMode !== 'reply') return;

            const member = message.member || (await message.guild.members.fetch(message.author.id).catch(() => null));
            if (!member || !member.roles.cache.has(replyMatch.cfg.fractionCuratorRoleId)) return;

            await finalizeResolvedWatch(refGuildId, refChannelId, refId, 'reply');
        } catch (e) {
            console.error('curatorTagWatch messageCreate:', e.message);
        }
    });

    client.on('messageReactionAdd', async (reaction, user) => {
        try {
            if (!pool || user.bot) return;
            if (reaction.partial) await reaction.fetch().catch(() => {});
            let msg = reaction.message;
            if (!msg) return;
            if (msg.partial) {
                try {
                    msg = await msg.fetch();
                } catch (_) {
                    return;
                }
            }
            const guild = msg.guild;
            if (!guild) return;
            const channelId = msg.channelId || msg.channel?.id;
            if (!channelId) return;

            const configs = await getFactionConfigsCached();
            const rMatch = findChannelMatch(configs, guild.id, channelId);
            if (!rMatch || rMatch.closeMode !== 'reaction') return;

            const member = await guild.members.fetch(user.id).catch(() => null);
            if (!member || !member.roles.cache.has(rMatch.cfg.fractionCuratorRoleId)) return;

            await finalizeResolvedWatch(guild.id, channelId, msg.id, 'reaction');
        } catch (e) {
            console.error('curatorTagWatch messageReactionAdd:', e.message);
        }
    });

    setInterval(() => {
        processReminders().catch(() => {});
    }, 60_000);
    setTimeout(() => processReminders().catch(() => {}), 15_000);

    console.log('✅ Мониторинг тегов Fraction Curator: reply / реакция по типу канала; новости без мониторинга');
};
