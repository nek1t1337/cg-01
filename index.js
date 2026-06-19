const express = require('express');
const jwt = require('jsonwebtoken');
const bodyParser = require('body-parser');
const cors = require('cors');
const {join} = require("node:path");

const app = express();
const PORT = 80;
const JWT_SECRET = 'h4l30e030j3je03je93-123';

const cookieParser = require('cookie-parser');
app.use(cookieParser()); 
app.use(bodyParser.json());
app.use(cors());

app.use(express.static(__dirname));
const users = [{ id: 1, username: 'stallman', password: '123', role: 'user' }];
let threads = [{ id: 1, owner: 'stallman',category: 'CS:GO', topic: 'Welcome', content: 'Game logic, working with offsets' }];



app.post('/login', (req, res) => {
    const { username, password } = req.body;
    const user = users.find(u => u.username === username && u.password === password);

    if (!user) return res.status(401).json({ message: 'Ошибка входа' });

    const token = jwt.sign({ username: user.username }, JWT_SECRET, { expiresIn: '1h' });

    
    res.cookie('token', token, {
        httpOnly: true, 
        secure: false,  
        maxAge: 3600000 
    });

    res.json({ message: 'Вход выполнен' });
});

app.get('/', (req, res) => {
    const token = req.cookies?.token;

    if (token) {
        
        jwt.verify(token, JWT_SECRET, (err, decoded) => {
            if (err) {

                
                res.sendFile(join(__dirname, 'front', 'desktop.html'));
            } else {
                
                res.sendFile(join(__dirname, 'front', 'forum.html'));
            }
        });
    } else {
        
        res.sendFile(join(__dirname, 'front', 'desktop.html'));
    }
});
app.get('/login', (req, res) => {
    res.sendFile(join(__dirname, 'front','desktop.html'));
});
app.get('/styles.css', (req, res) => {
    res.sendFile(join(__dirname, 'front','styles.css'));
});


app.get('/forum-page', (req, res) => {
    res.sendFile(join(__dirname, 'front','forum.html'));
});

app.get('/threads-page', (req, res) => {
    res.sendFile(join(__dirname, 'front','forum_topics.html'));
});
app.get('/new-thread', (req, res) => {
    res.sendFile(join(__dirname, 'front','forum_new_thread.html'));
});

app.get('/thread', (req, res) => {

    res.sendFile(join(__dirname, 'front', 'forum_topic_stallman.html'));
});




app.get('/threads/:id', (req, res) => {
    
    
    const thread = threads.find(t => t.id == req.params.id);

    if (!thread) {
        return res.status(404).json({ message: 'Тред не найден' });
    }

    res.json(thread);
});
const authenticate = (req, res, next) => {
    const token = req.cookies.token; 
    if (!token) return res.status(401).json({ message: 'Нет доступа' });

    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) return res.status(403).json({ message: 'Токен недействителен' });
        req.user = decoded; 
        next();
    });
};



app.post('/threads', authenticate, (req, res) => {
    const { category, topic, content } = req.body;
    const newThread = {
        id: Date.now(),
        owner: req.user.username,
        topic,
        category,
        content
    };

    threads.push(newThread);
    res.status(201).json(newThread);
});

app.get('/threads', authenticate, (req, res) => {
    
    const { category } = req.query;

    if (category) {
        
        const filteredThreads = threads.filter(t => t.category === category);
        return res.json(filteredThreads);
    }

    
    res.json(threads);
});
app.delete('/threads/:id', authenticate, (req, res) => {
    
    threads = threads.filter(t => t.id != req.params.id);
    res.json({ message: 'Удалено' });
});

app.listen(PORT, () => {
    console.log(`Сервер запущен на http://localhost:${PORT}`);
});
