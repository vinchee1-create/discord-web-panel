require('dotenv').config();
const express = require('express');
const { Client, GatewayIntentBits } = require('discord.js');
const path = require('path');
const { Pool } = require('pg');
const session = require('express-session');
const PgSession = require('connect-pg-simple')(session);
const bcrypt = require('bcryptjs');
const registerCuratorTagWatch = require('./curatorTagWatch');

const app = express();

// --- 1. НАСТРОЙКИ СЕРВЕРА ---
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// PostgreSQL (Railway): переменная DATABASE_URL или POSTGRES_URL
const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;
const pool = connectionString
    ? new Pool({
        connectionString,
        ssl: { rejectUnauthorized: false },
        connectionTimeoutMillis: 5000,
        idleTimeoutMillis: 10000
    })
    : null;

if (!pool) {
    console.warn('⚠️ DATABASE_URL/POSTGRES_URL не задан — авторизация и БД-функции работать не будут');
}

const ROLE_LEVELS = {
    Curator: 1,
    Senior: 2,
    Chief: 3,
    Admin: 4
};

app.use(session({
    store: pool ? new PgSession({ pool, tableName: 'session', createTableIfMissing: true }) : undefined,
    secret: process.env.SESSION_SECRET || 'dev-secret-change-me',
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        sameSite: 'lax'
    }
}));

function requireAuth(req, res, next) {
    if (!(req.session && req.session.user)) return res.redirect('/login');
    return next();
}

async function requireAuthStrict(req, res, next) {
    if (!(req.session && req.session.user)) return res.redirect('/login');
    if (!pool) return res.redirect('/login');
    try {
        const id = req.session.user.id;
        const { rows } = await pool.query('SELECT id FROM users WHERE id=$1', [id]);
        if (!rows[0]) {
            req.session.destroy(() => res.redirect('/login'));
            return;
        }
        return next();
    } catch (e) {
        console.error('requireAuthStrict:', e.message);
        return res.redirect('/login');
    }
}

function requireRole(minRoleName) {
    const min = ROLE_LEVELS[minRoleName] ?? 999;
    return (req, res, next) => {
        const lvl = req.session?.user?.role_level ?? 0;
        if (lvl >= min) return next();
        return res.status(403).send('Forbidden');
    };
}

async function initUsersTable() {
    if (!pool) return;
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                username VARCHAR(64) UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                role_name VARCHAR(16) NOT NULL,
                role_level INTEGER NOT NULL,
                created_at TIMESTAMP DEFAULT NOW()
            )
        `);
        const { rows } = await pool.query('SELECT COUNT(*)::int AS count FROM users');
        if (rows[0].count === 0) {
            const adminUser = process.env.ADMIN_USERNAME || 'admin';
            const adminPass = process.env.ADMIN_PASSWORD;
            if (!adminPass) {
                console.warn('⚠️ ADMIN_PASSWORD не задан — админ пользователь не создан');
                return;
            }
            const hash = await bcrypt.hash(adminPass, 10);
            await pool.query(
                'INSERT INTO users (username, password_hash, role_name, role_level) VALUES ($1, $2, $3, $4)',
                [adminUser, hash, 'Admin', ROLE_LEVELS.Admin]
            );
            console.log('✅ Создан admin пользователь:', adminUser);
        } else {
            console.log('✅ Таблица users готова');
        }
    } catch (e) {
        console.error('❌ Ошибка users:', e.message);
    }
}

async function initFamiliesTable() {
    if (!pool) return;
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS families (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                family_id VARCHAR(64) NOT NULL,
                leader VARCHAR(255),
                discord VARCHAR(64)
            )
        `);
        console.log('✅ Таблица families готова');
    } catch (e) {
        console.error('❌ Ошибка создания таблицы families:', e.message);
    }
}

async function initLeadersTable() {
    if (!pool) return;
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS leaders (
                id SERIAL PRIMARY KEY,
                display_id INTEGER NOT NULL,
                faction VARCHAR(255) NOT NULL,
                leader VARCHAR(255),
                static_id VARCHAR(64),
                term VARCHAR(64),
                time DATE,
                flagged BOOLEAN DEFAULT FALSE
            )
        `);
        const { rows } = await pool.query('SELECT COUNT(*)::int AS count FROM leaders');
        if (rows[0].count === 0) {
            await pool.query(
                `INSERT INTO leaders (display_id, faction) VALUES 
                 (8, 'The Ballas Gang'),
                 (9, 'Los Santos Vagos'),
                 (10, 'The Families'),
                 (11, 'The Bloods Gang'),
                 (12, 'Marabunta Grande')`
            );
            console.log('✅ Таблица leaders инициализирована начальными данными');
        } else {
            console.log('✅ Таблица leaders готова');
        }
    } catch (e) {
        console.error('❌ Ошибка создания/инициализации таблицы leaders:', e.message);
    }
}

async function initFamilyMaterialsTable() {
    if (!pool) return;
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS family_materials (
                id SERIAL PRIMARY KEY,
                title TEXT,
                content TEXT,
                issued BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT NOW()
            )
        `);
        // дополнительные поля для связи с семьями и описания ресурсов
        await pool.query(`ALTER TABLE family_materials ADD COLUMN IF NOT EXISTS family_name TEXT`);
        await pool.query(`ALTER TABLE family_materials ADD COLUMN IF NOT EXISTS resources TEXT`);
        console.log('✅ Таблица family_materials готова');
    } catch (e) {
        console.error('❌ Ошибка создания таблицы family_materials:', e.message);
    }
}

async function initFactionMaterialsTable() {
    if (!pool) return;
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS faction_materials (
                id SERIAL PRIMARY KEY,
                title TEXT,
                content TEXT,
                issued BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT NOW()
            )
        `);
        await pool.query(`ALTER TABLE faction_materials ADD COLUMN IF NOT EXISTS faction_name TEXT`);
        await pool.query(`ALTER TABLE faction_materials ADD COLUMN IF NOT EXISTS resources TEXT`);
        console.log('✅ Таблица faction_materials готова');
    } catch (e) {
        console.error('❌ Ошибка создания таблицы faction_materials:', e.message);
    }
}

async function initEventsTable() {
    if (!pool) return;
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS events (
                id SERIAL PRIMARY KEY,
                event_date DATE NOT NULL,
                title TEXT NOT NULL,
                description TEXT,
                created_by INTEGER,
                created_at TIMESTAMP DEFAULT NOW()
            )
        `);
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_events_event_date ON events(event_date)`);
        await pool.query(`ALTER TABLE events ADD COLUMN IF NOT EXISTS source_system_key VARCHAR(8)`);
        await pool.query(`
            CREATE UNIQUE INDEX IF NOT EXISTS idx_events_date_source_system
            ON events (event_date, source_system_key)
            WHERE source_system_key IS NOT NULL
        `);
        await pool.query(`
            CREATE TABLE IF NOT EXISTS suppressed_system_events (
                event_date DATE NOT NULL,
                system_key VARCHAR(8) NOT NULL,
                PRIMARY KEY (event_date, system_key)
            )
        `);
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_suppressed_system_date ON suppressed_system_events (event_date)`);
        console.log('✅ Таблица events готова');
    } catch (e) {
        console.error('❌ Ошибка создания таблицы events:', e.message);
    }
}

const EVENT_FE_COLOURS = new Set([
    'red', 'white', 'blue', 'purple', 'green', 'brown', 'cyan', 'orange',
    'beige', 'gray', 'yellow', 'pink', 'black', 'rgb'
]);

async function initEventDetailFamilyRowsTable() {
    if (!pool) return;
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS event_detail_family_rows (
                id SERIAL PRIMARY KEY,
                page_key VARCHAR(512) NOT NULL,
                sort_index INTEGER NOT NULL DEFAULT 0,
                family_ref_id INTEGER REFERENCES families(id) ON DELETE SET NULL,
                colour VARCHAR(32) NOT NULL DEFAULT 'white',
                died BOOLEAN NOT NULL DEFAULT FALSE,
                curator_name VARCHAR(255) NOT NULL DEFAULT '',
                l_flag BOOLEAN NOT NULL DEFAULT FALSE,
                w_flag BOOLEAN NOT NULL DEFAULT FALSE,
                is_spacer BOOLEAN NOT NULL DEFAULT FALSE,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            )
        `);
        await pool.query(
            `ALTER TABLE event_detail_family_rows ADD COLUMN IF NOT EXISTS is_spacer BOOLEAN NOT NULL DEFAULT FALSE`
        );
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_edfr_page_sort ON event_detail_family_rows (page_key, sort_index)`);
        console.log('✅ Таблица event_detail_family_rows готова');
    } catch (e) {
        console.error('❌ Ошибка event_detail_family_rows:', e.message);
    }
}

/** 5 фракций как на вкладке «Лидеры» (display_id 8–12) — состояние строк ВЗМ на странице мероприятия */
const STATIC_EVENT_DETAIL_FACTIONS = [
    { displayId: 8, name: 'The Ballas Gang' },
    { displayId: 9, name: 'Los Santos Vagos' },
    { displayId: 10, name: 'The Families' },
    { displayId: 11, name: 'The Bloods Gang' },
    { displayId: 12, name: 'Marabunta Grande' }
];

