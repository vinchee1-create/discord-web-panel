require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const express = require('express');
const app = express();

// 1. НАСТРОЙКА БОТА
const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers, GatewayIntentBits.GuildPresences]
});

// Когда бот готов
client.once('ready', () => {
    console.log(`Бот ${client.user.tag} успешно запущен!`);
});

// 2. НАСТРОЙКА САЙТА
app.set('view engine', 'ejs');

app.get('/', (req, res) => {
    // Сайт берет данные прямо у бота в реальном времени
    const data = {
        botStatus: client.user ? "Онлайн" : "Оффлайн",
        serverName: client.guilds.cache.first()?.name || "Сервер не найден",
        memberCount: client.guilds.cache.first()?.memberCount || 0
    };
    
    res.render('index', { data: data });
});

// 3. ЗАПУСК ВСЕГО СРАЗУ
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Сайт работает на http://localhost:${PORT}`);
});

// Замени BOT_TOKEN в файле .env на токен своего бота
client.login(process.env.BOT_TOKEN);