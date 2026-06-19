require('dotenv').config();
const express = require('express');
const { Client } = require('pg');
const jwt = require('jsonwebtoken');
const bodyParser = require('body-parser');
const cors = require('cors');
const { join } = require("node:path");
const cookieParser = require('cookie-parser');
const serverless = require('serverless-http');
const path = require('path');

const app = express();
const JWT_SECRET = 'h4l30e030j3je03je93-123';

const db = new Client({
    connectionString: process.env.DATABASE_URL,
});
db.connect();

app.use(cookieParser());
app.use(bodyParser.json());
app.use(cors());

const frontDir = path.join(__dirname, '..', '..', 'front');

const authenticate = (req, res, next) => {
    const token = req.cookies.token;
    if (!token) return res.status(401).json({ message: 'Нет доступа' });
    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) return res.status(403).json({ message: 'Токен недействителен' });
        req.user = decoded;
        next();
    });
};

const checkAuth = (req, res, next) => {
    const token = req.cookies.token;
    if (!token) return res.sendFile(join(frontDir, 'desktop.html'));
    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) return res.sendFile(join(frontDir, 'desktop.html'));
        req.user = decoded;
        next();
    });
};

app.post('/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const result = await db.query('SELECT * FROM users WHERE username = $1 AND password = $2', [username, password]);
        if (result.rows.length === 0) return res.status(401).json({ message: 'Ошибка входа' });
        const token = jwt.sign({ username: username }, JWT_SECRET, { expiresIn: '1h' });
        res.cookie('token', token, { httpOnly: true, maxAge: 3600000 });
        res.json({ message: 'Вход выполнен' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/', (req, res) => {
    const token = req.cookies.token;
    if (token) {
        jwt.verify(token, JWT_SECRET, (err) => {
            if (!err) return res.sendFile(join(frontDir, 'forum.html'));
            res.sendFile(join(frontDir, 'desktop.html'));
        });
    } else {
        res.sendFile(join(frontDir, 'desktop.html'));
    }
});

app.get('/login', (req, res) => res.sendFile(join(frontDir, 'desktop.html')));
app.get('/forum-page', checkAuth, (req, res) => res.sendFile(join(frontDir, 'forum.html')));
app.get('/threads-page', checkAuth, (req, res) => res.sendFile(join(frontDir, 'forum_topics.html')));
app.get('/new-thread', checkAuth, (req, res) => res.sendFile(join(frontDir, 'forum_new_thread.html')));
app.get('/thread', checkAuth, (req, res) => res.sendFile(join(frontDir, 'forum_topic_stallman.html')));

app.get('/threads', authenticate, async (req, res) => {
    const { category } = req.query;
    try {
        if (category) {
            const result = await db.query('SELECT * FROM threads WHERE category = $1', [category]);
            res.json(result.rows);
        } else {
            const result = await db.query('SELECT * FROM threads');
            res.json(result.rows);
        }
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/threads', authenticate, async (req, res) => {
    const { category, topic, content } = req.body;
    try {
        const result = await db.query(
            'INSERT INTO threads (owner, category, topic, content) VALUES ($1, $2, $3, $4) RETURNING *',
            [req.user.username, category, topic, content]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/threads/:id', authenticate, async (req, res) => {
    try {
        const thread = await db.query('SELECT owner FROM threads WHERE id = $1', [req.params.id]);
        if (thread.rows.length > 0 && thread.rows[0].owner === req.user.username) {
            await db.query('DELETE FROM threads WHERE id = $1', [req.params.id]);
            res.json({ message: 'Удалено' });
        } else {
            res.status(403).json({ message: 'Netu prav' });
        }
    } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports.handler = serverless(app);