async function initEventDetailFactionRowsTable() {
    if (!pool) return;
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS event_detail_faction_rows (
                id SERIAL PRIMARY KEY,
                page_key VARCHAR(512) NOT NULL,
                faction_display_id INTEGER NOT NULL CHECK (faction_display_id >= 8 AND faction_display_id <= 12),
                present BOOLEAN NOT NULL DEFAULT FALSE,
                curator_name VARCHAR(255) NOT NULL DEFAULT '',
                w_flag BOOLEAN NOT NULL DEFAULT FALSE,
                l_flag BOOLEAN NOT NULL DEFAULT FALSE,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                UNIQUE (page_key, faction_display_id)
            )
        `);
        await pool.query(
            `CREATE INDEX IF NOT EXISTS idx_edfar_page ON event_detail_faction_rows (page_key)`
        );
        console.log('✅ Таблица event_detail_faction_rows готова');
    } catch (e) {
        console.error('❌ Ошибка event_detail_faction_rows:', e.message);
    }
}

async function initAccountsTable() {
    if (!pool) return;
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS accounts (
                id SERIAL PRIMARY KEY,
                nickname VARCHAR(255) NOT NULL,
                lvl INTEGER,
                server VARCHAR(64),
                login VARCHAR(255),
                password VARCHAR(255),
                created_at TIMESTAMP DEFAULT NOW()
            )
        `);
        console.log('✅ Таблица accounts готова');
    } catch (e) {
        console.error('❌ Ошибка accounts:', e.message);
    }
}

async function initAppSettingsTable() {
    if (!pool) return;
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS app_settings (
                key VARCHAR(128) PRIMARY KEY,
                value TEXT NOT NULL,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            )
        `);
        console.log('✅ Таблица app_settings готова');
    } catch (e) {
        console.error('❌ Ошибка app_settings:', e.message);
    }
}

async function initCuratorMetaTable() {
    if (!pool) return;
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS curator_meta (
                discord_id VARCHAR(32) PRIMARY KEY,
                nickname_override VARCHAR(128),
                lvl VARCHAR(64) DEFAULT '',
                curate TEXT DEFAULT '',
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            )
        `);
        console.log('✅ Таблица curator_meta готова');
    } catch (e) {
        console.error('❌ Ошибка curator_meta:', e.message);
    }
}

