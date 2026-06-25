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
const JWT_SECRET = process.env.JWT_SECRET;

const db = new Client({
    connectionString: process.env.DATABASE_URL,
});
db.connect();

app.use(cookieParser());
app.use(bodyParser.json());
app.use(cors());

const frontDir = path.join(__dirname, 'front');

const authenticate = async (req, res, next) => {
    const token = req.cookies.token;
    if (!token) return res.status(401).json({ message: 'Нет доступа' });

    try {
        const decoded = jwt.verify(token, JWT_SECRET);

        
        const result = await db.query('SELECT username, role FROM users WHERE username = $1', [decoded.username]);

        if (result.rows.length === 0) return res.status(403).json({ message: 'Пользователь удален' });

        req.user = result.rows[0]; 
        next();
    } catch (err) {
        return res.status(403).json({ message: 'Токен недействителен' });
    }
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
        
        let result = await db.query('SELECT * FROM users WHERE username = $1', [username]);

        if (result.rows.length === 0) {
            
            await db.query(
                'INSERT INTO users (username, password, role) VALUES ($1, $2, $3)',
                [username, password, 'user']
            );
            
        } else {
            
            if (result.rows[0].password !== password) {
                return res.status(401).json({ message: 'Неверный пароль' });
            }
        }

        
        const token = jwt.sign({ username: username }, JWT_SECRET, { expiresIn: '1h' });
        res.cookie('token', token, { httpOnly: true, maxAge: 3600000 });
        res.json({ message: 'Авторизация успешна' });

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
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
app.get('/styles.css', (req, res) => res.sendFile(join(frontDir, 'styles.css')));
app.get('/login', (req, res) => res.sendFile(join(frontDir, 'desktop.html')));
app.get('/forum-page', checkAuth, (req, res) => res.sendFile(join(frontDir, 'forum.html')));
app.get('/threads-page', checkAuth, (req, res) => res.sendFile(join(frontDir, 'forum_topics.html')));
app.get('/new-thread', checkAuth, (req, res) => res.sendFile(join(frontDir, 'forum_new_thread.html')));
app.get('/thread', checkAuth, (req, res) => res.sendFile(join(frontDir, 'forum_topic_stallman.html')));
app.get('/threads', authenticate, async (req, res) => {
    let { category, page = 1, limit = 10 } = req.query;

    
    limit = Math.min(parseInt(limit), 10);
    const offset = (parseInt(page) - 1) * limit;

    try {
        let query = 'SELECT * FROM threads';
        let countQuery = 'SELECT COUNT(*) FROM threads';
        let values = [];

        if (category) {
            query += ' WHERE category = $1';
            countQuery += ' WHERE category = $1';
            values.push(category);
        }

        const countRes = await db.query(countQuery, values);
        const total = parseInt(countRes.rows[0].count);

        query += ` ORDER BY id DESC LIMIT $${values.length + 1} OFFSET $${values.length + 2}`;
        values.push(limit, offset);

        const result = await db.query(query, values);

        res.json({
            threads: result.rows,
            totalPages: Math.ceil(total / limit),
            currentPage: parseInt(page)
        });
    } catch (err) { res.status(500).json({ error: err.message }); }
});
app.get('/recent-users', async (req, res) => {
    try {
        const result = await db.query('SELECT username FROM users ORDER BY id DESC LIMIT 5');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});
app.get('/threads/:id', authenticate, async (req, res) => {
    const { id } = req.params;
    try {
        const result = await db.query('SELECT * FROM threads WHERE id = $1', [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Тред не найден' });
        }

        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
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

        if (thread.rows.length === 0) return res.status(404).json({ message: 'Тред не найден' });

        
        const isOwner = thread.rows[0].owner === req.user.username;
        const isAdmin = req.user.role === 'admin';

        if (isOwner || isAdmin) {
            await db.query('DELETE FROM threads WHERE id = $1', [req.params.id]);
            res.json({ message: 'Удалено' });
        } else {
            res.status(403).json({ message: 'Netu prav' });
        }
    } catch (err) { res.status(500).json({ error: err.message }); }
});

PORT = 3000
app.listen(PORT, () => {
    console.log(`Сервер запущен на http://localhost:${PORT}`);
});