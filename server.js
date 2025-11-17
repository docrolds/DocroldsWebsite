const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const nodemailer = require('nodemailer');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 3000;
const JWT_SECRET = 'your-secret-key-change-in-production';

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static('uploads'));

if (!fs.existsSync('uploads')) {
    fs.mkdirSync('uploads');
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + file.originalname);
    }
});

const upload = multer({ storage });

let users = [
    {
        id: 1,
        username: 'admin',
        password: bcrypt.hashSync('admin123', 10),
        email: 'admin@docrolds.com',
        role: 'admin',
        createdAt: new Date().toISOString()
    }
];

let beats = [
    {
        id: 1,
        title: 'Beat Title 1',
        genre: 'Hip-Hop',
        category: 'Hip-Hop',
        bpm: 92,
        key: 'C Minor',
        duration: 165,
        price: 29.99,
        audioFile: null,
        createdAt: new Date().toISOString()
    },
    {
        id: 2,
        title: 'Beat Title 2',
        genre: 'Trap',
        category: 'Trap',
        bpm: 140,
        key: 'A Minor',
        duration: 180,
        price: 39.99,
        audioFile: null,
        createdAt: new Date().toISOString()
    },
    {
        id: 3,
        title: 'Beat Title 3',
        genre: 'R&B',
        category: 'R&B',
        bpm: 95,
        key: 'F Major',
        duration: 200,
        price: 34.99,
        audioFile: null,
        createdAt: new Date().toISOString()
    },
    {
        id: 4,
        title: 'Beat Title 4',
        genre: 'Pop',
        category: 'Pop',
        bpm: 120,
        key: 'G Major',
        duration: 210,
        price: 44.99,
        audioFile: null,
        createdAt: new Date().toISOString()
    }
];

const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: {
        user: 'your-email@gmail.com',
        pass: 'your-app-password'
    }
});

const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ message: 'Access denied' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ message: 'Invalid token' });
        }
        req.user = user;
        next();
    });
};

app.post('/api/auth/login', async (req, res) => {
    const { username, password } = req.body;

    const user = users.find(u => u.username === username);
    if (!user) {
        return res.status(401).json({ message: 'Invalid credentials' });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
        return res.status(401).json({ message: 'Invalid credentials' });
    }

    const token = jwt.sign(
        { id: user.id, username: user.username, role: user.role },
        JWT_SECRET,
        { expiresIn: '24h' }
    );

    res.json({
        token,
        user: {
            id: user.id,
            username: user.username,
            email: user.email,
            role: user.role
        }
    });
});

app.get('/api/users', authenticateToken, (req, res) => {
    const usersWithoutPasswords = users.map(({ password, ...user }) => user);
    res.json(usersWithoutPasswords);
});

app.post('/api/users', authenticateToken, async (req, res) => {
    const { username, email, password, role } = req.body;

    if (users.find(u => u.username === username)) {
        return res.status(400).json({ message: 'Username already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = {
        id: users.length + 1,
        username,
        email,
        password: hashedPassword,
        role: role || 'user',
        createdAt: new Date().toISOString()
    };

    users.push(newUser);
    const { password: _, ...userWithoutPassword } = newUser;
    res.status(201).json(userWithoutPassword);
});

app.put('/api/users/:id', authenticateToken, async (req, res) => {
    const userId = parseInt(req.params.id);
    const { username, email, password, role } = req.body;

    const userIndex = users.findIndex(u => u.id === userId);
    if (userIndex === -1) {
        return res.status(404).json({ message: 'User not found' });
    }

    if (username && users.find(u => u.username === username && u.id !== userId)) {
        return res.status(400).json({ message: 'Username already exists' });
    }

    if (username) users[userIndex].username = username;
    if (email) users[userIndex].email = email;
    if (password) users[userIndex].password = await bcrypt.hash(password, 10);
    if (role) users[userIndex].role = role;

    const { password: _, ...userWithoutPassword } = users[userIndex];
    res.json(userWithoutPassword);
});

app.delete('/api/users/:id', authenticateToken, (req, res) => {
    const userId = parseInt(req.params.id);
    const userIndex = users.findIndex(u => u.id === userId);

    if (userIndex === -1) {
        return res.status(404).json({ message: 'User not found' });
    }

    users.splice(userIndex, 1);
    res.json({ message: 'User deleted successfully' });
});

app.get('/api/beats', (req, res) => {
    res.json(beats);
});

app.post('/api/beats', authenticateToken, upload.single('audioFile'), (req, res) => {
    const { title, genre, category, bpm, key, duration, price } = req.body;

    const newBeat = {
        id: beats.length + 1,
        title,
        genre,
        category,
        bpm: parseInt(bpm),
        key,
        duration: parseInt(duration),
        price: parseFloat(price),
        audioFile: req.file ? `/uploads/${req.file.filename}` : null,
        createdAt: new Date().toISOString()
    };

    beats.push(newBeat);
    res.status(201).json(newBeat);
});

app.put('/api/beats/:id', authenticateToken, upload.single('audioFile'), (req, res) => {
    const beatId = parseInt(req.params.id);
    const { title, genre, category, bpm, key, duration, price } = req.body;

    const beatIndex = beats.findIndex(b => b.id === beatId);
    if (beatIndex === -1) {
        return res.status(404).json({ message: 'Beat not found' });
    }

    if (title) beats[beatIndex].title = title;
    if (genre) beats[beatIndex].genre = genre;
    if (category) beats[beatIndex].category = category;
    if (bpm) beats[beatIndex].bpm = parseInt(bpm);
    if (key) beats[beatIndex].key = key;
    if (duration) beats[beatIndex].duration = parseInt(duration);
    if (price) beats[beatIndex].price = parseFloat(price);
    if (req.file) beats[beatIndex].audioFile = `/uploads/${req.file.filename}`;

    res.json(beats[beatIndex]);
});

app.delete('/api/beats/:id', authenticateToken, (req, res) => {
    const beatId = parseInt(req.params.id);
    const beatIndex = beats.findIndex(b => b.id === beatId);

    if (beatIndex === -1) {
        return res.status(404).json({ message: 'Beat not found' });
    }

    beats.splice(beatIndex, 1);
    res.json({ message: 'Beat deleted successfully' });
});

app.post('/api/send-email', async (req, res) => {
    const { to, subject, text, html } = req.body;

    try {
        await transporter.sendMail({
            from: '"Doc Rolds" <your-email@gmail.com>',
            to,
            subject,
            text,
            html
        });
        res.json({ message: 'Email sent successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Failed to send email', error: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log('Default admin credentials:');
    console.log('Username: admin');
    console.log('Password: admin123');
});