async function initCuratorTagWatchesTable() {
    if (!pool) return;
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS curator_tag_watches (
                id SERIAL PRIMARY KEY,
                faction_scope VARCHAR(32) NOT NULL,
                source_guild_id VARCHAR(32) NOT NULL,
                source_channel_id VARCHAR(32) NOT NULL,
                source_message_id VARCHAR(32) NOT NULL,
                fraction_curator_role_id VARCHAR(32) NOT NULL,
                reminders_sent INTEGER NOT NULL DEFAULT 0,
                started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                last_reminder_at TIMESTAMPTZ,
                resolved_at TIMESTAMPTZ,
                UNIQUE(source_guild_id, source_channel_id, source_message_id)
            )
        `);
        console.log('✅ Таблица curator_tag_watches готова');
    } catch (e) {
        console.error('❌ Ошибка curator_tag_watches:', e.message);
    }
}

// --- 2. ИНИЦИАЛИЗАЦИЯ БОТА ---
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMembers
    ]
});

// --- 3. AUTH PAGES ---
app.get('/login', (req, res) => {
    if (req.session?.user) return res.redirect('/');
    res.render('login', { error: null });
});

app.post('/login', express.urlencoded({ extended: true }), async (req, res) => {
    if (!pool) return res.render('login', { error: 'База данных не настроена' });
    const { username, password } = req.body || {};
    if (!username || !password) return res.render('login', { error: 'Введите логин и пароль' });
    try {
        const { rows } = await pool.query('SELECT id, username, password_hash, role_name, role_level FROM users WHERE username=$1', [String(username)]);
        const u = rows[0];
        if (!u) return res.render('login', { error: 'Неверный логин или пароль' });
        const ok = await bcrypt.compare(String(password), u.password_hash);
        if (!ok) return res.render('login', { error: 'Неверный логин или пароль' });
        req.session.user = { id: u.id, username: u.username, role_name: u.role_name, role_level: u.role_level };
        res.redirect('/');
    } catch (e) {
        console.error('POST /login:', e.message);
        res.render('login', { error: 'Ошибка входа' });
    }
});

app.post('/logout', (req, res) => {
    req.session.destroy(() => res.redirect('/login'));
});

// --- 3.0. API USERS (ТОЛЬКО ADMIN) ---
app.get('/api/users', requireRole('Admin'), async (req, res) => {
    if (!pool) return res.json([]);
    try {
        const { rows } = await pool.query('SELECT id, username, role_name, role_level, created_at FROM users ORDER BY id');
        res.json(rows.map(u => ({
            dbId: u.id,
            username: u.username,
            roleName: u.role_name,
            roleLevel: u.role_level,
            createdAt: u.created_at
        })));
    } catch (e) {
        console.error('GET /api/users:', e.message);
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/users', requireRole('Admin'), async (req, res) => {
    if (!pool) return res.status(503).json({ error: 'Database not configured' });
    const { username, password, roleName } = req.body || {};
    const rn = String(roleName || '');
    const rl = ROLE_LEVELS[rn];
    if (!username || !password || !rl) return res.status(400).json({ error: 'username, password, roleName required' });
    try {
        const hash = await bcrypt.hash(String(password), 10);
        const { rows } = await pool.query(
            'INSERT INTO users (username, password_hash, role_name, role_level) VALUES ($1,$2,$3,$4) RETURNING id, username, role_name, role_level, created_at',
            [String(username), hash, rn, rl]
        );
        const u = rows[0];
        res.status(201).json({ dbId: u.id, username: u.username, roleName: u.role_name, roleLevel: u.role_level, createdAt: u.created_at });
    } catch (e) {
        console.error('POST /api/users:', e.message);
        res.status(500).json({ error: e.message });
    }
});

app.put('/api/users/:id', requireRole('Admin'), async (req, res) => {
    if (!pool) return res.status(503).json({ error: 'Database not configured' });
    const dbId = parseInt(req.params.id, 10);
    if (isNaN(dbId)) return res.status(400).json({ error: 'Invalid id' });
    const { password, roleName } = req.body || {};
    const rn = roleName ? String(roleName) : null;
    const rl = rn ? ROLE_LEVELS[rn] : null;
    try {
        if (rn && rl) {
            await pool.query('UPDATE users SET role_name=$1, role_level=$2 WHERE id=$3', [rn, rl, dbId]);
        }
        if (password) {
            const hash = await bcrypt.hash(String(password), 10);
            await pool.query('UPDATE users SET password_hash=$1 WHERE id=$2', [hash, dbId]);
        }
        res.json({ ok: true });
    } catch (e) {
        console.error('PUT /api/users:', e.message);
        res.status(500).json({ error: e.message });
    }
});

app.delete('/api/users/:id', requireRole('Admin'), async (req, res) => {
    if (!pool) return res.status(503).json({ error: 'Database not configured' });
    const dbId = parseInt(req.params.id, 10);
    if (isNaN(dbId)) return res.status(400).json({ error: 'Invalid id' });
    try {
        // revoke sessions for that user (connect-pg-simple stores sess JSON)
        await pool.query("DELETE FROM session WHERE (sess->'user'->>'id')::int = $1", [dbId]);
        await pool.query('DELETE FROM users WHERE id=$1', [dbId]);
        res.status(204).end();
    } catch (e) {
        console.error('DELETE /api/users:', e.message);
        res.status(500).json({ error: e.message });
    }
});

// --- 4. API СЕМЕЙ (БД Railway) ---
app.get('/api/families', async (req, res) => {
    if (!req.session?.user) return res.status(401).json({ error: 'Unauthorized' });
    if (!pool) return res.json([]);
    try {
        const { rows } = await pool.query('SELECT id, name, family_id, leader, discord FROM families ORDER BY id');
        res.json(rows.map(r => ({ dbId: r.id, name: r.name, id: r.family_id, leader: r.leader || '', discord: r.discord || '' })));
    } catch (e) {
        console.error('GET /api/families:', e.message);
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/families', async (req, res) => {
    if (!req.session?.user) return res.status(401).json({ error: 'Unauthorized' });
    if (!pool) return res.status(503).json({ error: 'Database not configured' });
    const { name, id: family_id, leader, discord } = req.body || {};
    if (!name || !family_id) return res.status(400).json({ error: 'name and id required' });
    try {
        // запрет дубликатов по имени или ID
        const dup = await pool.query(
            'SELECT 1 FROM families WHERE LOWER(name)=LOWER($1) OR LOWER(family_id)=LOWER($2) LIMIT 1',
            [name, String(family_id)]
        );
        if (dup.rows[0]) {
            return res.status(409).json({ error: 'Family with same name or ID already exists' });
        }
        const { rows } = await pool.query(
            'INSERT INTO families (name, family_id, leader, discord) VALUES ($1, $2, $3, $4) RETURNING id, name, family_id, leader, discord',
            [name, String(family_id), leader || null, discord || null]
        );
        const r = rows[0];
        res.status(201).json({ dbId: r.id, name: r.name, id: r.family_id, leader: r.leader || '', discord: r.discord || '' });
    } catch (e) {
        console.error('POST /api/families:', e.message);
        res.status(500).json({ error: e.message });
    }
});

app.put('/api/families/:id', async (req, res) => {
    if (!req.session?.user) return res.status(401).json({ error: 'Unauthorized' });
    if (!pool) return res.status(503).json({ error: 'Database not configured' });
    const dbId = parseInt(req.params.id, 10);
    if (isNaN(dbId)) return res.status(400).json({ error: 'Invalid id' });
    const { name, id: family_id, leader, discord } = req.body || {};
    if (!name || !family_id) return res.status(400).json({ error: 'name and id required' });
    try {
        // запрет дубликатов при изменении (исключая текущую запись)
        const dup = await pool.query(
            'SELECT 1 FROM families WHERE (LOWER(name)=LOWER($1) OR LOWER(family_id)=LOWER($2)) AND id<>$3 LIMIT 1',
            [name, String(family_id), dbId]
        );
        if (dup.rows[0]) {
            return res.status(409).json({ error: 'Family with same name or ID already exists' });
        }
        await pool.query(
            'UPDATE families SET name=$1, family_id=$2, leader=$3, discord=$4 WHERE id=$5',
            [name, String(family_id), leader || null, discord || null, dbId]
        );
        res.json({ dbId, name, id: family_id, leader: leader || '', discord: discord || '' });
    } catch (e) {
        console.error('PUT /api/families:', e.message);
        res.status(500).json({ error: e.message });
    }
});

app.delete('/api/families/:id', async (req, res) => {
    if (!req.session?.user) return res.status(401).json({ error: 'Unauthorized' });
    if (!pool) return res.status(503).json({ error: 'Database not configured' });
    const dbId = parseInt(req.params.id, 10);
    if (isNaN(dbId)) return res.status(400).json({ error: 'Invalid id' });
    try {
        await pool.query('DELETE FROM families WHERE id=$1', [dbId]);
        res.status(204).end();
    } catch (e) {
        console.error('DELETE /api/families:', e.message);
        res.status(500).json({ error: e.message });
    }
});

async function getMainCuratorGuildAndRole() {
    if (!pool) return { guildId: '', roleId: '' };
    const { rows } = await pool.query(
        "SELECT key, value FROM app_settings WHERE key IN ('main_guild_id', 'main_primary_role_id')"
    );
    const map = {};
    rows.forEach(r => { map[r.key] = r.value || ''; });
    let guildId = map.main_guild_id || '';
    if (!guildId && client.guilds.cache.size === 1) {
        guildId = client.guilds.cache.first().id;
    }
    return { guildId, roleId: map.main_primary_role_id || '' };
}

/**
 * Подгружает участников страницами (REST). Один вызов members.fetch() без опций
 * часто опирается на gateway-chunking и падает, если в портале Discord не включён Server Members Intent.
 */
async function fetchGuildMembersPaginated(guild) {
    let after;
    for (let page = 0; page < 500; page++) {
        const options = { limit: 1000 };
        if (after) options.after = after;
        const batch = await guild.members.fetch(options);
        if (batch.size === 0) return;
        if (batch.size < 1000) return;
        let maxId = '0';
        batch.forEach(m => {
            if (m.id > maxId) maxId = m.id;
        });
        after = maxId;
    }
}

const CURATORS_INTENT_WARNING = 'Не удалось загрузить полный список участников. Откройте Discord Developer Portal → ваше приложение → вкладка Bot → блок «Privileged Gateway Intents» и включите «SERVER MEMBERS INTENT», сохраните и перезапустите бота. Пока отображаются только участники из кэша бота (список может быть неполным).';

const CURATOR_FACTION_SCOPES = [
    { scope: 'ballas', label: 'The Ballas Gang' },
    { scope: 'vagos', label: 'Los Santos Vagos' },
    { scope: 'families', label: 'The Families' },
    { scope: 'bloods', label: 'The Bloods Gang' },
    { scope: 'marabunta', label: 'Marabunta Grande' }
];

/** ID Fraction Role из настроек каждой фракции; сами роли должны быть выданы на основном сервере. */
async function loadCuratorFractionRoleIdsFromSettings() {
    if (!pool) return [];
    const keys = CURATOR_FACTION_SCOPES.map(({ scope }) => `${scope}_fraction_role_id`);
    const { rows } = await pool.query('SELECT key, value FROM app_settings WHERE key = ANY($1::text[])', [keys]);
    const kv = {};
    rows.forEach(r => { kv[r.key] = r.value || ''; });
    return CURATOR_FACTION_SCOPES.map(({ scope, label }) => ({
        scope,
        label,
        roleId: kv[`${scope}_fraction_role_id`] || ''
    })).filter(b => b.roleId && /^\d{5,30}$/.test(b.roleId));
}

/** Проверка ролей у участника основного сервера (member уже с main guild). */
function curatorFactionsFromRolesOnMain(member, fractionRoles) {
    if (!fractionRoles.length) return [];
    const out = [];
    for (const fr of fractionRoles) {
        if (member.roles.cache.has(fr.roleId)) {
            out.push({ key: fr.scope, label: fr.label });
        }
    }
    return out.sort((a, b) => String(a.label).localeCompare(String(b.label), 'ru'));
}

// --- 4.0.1. API КУРАТОРОВ (участники с основной ролью на основном сервере) ---
app.get('/api/curators', async (req, res) => {
    if (!req.session?.user) return res.status(401).json({ error: 'Unauthorized' });
    if (!pool) {
        return res.json({
            curators: [],
            warning: 'База данных не настроена',
            guildConfigured: false,
            roleConfigured: false
        });
    }
    try {
        const { guildId, roleId } = await getMainCuratorGuildAndRole();
        if (!guildId || !roleId) {
            return res.json({
                curators: [],
                warning: 'Укажите основной сервер и «ID основной роли» в разделе «Настройки».',
                guildConfigured: Boolean(guildId),
                roleConfigured: Boolean(roleId)
            });
        }
        const guild = client.guilds.cache.get(guildId);
        if (!guild) {
            return res.json({
                curators: [],
                warning: 'Бот не на указанном сервере или сервер недоступен.',
                guildConfigured: true,
                roleConfigured: true
            });
        }
        let role = guild.roles.cache.get(roleId);
        if (!role) {
            role = await guild.roles.fetch(roleId).catch(() => null);
        }
        if (!role) {
            return res.json({
                curators: [],
                warning: 'Роль с указанным ID не найдена на сервере.',
                guildConfigured: true,
                roleConfigured: true
            });
        }
        let memberFetchWarning = null;
        try {
            await fetchGuildMembersPaginated(guild);
        } catch (fe) {
            console.error('GET /api/curators members paginated fetch:', fe.message, fe.code || '');
            memberFetchWarning = CURATORS_INTENT_WARNING;
        }
        const { rows: metaRows } = await pool.query(
            'SELECT discord_id, nickname_override, lvl, curate FROM curator_meta'
        );
        const meta = {};
        metaRows.forEach(r => {
            meta[r.discord_id] = {
                nickname_override: r.nickname_override || '',
                lvl: r.lvl || '',
                curate: r.curate || ''
            };
        });
        const fractionRoles = await loadCuratorFractionRoleIdsFromSettings();
        const curators = [];
        for (const m of guild.members.cache.values()) {
            if (!m.roles.cache.has(roleId)) continue;
            const mid = m.id;
            const mrow = meta[mid] || { nickname_override: '', lvl: '', curate: '' };
            const display = m.displayName || m.user?.username || mid;
            const nickname = (mrow.nickname_override && mrow.nickname_override.trim())
                ? mrow.nickname_override.trim()
                : display;
            const factions = curatorFactionsFromRolesOnMain(m, fractionRoles);
            curators.push({
                discordId: mid,
                nickname,
                discordDisplayName: display,
                lvl: mrow.lvl || '',
                curate: mrow.curate || '',
                factions,
                discordTag: m.user?.tag || m.user?.username || ''
            });
        }
        curators.sort((a, b) => String(a.nickname).localeCompare(String(b.nickname), 'ru'));
        return res.json({
            curators,
            warning: memberFetchWarning || null,
            guildConfigured: true,
            roleConfigured: true
        });
    } catch (e) {
        console.error('GET /api/curators:', e.message);
        return res.status(500).json({ error: e.message });
    }
});

app.put('/api/curators/:discordId', async (req, res) => {
    if (!req.session?.user) return res.status(401).json({ error: 'Unauthorized' });
    if (!pool) return res.status(503).json({ error: 'Database not configured' });
    const discordId = String(req.params.discordId || '').trim();
    if (!/^\d{5,30}$/.test(discordId)) return res.status(400).json({ error: 'Некорректный Discord ID' });
    const nicknameRaw = req.body?.nickname == null ? '' : String(req.body.nickname).trim();
    const lvl = req.body?.lvl == null ? '' : String(req.body.lvl).trim().slice(0, 64);
    if (nicknameRaw.length > 128) return res.status(400).json({ error: 'Ник слишком длинный' });
    try {
        const { guildId, roleId } = await getMainCuratorGuildAndRole();
        if (!guildId || !roleId) {
            return res.status(400).json({ error: 'Не заданы основной сервер или ID основной роли в настройках' });
        }
        const guild = client.guilds.cache.get(guildId);
        if (!guild) return res.status(400).json({ error: 'Сервер недоступен' });
        const member = await guild.members.fetch(discordId).catch(() => null);
        if (!member || !member.roles.cache.has(roleId)) {
            return res.status(404).json({ error: 'Участник не найден или не имеет основной роли' });
        }
        const display = String(member.displayName || member.user?.username || '').trim();
        let nicknameOverride = null;
        if (nicknameRaw !== '' && nicknameRaw !== display) {
            nicknameOverride = nicknameRaw;
        }
        const { rows: upRows } = await pool.query(
            `INSERT INTO curator_meta (discord_id, nickname_override, lvl, curate, updated_at)
             VALUES ($1, $2, $3, '', NOW())
             ON CONFLICT (discord_id) DO UPDATE SET
               nickname_override = EXCLUDED.nickname_override,
               lvl = EXCLUDED.lvl,
               updated_at = NOW()
             RETURNING curate`,
            [discordId, nicknameOverride, lvl]
        );
        const savedCurate = upRows[0]?.curate || '';
        const mrow = { nickname_override: nicknameOverride || '', lvl, curate: savedCurate };
        const nickname = (mrow.nickname_override && mrow.nickname_override.trim())
            ? mrow.nickname_override.trim()
            : display;
        const fractionRoles = await loadCuratorFractionRoleIdsFromSettings();
        const factions = curatorFactionsFromRolesOnMain(member, fractionRoles);
        return res.json({
            discordId,
            nickname,
            discordDisplayName: display,
            lvl: mrow.lvl || '',
            curate: savedCurate || '',
            factions,
            discordTag: member.user?.tag || member.user?.username || ''
        });
    } catch (e) {
        console.error('PUT /api/curators:', e.message);
        return res.status(500).json({ error: e.message });
    }
});

app.delete('/api/curators/:discordId', async (req, res) => {
    if (!req.session?.user) return res.status(401).json({ error: 'Unauthorized' });
    if (!pool) return res.status(503).json({ error: 'Database not configured' });
    const discordId = String(req.params.discordId || '').trim();
    if (!/^\d{5,30}$/.test(discordId)) return res.status(400).json({ error: 'Некорректный Discord ID' });
    try {
        const { guildId, roleId } = await getMainCuratorGuildAndRole();
        if (!guildId || !roleId) {
            return res.status(400).json({ error: 'Не заданы основной сервер или ID основной роли в настройках' });
        }
        const guild = client.guilds.cache.get(guildId);
        if (!guild) return res.status(400).json({ error: 'Сервер недоступен' });
        const member = await guild.members.fetch(discordId).catch(() => null);
        if (member && member.roles.cache.has(roleId)) {
            try {
                await member.roles.remove(roleId, 'Снятие куратора через панель');
            } catch (re) {
                console.error('DELETE /api/curators remove role:', re.message);
                return res.status(400).json({
                    error: 'Не удалось снять роль. Проверьте, что роль бота выше основной роли и есть право «Управлять ролями».'
                });
            }
        }
        await pool.query('DELETE FROM curator_meta WHERE discord_id=$1', [discordId]);
        return res.status(204).end();
    } catch (e) {
        console.error('DELETE /api/curators:', e.message);
        return res.status(500).json({ error: e.message });
    }
});

// --- 4.1. API МАТЕРИАЛОВ СЕМЕЙ ---
app.get('/api/family-materials', async (req, res) => {
    if (!req.session?.user) return res.status(401).json({ error: 'Unauthorized' });
    if (!pool) return res.json([]);
    try {
        const { rows } = await pool.query(
            'SELECT id, title, content, issued, created_at, family_name, resources FROM family_materials ORDER BY issued ASC, created_at DESC, id DESC'
        );
        res.json(rows.map(r => ({
            dbId: r.id,
            title: r.title || '',
            content: r.content || '',
            issued: !!r.issued,
            createdAt: r.created_at ? r.created_at.toISOString() : null,
            familyName: r.family_name || '',
            resources: r.resources || ''
        })));
    } catch (e) {
        console.error('GET /api/family-materials:', e.message);
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/family-materials', async (req, res) => {
    if (!req.session?.user) return res.status(401).json({ error: 'Unauthorized' });
    if (!pool) return res.status(503).json({ error: 'Database not configured' });
    const { title, content, familyName, resources } = req.body || {};
    try {
        const { rows } = await pool.query(
            'INSERT INTO family_materials (title, content, issued, family_name, resources) VALUES ($1, $2, FALSE, $3, $4) RETURNING id, title, content, issued, created_at, family_name, resources',
            [title || '', content || '', familyName || '', resources || '']
        );
        const r = rows[0];
        res.status(201).json({
            dbId: r.id,
            title: r.title || '',
            content: r.content || '',
            issued: !!r.issued,
            createdAt: r.created_at ? r.created_at.toISOString() : null,
            familyName: r.family_name || '',
            resources: r.resources || ''
        });
    } catch (e) {
        console.error('POST /api/family-materials:', e.message);
        res.status(500).json({ error: e.message });
    }
});

app.put('/api/family-materials/:id', async (req, res) => {
    if (!req.session?.user) return res.status(401).json({ error: 'Unauthorized' });
    if (!pool) return res.status(503).json({ error: 'Database not configured' });
    const dbId = parseInt(req.params.id, 10);
    if (isNaN(dbId)) return res.status(400).json({ error: 'Invalid id' });
    const { title, content, issued, familyName, resources } = req.body || {};
    try {
        await pool.query(
            'UPDATE family_materials SET title=$1, content=$2, issued=$3, family_name=$4, resources=$5 WHERE id=$6',
            [title || '', content || '', !!issued, familyName || '', resources || '', dbId]
        );
        const { rows } = await pool.query(
            'SELECT id, title, content, issued, created_at, family_name, resources FROM family_materials WHERE id=$1',
            [dbId]
        );
        if (!rows[0]) return res.status(404).json({ error: 'Not found' });
        const r = rows[0];
        res.json({
            dbId: r.id,
            title: r.title || '',
            content: r.content || '',
            issued: !!r.issued,
            createdAt: r.created_at ? r.created_at.toISOString() : null,
            familyName: r.family_name || '',
            resources: r.resources || ''
        });
    } catch (e) {
        console.error('PUT /api/family-materials/:id:', e.message);
        res.status(500).json({ error: e.message });
    }
});

app.delete('/api/family-materials/:id', async (req, res) => {
    if (!req.session?.user) return res.status(401).json({ error: 'Unauthorized' });
    if (!pool) return res.status(503).json({ error: 'Database not configured' });
    const dbId = parseInt(req.params.id, 10);
    if (isNaN(dbId)) return res.status(400).json({ error: 'Invalid id' });
    try {
        await pool.query('DELETE FROM family_materials WHERE id=$1', [dbId]);
        res.status(204).end();
    } catch (e) {
        console.error('DELETE /api/family-materials/:id:', e.message);
        res.status(500).json({ error: e.message });
    }
});

// --- 4.2. API МАТЕРИАЛОВ ФРАКЦИЙ ---
app.get('/api/faction-materials', async (req, res) => {
    if (!req.session?.user) return res.status(401).json({ error: 'Unauthorized' });
    if (!pool) return res.json([]);
    try {
        const { rows } = await pool.query(
            'SELECT id, title, content, issued, created_at, faction_name, resources FROM faction_materials ORDER BY issued ASC, created_at DESC, id DESC'
        );
        res.json(rows.map(r => ({
            dbId: r.id,
            title: r.title || '',
            content: r.content || '',
            issued: !!r.issued,
            createdAt: r.created_at ? r.created_at.toISOString() : null,
            factionName: r.faction_name || '',
            resources: r.resources || ''
        })));
    } catch (e) {
        console.error('GET /api/faction-materials:', e.message);
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/faction-materials', async (req, res) => {
    if (!req.session?.user) return res.status(401).json({ error: 'Unauthorized' });
    if (!pool) return res.status(503).json({ error: 'Database not configured' });
    const { title, content, factionName, resources } = req.body || {};
    try {
        const { rows } = await pool.query(
            'INSERT INTO faction_materials (title, content, issued, faction_name, resources) VALUES ($1, $2, FALSE, $3, $4) RETURNING id, title, content, issued, created_at, faction_name, resources',
            [title || '', content || '', factionName || '', resources || '']
        );
        const r = rows[0];
        res.status(201).json({
            dbId: r.id,
            title: r.title || '',
            content: r.content || '',
            issued: !!r.issued,
            createdAt: r.created_at ? r.created_at.toISOString() : null,
            factionName: r.faction_name || '',
            resources: r.resources || ''
        });
    } catch (e) {
        console.error('POST /api/faction-materials:', e.message);
        res.status(500).json({ error: e.message });
    }
});

app.put('/api/faction-materials/:id', async (req, res) => {
    if (!req.session?.user) return res.status(401).json({ error: 'Unauthorized' });
    if (!pool) return res.status(503).json({ error: 'Database not configured' });
    const dbId = parseInt(req.params.id, 10);
    if (isNaN(dbId)) return res.status(400).json({ error: 'Invalid id' });
    const { title, content, issued, factionName, resources } = req.body || {};
    try {
        await pool.query(
            'UPDATE faction_materials SET title=$1, content=$2, issued=$3, faction_name=$4, resources=$5 WHERE id=$6',
            [title || '', content || '', !!issued, factionName || '', resources || '', dbId]
        );
        const { rows } = await pool.query(
            'SELECT id, title, content, issued, created_at, faction_name, resources FROM faction_materials WHERE id=$1',
            [dbId]
        );
        if (!rows[0]) return res.status(404).json({ error: 'Not found' });
        const r = rows[0];
        res.json({
            dbId: r.id,
            title: r.title || '',
            content: r.content || '',
            issued: !!r.issued,
            createdAt: r.created_at ? r.created_at.toISOString() : null,
            factionName: r.faction_name || '',
            resources: r.resources || ''
        });
    } catch (e) {
        console.error('PUT /api/faction-materials/:id:', e.message);
        res.status(500).json({ error: e.message });
    }
});

app.delete('/api/faction-materials/:id', async (req, res) => {
    if (!req.session?.user) return res.status(401).json({ error: 'Unauthorized' });
    if (!pool) return res.status(503).json({ error: 'Database not configured' });
    const dbId = parseInt(req.params.id, 10);
    if (isNaN(dbId)) return res.status(400).json({ error: 'Invalid id' });
    try {
        await pool.query('DELETE FROM faction_materials WHERE id=$1', [dbId]);
        res.status(204).end();
    } catch (e) {
        console.error('DELETE /api/faction-materials/:id:', e.message);
        res.status(500).json({ error: e.message });
    }
});

// --- 3.1. API ЛИДЕРОВ (БД Railway) ---
app.get('/api/leaders', async (req, res) => {
    if (!req.session?.user) return res.status(401).json({ error: 'Unauthorized' });
    if (!pool) {
        // fallback: статика, если нет БД
        return res.json([
            { dbId: null, id: 8, faction: 'The Ballas Gang', leader: '', staticId: '', term: '', time: '', flagged: false },
            { dbId: null, id: 9, faction: 'Los Santos Vagos', leader: '', staticId: '', term: '', time: '', flagged: false },
            { dbId: null, id: 10, faction: 'The Families', leader: '', staticId: '', term: '', time: '', flagged: false },
            { dbId: null, id: 11, faction: 'The Bloods Gang', leader: '', staticId: '', term: '', time: '', flagged: false },
            { dbId: null, id: 12, faction: 'Marabunta Grande', leader: '', staticId: '', term: '', time: '', flagged: false }
        ]);
    }
    try {
        const { rows } = await pool.query('SELECT id, display_id, faction, leader, static_id, term, time, flagged FROM leaders ORDER BY display_id');
        res.json(rows.map(r => ({
            dbId: r.id,
            id: r.display_id,
            faction: r.faction,
            leader: r.leader || '',
            staticId: r.static_id || '',
            term: r.term || '',
            time: r.time ? r.time.toISOString().slice(0, 10) : '',
            flagged: !!r.flagged
        })));
    } catch (e) {
        console.error('GET /api/leaders:', e.message);
        res.status(500).json({ error: e.message });
    }
});

app.put('/api/leaders/:id', async (req, res) => {
    if (!req.session?.user) return res.status(401).json({ error: 'Unauthorized' });
    if (!pool) return res.status(503).json({ error: 'Database not configured' });
    const dbId = parseInt(req.params.id, 10);
    if (isNaN(dbId)) return res.status(400).json({ error: 'Invalid id' });
    const { leader, staticId, term, time, flagged } = req.body || {};
    try {
        await pool.query(
            'UPDATE leaders SET leader=$1, static_id=$2, term=$3, time=$4, flagged=$5 WHERE id=$6',
            [leader || null, staticId || null, term || null, time || null, !!flagged, dbId]
        );
        const { rows } = await pool.query('SELECT id, display_id, faction, leader, static_id, term, time, flagged FROM leaders WHERE id=$1', [dbId]);
        if (!rows[0]) return res.status(404).json({ error: 'Not found' });
        const r = rows[0];
        res.json({
            dbId: r.id,
            id: r.display_id,
            faction: r.faction,
            leader: r.leader || '',
            staticId: r.static_id || '',
            term: r.term || '',
            time: r.time ? r.time.toISOString().slice(0, 10) : '',
            flagged: !!r.flagged
        });
    } catch (e) {
        console.error('PUT /api/leaders:', e.message);
        res.status(500).json({ error: e.message });
    }
});

// --- 3.2. API АККАУНТОВ (ТОЛЬКО ADMIN) ---
app.get('/api/accounts', requireRole('Admin'), async (req, res) => {
    if (!pool) return res.json([]);
    try {
        const { rows } = await pool.query('SELECT id, nickname, lvl, server, login, password FROM accounts ORDER BY id DESC');
        res.json(rows.map(r => ({
            dbId: r.id,
            nickname: r.nickname,
            lvl: r.lvl ?? null,
            server: r.server ?? '',
            login: r.login ?? '',
            password: r.password ?? ''
        })));
    } catch (e) {
        console.error('GET /api/accounts:', e.message);
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/accounts', requireRole('Admin'), async (req, res) => {
    if (!pool) return res.status(503).json({ error: 'Database not configured' });
    const { nickname, lvl, server, login, password } = req.body || {};
    if (!nickname) return res.status(400).json({ error: 'nickname required' });
    try {
        const { rows } = await pool.query(
            'INSERT INTO accounts (nickname, lvl, server, login, password) VALUES ($1, $2, $3, $4, $5) RETURNING id, nickname, lvl, server, login, password',
            [String(nickname), lvl === '' || lvl == null ? null : Number(lvl), server || null, login || null, password || null]
        );
        const r = rows[0];
        res.status(201).json({ dbId: r.id, nickname: r.nickname, lvl: r.lvl ?? null, server: r.server ?? '', login: r.login ?? '', password: r.password ?? '' });
    } catch (e) {
        console.error('POST /api/accounts:', e.message);
        res.status(500).json({ error: e.message });
    }
});

app.put('/api/accounts/:id', requireRole('Admin'), async (req, res) => {
    if (!pool) return res.status(503).json({ error: 'Database not configured' });
    const dbId = parseInt(req.params.id, 10);
    if (isNaN(dbId)) return res.status(400).json({ error: 'Invalid id' });
    const { nickname, lvl, server, login, password } = req.body || {};
    if (!nickname) return res.status(400).json({ error: 'nickname required' });
    try {
        await pool.query(
            'UPDATE accounts SET nickname=$1, lvl=$2, server=$3, login=$4, password=$5 WHERE id=$6',
            [String(nickname), lvl === '' || lvl == null ? null : Number(lvl), server || null, login || null, password || null, dbId]
        );
        res.json({ dbId, nickname, lvl: lvl === '' || lvl == null ? null : Number(lvl), server: server || '', login: login || '', password: password || '' });
    } catch (e) {
        console.error('PUT /api/accounts:', e.message);
        res.status(500).json({ error: e.message });
    }
});

app.delete('/api/accounts/:id', requireRole('Admin'), async (req, res) => {
    if (!pool) return res.status(503).json({ error: 'Database not configured' });
    const dbId = parseInt(req.params.id, 10);
    if (isNaN(dbId)) return res.status(400).json({ error: 'Invalid id' });
    try {
        await pool.query('DELETE FROM accounts WHERE id=$1', [dbId]);
        res.status(204).end();
    } catch (e) {
        console.error('DELETE /api/accounts:', e.message);
        res.status(500).json({ error: e.message });
    }
});

// --- 4.3. API МЕРОПРИЯТИЙ ---
app.get('/api/events', async (req, res) => {
    if (!req.session?.user) return res.status(401).json({ error: 'Unauthorized' });
    if (!pool) return res.json([]);
    const { from, to } = req.query || {};
    const fromStr = typeof from === 'string' ? from : '';
    const toStr = typeof to === 'string' ? to : '';
    // expecting YYYY-MM-DD
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fromStr) || !/^\d{4}-\d{2}-\d{2}$/.test(toStr)) {
        return res.status(400).json({ error: 'from and to (YYYY-MM-DD) are required' });
    }
    try {
        const { rows } = await pool.query(
            `SELECT id, event_date, title, description, created_by, created_at, source_system_key
             FROM events
             WHERE event_date >= $1::date AND event_date <= $2::date
             ORDER BY event_date ASC, id ASC`,
            [fromStr, toStr]
        );
        const { rows: supRows } = await pool.query(
            `SELECT event_date, system_key FROM suppressed_system_events
             WHERE event_date >= $1::date AND event_date <= $2::date`,
            [fromStr, toStr]
        );
        res.json({
            events: rows.map(r => ({
                dbId: r.id,
                date: r.event_date ? r.event_date.toISOString().slice(0, 10) : null,
                title: r.title || '',
                description: r.description || '',
                createdBy: r.created_by ?? null,
                createdAt: r.created_at ? r.created_at.toISOString() : null,
                sourceSystemKey: r.source_system_key || null
            })),
            suppressedSystem: supRows.map(r => ({
                date: r.event_date ? r.event_date.toISOString().slice(0, 10) : null,
                key: r.system_key
            }))
        });
    } catch (e) {
        console.error('GET /api/events:', e.message);
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/events', async (req, res) => {
    if (!req.session?.user) return res.status(401).json({ error: 'Unauthorized' });
    if (!pool) return res.status(503).json({ error: 'Database not configured' });
    const { date, title, description, sourceSystemKey } = req.body || {};
    const dateStr = typeof date === 'string' ? date : '';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return res.status(400).json({ error: 'date (YYYY-MM-DD) required' });
    if (!title || !String(title).trim()) return res.status(400).json({ error: 'title required' });
    const sysKey = sourceSystemKey === 'vzz' || sourceSystemKey === 'vzm' ? sourceSystemKey : null;
    try {
        const createdBy = req.session.user?.id ?? null;
        if (sysKey) {
            const { rows: existing } = await pool.query(
                'SELECT id FROM events WHERE event_date = $1::date AND source_system_key = $2',
                [dateStr, sysKey]
            );
            if (existing[0]) {
                await pool.query(
                    'UPDATE events SET title=$1, description=$2 WHERE id=$3',
                    [String(title).trim(), description ? String(description) : null, existing[0].id]
                );
                const { rows } = await pool.query(
                    'SELECT id, event_date, title, description, created_by, created_at, source_system_key FROM events WHERE id=$1',
                    [existing[0].id]
                );
                const r = rows[0];
                return res.json({
                    dbId: r.id,
                    date: r.event_date ? r.event_date.toISOString().slice(0, 10) : null,
                    title: r.title || '',
                    description: r.description || '',
                    createdBy: r.created_by ?? null,
                    createdAt: r.created_at ? r.created_at.toISOString() : null,
                    sourceSystemKey: r.source_system_key || null
                });
            }
        }
        const { rows } = await pool.query(
            `INSERT INTO events (event_date, title, description, created_by, source_system_key)
             VALUES ($1::date, $2, $3, $4, $5)
             RETURNING id, event_date, title, description, created_by, created_at, source_system_key`,
            [dateStr, String(title).trim(), description ? String(description) : null, createdBy, sysKey]
        );
        const r = rows[0];
        res.status(201).json({
            dbId: r.id,
            date: r.event_date ? r.event_date.toISOString().slice(0, 10) : null,
            title: r.title || '',
            description: r.description || '',
            createdBy: r.created_by ?? null,
            createdAt: r.created_at ? r.created_at.toISOString() : null,
            sourceSystemKey: r.source_system_key || null
        });
    } catch (e) {
        console.error('POST /api/events:', e.message);
        res.status(500).json({ error: e.message });
    }
});

/** Скрыть автоматическое ВЗЗ/ВЗМ на конкретную дату (без записи в events) */
app.post('/api/events/system-suppress', async (req, res) => {
    if (!req.session?.user) return res.status(401).json({ error: 'Unauthorized' });
    if (!pool) return res.status(503).json({ error: 'Database not configured' });
    const { date, key } = req.body || {};
    const dateStr = typeof date === 'string' ? date : '';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return res.status(400).json({ error: 'date (YYYY-MM-DD) required' });
    if (key !== 'vzz' && key !== 'vzm') return res.status(400).json({ error: 'key must be vzz or vzm' });
    try {
        await pool.query(
            `INSERT INTO suppressed_system_events (event_date, system_key) VALUES ($1::date, $2)
             ON CONFLICT (event_date, system_key) DO NOTHING`,
            [dateStr, key]
        );
        res.status(204).end();
    } catch (e) {
        console.error('POST /api/events/system-suppress:', e.message);
        res.status(500).json({ error: e.message });
    }
});

app.put('/api/events/:id', async (req, res) => {
    if (!req.session?.user) return res.status(401).json({ error: 'Unauthorized' });
    if (!pool) return res.status(503).json({ error: 'Database not configured' });
    const dbId = parseInt(req.params.id, 10);
    if (isNaN(dbId)) return res.status(400).json({ error: 'Invalid id' });
    const { title, description } = req.body || {};
    if (!title || !String(title).trim()) return res.status(400).json({ error: 'title required' });
    try {
        await pool.query(
            'UPDATE events SET title=$1, description=$2 WHERE id=$3',
            [String(title).trim(), description ? String(description) : null, dbId]
        );
        const { rows } = await pool.query(
            'SELECT id, event_date, title, description, created_by, created_at, source_system_key FROM events WHERE id=$1',
            [dbId]
        );
        if (!rows[0]) return res.status(404).json({ error: 'Not found' });
        const r = rows[0];
        res.json({
            dbId: r.id,
            date: r.event_date ? r.event_date.toISOString().slice(0, 10) : null,
            title: r.title || '',
            description: r.description || '',
            createdBy: r.created_by ?? null,
            createdAt: r.created_at ? r.created_at.toISOString() : null,
            sourceSystemKey: r.source_system_key || null
        });
    } catch (e) {
        console.error('PUT /api/events/:id:', e.message);
        res.status(500).json({ error: e.message });
    }
});

app.delete('/api/events/:id', async (req, res) => {
    if (!req.session?.user) return res.status(401).json({ error: 'Unauthorized' });
    if (!pool) return res.status(503).json({ error: 'Database not configured' });
    const dbId = parseInt(req.params.id, 10);
    if (isNaN(dbId)) return res.status(400).json({ error: 'Invalid id' });
    try {
        await pool.query('DELETE FROM events WHERE id=$1', [dbId]);
        res.status(204).end();
    } catch (e) {
        console.error('DELETE /api/events/:id:', e.message);
        res.status(500).json({ error: e.message });
    }
});

function mapEventFeRow(r) {
    return {
        rowId: r.id,
        sortIndex: r.sort_index,
        familyRefId: r.family_ref_id,
        familyName: r.family_name || '',
        familyGameId: r.family_game_id || '',
        colour: r.colour || 'white',
        died: Boolean(r.died),
        curatorName: r.curator_name || '',
        lFlag: Boolean(r.l_flag),
        wFlag: Boolean(r.w_flag),
        isSpacer: Boolean(r.is_spacer)
    };
}

app.get('/api/event-detail-rows', async (req, res) => {
    if (!req.session?.user) return res.status(401).json({ error: 'Unauthorized' });
    if (!pool) return res.json([]);
    const pageKey = typeof req.query.pageKey === 'string' ? req.query.pageKey.trim() : '';
    if (!pageKey || pageKey.length > 500) return res.status(400).json({ error: 'pageKey required' });
    try {
        const { rows } = await pool.query(
            `SELECT r.id, r.page_key, r.sort_index, r.family_ref_id, r.colour, r.died, r.curator_name, r.l_flag, r.w_flag, r.is_spacer,
                    f.name AS family_name, f.family_id AS family_game_id
             FROM event_detail_family_rows r
             LEFT JOIN families f ON f.id = r.family_ref_id
             WHERE r.page_key = $1
             ORDER BY r.sort_index ASC, r.id ASC`,
            [pageKey]
        );
        res.json(rows.map(mapEventFeRow));
    } catch (e) {
        console.error('GET /api/event-detail-rows:', e.message);
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/event-detail-rows', async (req, res) => {
    if (!req.session?.user) return res.status(401).json({ error: 'Unauthorized' });
    if (!pool) return res.status(503).json({ error: 'Database not configured' });
    const b = req.body || {};
    const pageKey = typeof b.pageKey === 'string' ? b.pageKey.trim() : '';
    if (!pageKey || pageKey.length > 500) return res.status(400).json({ error: 'pageKey required' });
    try {
        const isSpacer = Boolean(b.isSpacer);
        let familyRefId = null;
        let colour = 'white';
        let died = false;
        let curatorName = '';
        let lFlag = false;
        let wFlag = false;
        if (isSpacer) {
            familyRefId = null;
        } else {
            if (b.familyRefId !== undefined && b.familyRefId !== null && b.familyRefId !== '') {
                const n = parseInt(b.familyRefId, 10);
                if (isNaN(n)) return res.status(400).json({ error: 'Invalid familyRefId' });
                const { rows: fk } = await pool.query('SELECT id FROM families WHERE id=$1', [n]);
                if (!fk[0]) return res.status(400).json({ error: 'Family not found' });
                familyRefId = n;
            }
            if (typeof b.colour === 'string') {
                const c = b.colour.trim().toLowerCase();
                if (!EVENT_FE_COLOURS.has(c)) return res.status(400).json({ error: 'Invalid colour' });
                colour = c;
            }
            died = Boolean(b.died);
            curatorName = typeof b.curatorName === 'string' ? b.curatorName.slice(0, 255) : '';
            lFlag = Boolean(b.lFlag);
            wFlag = Boolean(b.wFlag);
        }
        const { rows: mx } = await pool.query(
            'SELECT COALESCE(MAX(sort_index), -1) + 1 AS n FROM event_detail_family_rows WHERE page_key = $1',
            [pageKey]
        );
        const sortIndex = mx[0]?.n ?? 0;
        const { rows } = await pool.query(
            `INSERT INTO event_detail_family_rows (page_key, sort_index, family_ref_id, colour, died, curator_name, l_flag, w_flag, is_spacer)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
             RETURNING id, page_key, sort_index, family_ref_id, colour, died, curator_name, l_flag, w_flag, is_spacer`,
            [pageKey, sortIndex, familyRefId, colour, died, curatorName, lFlag, wFlag, isSpacer]
        );
        const ins = rows[0];
        const { rows: full } = await pool.query(
            `SELECT r.id, r.page_key, r.sort_index, r.family_ref_id, r.colour, r.died, r.curator_name, r.l_flag, r.w_flag, r.is_spacer,
                    f.name AS family_name, f.family_id AS family_game_id
             FROM event_detail_family_rows r
             LEFT JOIN families f ON f.id = r.family_ref_id
             WHERE r.id = $1`,
            [ins.id]
        );
        res.status(201).json(mapEventFeRow(full[0]));
    } catch (e) {
        console.error('POST /api/event-detail-rows:', e.message);
        res.status(500).json({ error: e.message });
    }
});

app.put('/api/event-detail-rows/:id', async (req, res) => {
    if (!req.session?.user) return res.status(401).json({ error: 'Unauthorized' });
    if (!pool) return res.status(503).json({ error: 'Database not configured' });
    const rowId = parseInt(req.params.id, 10);
    if (isNaN(rowId)) return res.status(400).json({ error: 'Invalid id' });
    const b = req.body || {};
    try {
        const { rows: curRows } = await pool.query(
            'SELECT family_ref_id, colour, died, curator_name, l_flag, w_flag, is_spacer FROM event_detail_family_rows WHERE id = $1',
            [rowId]
        );
        if (!curRows[0]) return res.status(404).json({ error: 'Not found' });
        const cur = curRows[0];
        let isSpacer = Boolean(cur.is_spacer);
        if (Object.prototype.hasOwnProperty.call(b, 'isSpacer')) isSpacer = Boolean(b.isSpacer);

        let familyRefId = cur.family_ref_id;
        let colour = cur.colour;
        let died = cur.died;
        let curatorName = cur.curator_name;
        let lFlag = cur.l_flag;
        let wFlag = cur.w_flag;

        if (isSpacer) {
            familyRefId = null;
            colour = 'white';
            died = false;
            curatorName = '';
            lFlag = false;
            wFlag = false;
        } else {
            if (Object.prototype.hasOwnProperty.call(b, 'familyRefId')) {
                if (b.familyRefId === null || b.familyRefId === '') familyRefId = null;
                else {
                    const n = parseInt(b.familyRefId, 10);
                    if (isNaN(n)) return res.status(400).json({ error: 'Invalid familyRefId' });
                    const { rows: fk } = await pool.query('SELECT id FROM families WHERE id=$1', [n]);
                    if (!fk[0]) return res.status(400).json({ error: 'Family not found' });
                    familyRefId = n;
                }
            }
            if (typeof b.colour === 'string') {
                const c = b.colour.trim().toLowerCase();
                if (!EVENT_FE_COLOURS.has(c)) return res.status(400).json({ error: 'Invalid colour' });
                colour = c;
            }
            if (typeof b.died === 'boolean') died = b.died;
            if (typeof b.curatorName === 'string') curatorName = b.curatorName.slice(0, 255);
            if (typeof b.lFlag === 'boolean') lFlag = b.lFlag;
            if (typeof b.wFlag === 'boolean') wFlag = b.wFlag;
        }

        await pool.query(
            `UPDATE event_detail_family_rows
             SET family_ref_id=$1, colour=$2, died=$3, curator_name=$4, l_flag=$5, w_flag=$6, is_spacer=$7
             WHERE id=$8`,
            [familyRefId, colour, died, curatorName, lFlag, wFlag, isSpacer, rowId]
        );
        const { rows: full } = await pool.query(
            `SELECT r.id, r.page_key, r.sort_index, r.family_ref_id, r.colour, r.died, r.curator_name, r.l_flag, r.w_flag, r.is_spacer,
                    f.name AS family_name, f.family_id AS family_game_id
             FROM event_detail_family_rows r
             LEFT JOIN families f ON f.id = r.family_ref_id
             WHERE r.id = $1`,
            [rowId]
        );
        res.json(mapEventFeRow(full[0]));
    } catch (e) {
        console.error('PUT /api/event-detail-rows/:id:', e.message);
        res.status(500).json({ error: e.message });
    }
});

app.delete('/api/event-detail-rows/:id', async (req, res) => {
    if (!req.session?.user) return res.status(401).json({ error: 'Unauthorized' });
    if (!pool) return res.status(503).json({ error: 'Database not configured' });
    const rowId = parseInt(req.params.id, 10);
    if (isNaN(rowId)) return res.status(400).json({ error: 'Invalid id' });
    try {
        const r = await pool.query('DELETE FROM event_detail_family_rows WHERE id=$1', [rowId]);
        if (r.rowCount === 0) return res.status(404).json({ error: 'Not found' });
        res.status(204).end();
    } catch (e) {
        console.error('DELETE /api/event-detail-rows/:id:', e.message);
        res.status(500).json({ error: e.message });
    }
});

function mapEventDetailFactionRowMerged(displayId, name, saved) {
    const s = saved || {};
    return {
        factionDisplayId: displayId,
        factionName: name,
        present: Boolean(s.present),
        curatorName: s.curator_name || '',
        wFlag: Boolean(s.w_flag),
        lFlag: Boolean(s.l_flag)
    };
}

app.get('/api/event-detail-faction-rows', async (req, res) => {
    if (!req.session?.user) return res.status(401).json({ error: 'Unauthorized' });
    const pageKey = typeof req.query.pageKey === 'string' ? req.query.pageKey.trim() : '';
    if (!pageKey || pageKey.length > 500) return res.status(400).json({ error: 'pageKey required' });
    if (!pool) {
        return res.json(
            STATIC_EVENT_DETAIL_FACTIONS.map(({ displayId, name }) =>
                mapEventDetailFactionRowMerged(displayId, name, null)
            )
        );
    }
    try {
        const { rows: saved } = await pool.query(
            `SELECT faction_display_id, present, curator_name, w_flag, l_flag
             FROM event_detail_faction_rows WHERE page_key = $1`,
            [pageKey]
        );
        const map = new Map(saved.map(r => [r.faction_display_id, r]));
        res.json(
            STATIC_EVENT_DETAIL_FACTIONS.map(({ displayId, name }) =>
                mapEventDetailFactionRowMerged(displayId, name, map.get(displayId))
            )
        );
    } catch (e) {
        console.error('GET /api/event-detail-faction-rows:', e.message);
        res.status(500).json({ error: e.message });
    }
});

app.put('/api/event-detail-faction-rows/:displayId', async (req, res) => {
    if (!req.session?.user) return res.status(401).json({ error: 'Unauthorized' });
    if (!pool) return res.status(503).json({ error: 'Database not configured' });
    const displayId = parseInt(req.params.displayId, 10);
    if (isNaN(displayId) || displayId < 8 || displayId > 12) {
        return res.status(400).json({ error: 'Invalid faction id' });
    }
    const pageKey = typeof req.query.pageKey === 'string' ? req.query.pageKey.trim() : '';
    if (!pageKey || pageKey.length > 500) return res.status(400).json({ error: 'pageKey required' });
    const b = req.body || {};
    try {
        const { rows: curRows } = await pool.query(
            `SELECT present, curator_name, w_flag, l_flag FROM event_detail_faction_rows
             WHERE page_key = $1 AND faction_display_id = $2`,
            [pageKey, displayId]
        );
        const cur = curRows[0] || {
            present: false,
            curator_name: '',
            w_flag: false,
            l_flag: false
        };
        const next = {
            present: Object.prototype.hasOwnProperty.call(b, 'present') ? Boolean(b.present) : Boolean(cur.present),
            curator_name: Object.prototype.hasOwnProperty.call(b, 'curatorName')
                ? String(b.curatorName).slice(0, 255)
                : String(cur.curator_name || ''),
            w_flag: Object.prototype.hasOwnProperty.call(b, 'wFlag') ? Boolean(b.wFlag) : Boolean(cur.w_flag),
            l_flag: Object.prototype.hasOwnProperty.call(b, 'lFlag') ? Boolean(b.lFlag) : Boolean(cur.l_flag)
        };
        await pool.query(
            `INSERT INTO event_detail_faction_rows (page_key, faction_display_id, present, curator_name, w_flag, l_flag)
             VALUES ($1, $2, $3, $4, $5, $6)
             ON CONFLICT (page_key, faction_display_id)
             DO UPDATE SET present = EXCLUDED.present, curator_name = EXCLUDED.curator_name,
                           w_flag = EXCLUDED.w_flag, l_flag = EXCLUDED.l_flag`,
            [pageKey, displayId, next.present, next.curator_name, next.w_flag, next.l_flag]
        );
        const meta = STATIC_EVENT_DETAIL_FACTIONS.find(x => x.displayId === displayId);
        res.json(
            mapEventDetailFactionRowMerged(displayId, meta ? meta.name : '', {
                present: next.present,
                curator_name: next.curator_name,
                w_flag: next.w_flag,
                l_flag: next.l_flag
            })
        );
    } catch (e) {
        console.error('PUT /api/event-detail-faction-rows/:displayId:', e.message);
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/settings/discord', async (req, res) => {
    if (!req.session?.user) return res.status(401).json({ error: 'Unauthorized' });
    const scopes = ['main', 'ballas', 'vagos', 'families', 'bloods', 'marabunta'];
    const keys = [];
    scopes.forEach(s => {
        keys.push(
            `${s}_guild_id`,
            `${s}_fraction_curator_role_id`,
            `${s}_fraction_role_id`,
            `${s}_curators_news_channel_id`,
            `${s}_curator_leader_role_id`,
            `${s}_player_requests_channel_id`,
            `${s}_curators_questions_channel_id`,
            `${s}_treasury_channel_id`,
            `${s}_tags_id`,
            `${s}_period_minutes`
        );
    });
    keys.push('main_primary_role_id');
    // legacy keys (compat)
    keys.push(
        'main_curator_role_id',
        'ballas_curator_role_id',
        'families_curator_role_id',
        'vagos_curator_role_id',
        'bloods_curator_role_id',
        'marabunta_curator_role_id'
    );
    const scopeSettings = {};
    const kv = {};
    if (pool) {
        try {
            const { rows } = await pool.query(
                'SELECT key, value FROM app_settings WHERE key = ANY($1::text[])',
                [keys]
            );
            rows.forEach(r => { kv[r.key] = r.value || ''; });
        } catch (e) {
            console.error('GET /api/settings/discord settings read:', e.message);
        }
    }
    scopes.forEach(scope => {
        const legacyCurator = kv[`${scope}_curator_role_id`];
        scopeSettings[scope] = {
            guildId: kv[`${scope}_guild_id`] || '',
            fractionCuratorId: kv[`${scope}_fraction_curator_role_id`] || legacyCurator || '',
            fractionRoleId: kv[`${scope}_fraction_role_id`] || '',
            curatorsNewsId: kv[`${scope}_curators_news_channel_id`] || '',
            curatorLeaderId: kv[`${scope}_curator_leader_role_id`] || '',
            playerRequestsId: kv[`${scope}_player_requests_channel_id`] || '',
            curatorsQuestionsId: kv[`${scope}_curators_questions_channel_id`] || '',
            treasuryId: kv[`${scope}_treasury_channel_id`] || '',
            tagsId: kv[`${scope}_tags_id`] || '',
            periodMinutes: kv[`${scope}_period_minutes`] || '',
            primaryRoleId: scope === 'main' ? (kv.main_primary_role_id || '') : ''
        };
    });
    let guildRows = Array.from(client.guilds.cache.values());
    if (client.isReady() && guildRows.length === 0) {
        try {
            await client.guilds.fetch();
            guildRows = Array.from(client.guilds.cache.values());
        } catch (e) {
            console.error('GET /api/settings/discord guilds.fetch:', e.message);
        }
    }
    const guilds = guildRows
        .sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'ru'))
        .map(g => ({
            id: g.id,
            name: g.name || 'Без названия',
            memberCount: Number(g.memberCount || 0)
        }));
    const botOnline = Boolean(client.user);
    return res.json({
        guilds,
        botOnline,
        scopeSettings
    });
});

app.put('/api/settings/discord', async (req, res) => {
    if (!req.session?.user) return res.status(401).json({ error: 'Unauthorized' });
    if (!pool) return res.status(503).json({ error: 'Database not configured' });
    const scope = req.body?.scope == null ? '' : String(req.body.scope).trim().toLowerCase();
    const allowedScopes = new Set(['main', 'ballas', 'vagos', 'families', 'bloods', 'marabunta']);
    if (!allowedScopes.has(scope)) {
        return res.status(400).json({ error: 'Некорректный scope' });
    }
    const body = {
        guildId: req.body?.guildId == null ? '' : String(req.body.guildId).trim(),
        fractionCuratorId: req.body?.fractionCuratorId == null ? '' : String(req.body.fractionCuratorId).trim(),
        fractionRoleId: req.body?.fractionRoleId == null ? '' : String(req.body.fractionRoleId).trim(),
        curatorsNewsId: req.body?.curatorsNewsId == null ? '' : String(req.body.curatorsNewsId).trim(),
        curatorLeaderId: req.body?.curatorLeaderId == null ? '' : String(req.body.curatorLeaderId).trim(),
        playerRequestsId: req.body?.playerRequestsId == null ? '' : String(req.body.playerRequestsId).trim(),
        curatorsQuestionsId: req.body?.curatorsQuestionsId == null ? '' : String(req.body.curatorsQuestionsId).trim(),
        treasuryId: req.body?.treasuryId == null ? '' : String(req.body.treasuryId).trim(),
        tagsId: req.body?.tagsId == null ? '' : String(req.body.tagsId).trim(),
        periodMinutes: req.body?.periodMinutes == null ? '' : String(req.body.periodMinutes).trim(),
        primaryRoleId: req.body?.primaryRoleId == null ? '' : String(req.body.primaryRoleId).trim()
    };
    const idFields = ['fractionCuratorId', 'fractionRoleId', 'curatorsNewsId', 'curatorLeaderId', 'playerRequestsId', 'curatorsQuestionsId', 'treasuryId'];
    for (const f of idFields) {
        if (body[f] && !/^\d{3,30}$/.test(body[f])) return res.status(400).json({ error: `Некорректное значение ${f}` });
    }
    if (body.tagsId && !/^\d{3,30}$/.test(body.tagsId)) return res.status(400).json({ error: 'Некорректное значение tagsId' });
    if (body.periodMinutes && !/^\d{1,6}$/.test(body.periodMinutes)) return res.status(400).json({ error: 'Некорректное значение periodMinutes' });
    if (scope === 'main' && body.primaryRoleId && !/^\d{3,30}$/.test(body.primaryRoleId)) {
        return res.status(400).json({ error: 'Некорректное значение primaryRoleId' });
    }
    if (body.guildId && !client.guilds.cache.has(body.guildId)) {
        return res.status(400).json({ error: 'Бот не состоит в выбранном сервере' });
    }
    try {
        /** Для main сохраняем только сервер + теги/период/основная роль — не затираем прочие main_* из других экранов. */
        let entries;
        if (scope === 'main') {
            entries = [
                ['main_guild_id', body.guildId],
                ['main_tags_id', body.tagsId],
                ['main_period_minutes', body.periodMinutes],
                ['main_primary_role_id', body.primaryRoleId]
            ];
        } else {
            entries = [
                [`${scope}_guild_id`, body.guildId],
                [`${scope}_fraction_curator_role_id`, body.fractionCuratorId],
                [`${scope}_fraction_role_id`, body.fractionRoleId],
                [`${scope}_curators_news_channel_id`, body.curatorsNewsId],
                [`${scope}_curator_leader_role_id`, body.curatorLeaderId],
                [`${scope}_player_requests_channel_id`, body.playerRequestsId],
                [`${scope}_curators_questions_channel_id`, body.curatorsQuestionsId],
                [`${scope}_treasury_channel_id`, body.treasuryId]
            ];
        }
        for (const [k, v] of entries) {
            await pool.query(
                `INSERT INTO app_settings (key, value, updated_at)
                 VALUES ($1, $2, NOW())
                 ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
                [k, v]
            );
        }
        return res.json({ ok: true });
    } catch (e) {
        console.error('PUT /api/settings/discord:', e.message);
        return res.status(500).json({ error: e.message });
    }
});

