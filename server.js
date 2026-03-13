require('dotenv').config();
const express = require('express');
const { Client, GatewayIntentBits } = require('discord.js');
const path = require('path');
const { Pool } = require('pg');

const app = express();

// --- 1. НАСТРОЙКИ СЕРВЕРА ---
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// PostgreSQL (Railway): переменная DATABASE_URL или POSTGRES_URL
const pool = process.env.DATABASE_URL || process.env.POSTGRES_URL
    ? new Pool({ connectionString: process.env.DATABASE_URL || process.env.POSTGRES_URL, ssl: { rejectUnauthorized: false } })
    : null;

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

// --- 2. ИНИЦИАЛИЗАЦИЯ БОТА ---
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMembers
    ]
});

// --- 3. API СЕМЕЙ (БД Railway) ---
app.get('/api/families', async (req, res) => {
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

// --- 4. МАРШРУТЫ САЙТА (ROUTES) ---
app.get('/', (req, res) => {
    // Создаем объект data, который ожидает твой index.ejs
    const data = {
        botStatus: client.user ? "В сети" : "Подключение...",
        serverName: "Boston RP", // Можешь заменить на свое
        memberCount: client.guilds.cache.reduce((acc, guild) => acc + guild.memberCount, 0) || "1 719",
        botName: client.user ? client.user.username : "Загрузка..."
    };
    
    // Передаем этот объект в шаблон
    res.render('index', { data: data }); 
});

// --- 4. СОБЫТИЯ БОТА ---
client.once('ready', () => {
    console.log(`✅ Бот запущен как: ${client.user.tag}`);
});

// --- 6. ЗАПУСК ВСЕЙ СИСТЕМЫ ---
const PORT = process.env.PORT || 3000;
const TOKEN = process.env.BOT_TOKEN;

(async () => {
    await initFamiliesTable();
    await initLeadersTable();
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