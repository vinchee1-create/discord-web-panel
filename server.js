require('dotenv').config();
const express = require('express');
const { Client, GatewayIntentBits } = require('discord.js');
const path = require('path');

const app = express();

// --- НАСТРОЙКИ ВЕБ-САЙТА ---
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));

// Главная страница
app.get('/', (req, res) => {
    // Передаем данные бота на страницу, если нужно (например, название сервера)
    res.render('index', { 
        botUser: client.user ? client.user.username : "Бот",
        guildCount: client.guilds.cache.size 
    });
});

// --- ЛОГИКА DISCORD БОТА ---
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ]
});

client.once('ready', () => {
    console.log(`✅ Бот ${client.user.tag} успешно запущен!`);
});

// Пример простой команды
client.on('messageCreate', (message) => {
    if (message.content === '!ping') {
        message.reply('Pong! 🏓');
    }
});

// --- ЗАПУСК ---
const PORT = process.env.PORT || 3000;
const TOKEN = process.env.BOT_TOKEN;

if (!TOKEN) {
    console.error('❌ ОШИБКА: Токен бота (BOT_TOKEN) не найден в переменных окружения!');
} else {
    // Запускаем бота
    client.login(TOKEN).catch(err => console.error('❌ Ошибка логина бота:', err));
    
    // Запускаем сервер
    app.listen(PORT, () => {
        console.log(`🚀 Панель управления доступна на порту ${PORT}`);
    });
}