// --- 5. МАРШРУТЫ САЙТА (ROUTES) ---
function renderMain(req, res, activePage, opts = {}) {
    const data = {
        botStatus: client.user ? "В сети" : "Подключение...",
        serverName: "Boston RP",
        memberCount: client.guilds.cache.reduce((acc, guild) => acc + guild.memberCount, 0) || "1 719",
        botName: client.user ? client.user.username : "Загрузка..."
    };
    const eventDetailPath = opts.eventDetailPath != null ? opts.eventDetailPath : null;
    res.render('index', { data, user: req.session.user, activePage, eventDetailPath });
}

app.get('/', requireAuthStrict, (req, res) => {
    renderMain(req, res, 'Панель управления');
});

// Отдельные URL для всех разделов сайдбара
app.get('/families', requireAuthStrict, (req, res) => renderMain(req, res, 'Семьи'));
app.get('/leaders', requireAuthStrict, (req, res) => renderMain(req, res, 'Лидеры'));
app.get('/moderation', requireAuthStrict, (req, res) => renderMain(req, res, 'Модерация'));
app.get('/users', requireAuthStrict, (req, res) => renderMain(req, res, 'Пользователи'));

// Разделы, которые пока "в разработке", но уже имеют свои URL
app.get('/events', requireAuthStrict, (req, res) => renderMain(req, res, 'Мероприятия'));
app.get('/curators', requireAuthStrict, (req, res) => renderMain(req, res, 'Кураторы'));
app.get('/activity', requireAuthStrict, (req, res) => renderMain(req, res, 'Активность'));
app.get('/family-materials', requireAuthStrict, (req, res) => renderMain(req, res, 'Материалы семей'));
app.get('/faction-materials', requireAuthStrict, (req, res) => renderMain(req, res, 'Материалы фракций'));
app.get('/capture-map', requireAuthStrict, (req, res) => renderMain(req, res, 'Карта каптов'));
app.get('/online', requireAuthStrict, (req, res) => renderMain(req, res, 'Онлайн Л/Ф'));
app.get('/settings', requireAuthStrict, (req, res) => renderMain(req, res, 'Настройки'));

