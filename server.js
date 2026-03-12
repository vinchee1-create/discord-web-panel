require('dotenv').config();
const express = require('express');
const { Client, GatewayIntentBits } = require('discord.js');
const path = require('path');

const app = express();

// --- 1. НАСТРОЙКИ СЕРВЕРА ---
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));

// --- 2. ИНИЦИАЛИЗАЦИЯ БОТА ---
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMembers
    ]
});

// --- 3. МАРШРУТЫ САЙТА (ROUTES) ---
app.get('/', (req, res) => {
    // Безопасная передача данных: если бот еще не загрузился, ставим заглушки
    const data = {
        botName: client.user ? client.user.username : "Загрузка...",
        guildCount: client.guilds.cache.size || 0,
        onlineStatus: "1 719" // Пока статично, как на твоем макете
    };
    
    res.render('index', data);
});

// --- 4. СОБЫТИЯ БОТА ---
client.once('ready', () => {
    console.log(`✅ Бот запущен как: ${client.user.tag}`);
});

// --- 5. ЗАПУСК ВСЕЙ СИСТЕМЫ ---
const PORT = process.env.PORT || 3000;
const TOKEN = process.env.BOT_TOKEN;

if (!TOKEN) {
    console.error('❌ ОШИБКА: Переменная BOT_TOKEN не установлена в Railway!');
} else {
    // Сначала запускаем сайт
    app.listen(PORT, () => {
        console.log(`🚀 Сайт открыт по порту: ${PORT}`);
    });

    // Затем логиним бота
    client.login(TOKEN).catch(err => {
        console.error('❌ Ошибка подключения бота к Discord:', err.message);
    });
}