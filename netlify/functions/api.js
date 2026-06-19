const express = require('express');
const jwt = require('jsonwebtoken');
const bodyParser = require('body-parser');
const cors = require('cors');
const { join } = require("node:path");
const cookieParser = require('cookie-parser');
const serverless = require('serverless-http');
const path = require('path');
const app = express();
const JWT_SECRET = 'h4l30e030j3je03je93-123';

app.use(cookieParser());
app.use(bodyParser.json());
app.use(cors());

// Указываем путь к фронтенду
const frontDir = path.join(process.env.LAMBDA_TASK_ROOT, '../../front');
app.use(express.static(frontDir));

// Внимание: данные в памяти будут сбрасываться на Netlify

let users = [{ id: 1, username: 'stallman', password: '123', role: 'user' }];
let threads = [{ id: 1, owner: 'stallman', category: 'CS:GO', topic: 'Welcome', content: 'Game logic, working with offsets' }];

// Middleware аутентификации
const authenticate = (req, res, next) => {
    const token = req.cookies.token;
    if (!token) return res.status(401).json({ message: 'Нет доступа' });
    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) return res.status(403).json({ message: 'Токен недействителен' });
        req.user = decoded;
        next();
    });
};

// Роуты
app.post('/login', (req, res) => {
    const { username, password } = req.body;
    const user = users.find(u => u.username === username && u.password === password);
    if (!user) return res.status(401).json({ message: 'Ошибка входа' });
    const token = jwt.sign({ username: user.username }, JWT_SECRET, { expiresIn: '1h' });
    res.cookie('token', token, { httpOnly: true, secure: false, maxAge: 3600000 });
    res.json({ message: 'Вход выполнен' });
});

app.get('/', (req, res) => res.sendFile(join(frontDir, 'desktop.html')));
app.get('/login', (req, res) => res.sendFile(join(frontDir, 'desktop.html')));
app.get('/forum-page', (req, res) => res.sendFile(join(frontDir, 'forum.html')));
app.get('/threads-page', (req, res) => res.sendFile(join(frontDir, 'forum_topics.html')));
app.get('/new-thread', (req, res) => res.sendFile(join(frontDir, 'forum_new_thread.html')));
app.get('/thread', (req, res) => res.sendFile(join(frontDir, 'forum_topic_stallman.html')));

app.get('/threads/:id', (req, res) => {
    const thread = threads.find(t => t.id == req.params.id);
    if (!thread) return res.status(404).json({ message: 'Тред не найден' });
    res.json(thread);
});

app.post('/threads', authenticate, (req, res) => {
    const { category, topic, content } = req.body;
    const newThread = { id: Date.now(), owner: req.user.username, topic, category, content };
    threads.push(newThread);
    res.status(201).json(newThread);
});

app.get('/threads', authenticate, (req, res) => {
    const { category } = req.query;
    if (category) return res.json(threads.filter(t => t.category === category));
    res.json(threads);
});

app.delete('/threads/:id', authenticate, (req, res) => {
    threads = threads.filter(t => t.id != req.params.id);
    res.json({ message: 'Удалено' });
});

// Экспорт для Netlify Functions
module.exports.handler = serverless(app);