// Страница конкретного мероприятия: /<slug><DDMM>, напр. /vzm1503 (15 марта, ВЗМ)
// Должен быть после всех фиксированных путей. Не матчится на /families и т.п.
app.get('/:segment', requireAuthStrict, (req, res, next) => {
    const { segment } = req.params;
    if (!/^[a-z][a-z0-9]*\d{4}$/.test(segment)) return next();
    return renderMain(req, res, 'Мероприятия', { eventDetailPath: segment });
});

// --- 4. СОБЫТИЯ БОТА ---
client.once('ready', () => {
    console.log(`✅ Бот запущен как: ${client.user.tag}`);
    registerCuratorTagWatch(client, pool);
});

// --- 6. ЗАПУСК ВСЕЙ СИСТЕМЫ ---
const PORT = process.env.PORT || 3000;
const TOKEN = process.env.BOT_TOKEN;

(async () => {
    await initUsersTable();
    await initFamiliesTable();
    await initLeadersTable();
    await initAccountsTable();
    await initFamilyMaterialsTable();
    await initFactionMaterialsTable();
    await initEventsTable();
    await initEventDetailFamilyRowsTable();
    await initEventDetailFactionRowsTable();
    await initAppSettingsTable();
    await initCuratorMetaTable();
    await initCuratorTagWatchesTable();
    // Сначала вход бота: иначе при первом запросе настроек guilds.cache ещё пустой («серверы не найдены»).
    if (TOKEN) {
        try {
            await client.login(TOKEN);
        } catch (err) {
            console.error('❌ Ошибка подключения бота к Discord:', err.message);
        }
    } else {
        console.warn('⚠️ BOT_TOKEN не задан — бот не запущен');
    }
    app.listen(PORT, () => {
        console.log(`🚀 Сайт открыт по порту: ${PORT}`);
    });
})();