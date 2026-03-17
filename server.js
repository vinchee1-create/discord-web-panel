require('dotenv').config();
const express = require('express');
const { Client, GatewayIntentBits } = require('discord.js');
const path = require('path');
const { Pool } = require('pg');
const session = require('express-session');
const PgSession = require('connect-pg-simple')(session);
const bcrypt = require('bcryptjs');

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

// --- 5. МАРШРУТЫ САЙТА (ROUTES) ---
app.get('/', requireAuthStrict, (req, res) => {
    // Создаем объект data, который ожидает твой index.ejs
    const data = {
        botStatus: client.user ? "В сети" : "Подключение...",
        serverName: "Boston RP", // Можешь заменить на свое
        memberCount: client.guilds.cache.reduce((acc, guild) => acc + guild.memberCount, 0) || "1 719",
        botName: client.user ? client.user.username : "Загрузка..."
    };
    
    // Передаем этот объект в шаблон
    res.render('index', { data: data, user: req.session.user }); 
});

// --- 4. СОБЫТИЯ БОТА ---
client.once('ready', () => {
    console.log(`✅ Бот запущен как: ${client.user.tag}`);
});

// --- 6. ЗАПУСК ВСЕЙ СИСТЕМЫ ---
const PORT = process.env.PORT || 3000;
const TOKEN = process.env.BOT_TOKEN;

(async () => {
    await initUsersTable();
    await initFamiliesTable();
    await initLeadersTable();
    await initAccountsTable();
    app.listen(PORT, () => {
        console.log(`🚀 Сайт открыт по порту: ${PORT}`);
    });
    if (TOKEN) {
        client.login(TOKEN).catch(err => {
            console.error('❌ Ошибка подключения бота к Discord:', err.message);
        });
    } else {
        console.warn('⚠️ BOT_TOKEN не задан — бот не запущен');
    }
})();