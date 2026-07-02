const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const DATA_FILE = 'data.json';

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static('uploads'));

if (!fs.existsSync('uploads')) {
    fs.mkdirSync('uploads');
}

const loadData = () => {
    try {
        if (fs.existsSync(DATA_FILE)) {
            const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
            return data;
        }
    } catch (error) {
        console.error('Error loading data:', error);
    }
    return null;
};

const saveData = (data) => {
    try {
        fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
    } catch (error) {
        console.error('Error saving data:', error);
    }
};

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        let uploadDir = 'uploads/';
        
        if (file.mimetype.startsWith('audio/')) {
            uploadDir = 'uploads/';
        } else if (file.mimetype.startsWith('image/')) {
            if (req.body.category) {
                uploadDir = `uploads/photos/${req.body.category}/`;
            } else {
                uploadDir = 'uploads/covers/';
            }
            if (!fs.existsSync(uploadDir)) {
                fs.mkdirSync(uploadDir, { recursive: true });
            }
        }
        
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + file.originalname);
    }
});

const upload = multer({ 
    storage,
    fileFilter: (req, file, cb) => {
        const allowedAudio = ['audio/mpeg', 'audio/wav', 'audio/mp4', 'audio/ogg'];
        const allowedImage = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
        
        if (allowedAudio.includes(file.mimetype) || allowedImage.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type'));
        }
    }
});

async function processTeamPhoto(filePath) {
    try {
        const processedPath = filePath.replace(/\.[^.]+$/, '-processed.webp');
        await sharp(filePath)
            .resize(500, 500, {
                fit: 'cover',
                position: 'center'
            })
            .webp({ quality: 80 })
            .toFile(processedPath);
        
        fs.unlinkSync(filePath);
        return processedPath;
    } catch (error) {
        console.error('Error processing photo:', error);
        return filePath;
    }
}

async function processCoverArt(filePath) {
    try {
        const processedPath = filePath.replace(/\.[^.]+$/, '-processed.webp');
        await sharp(filePath)
            .resize(800, 800, {
                fit: 'cover',
                position: 'center'
            })
            .webp({ quality: 85 })
            .toFile(processedPath);
        
        fs.unlinkSync(filePath);
        return processedPath;
    } catch (error) {
        console.error('Error processing cover art:', error);
        return filePath;
    }
}

const defaultData = {
    users: [
        {
            id: 1,
            username: 'admin',
            password: bcrypt.hashSync('admin123', 10),
            email: 'admin@docrolds.com',
            role: 'admin',
            createdAt: new Date().toISOString()
        }
    ],
    beats: [
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
    ],
    photos: []
};

const persistedData = loadData() || defaultData;
let users = persistedData.users;
let beats = persistedData.beats;
let photos = persistedData.photos;

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
    saveData({ users, beats, photos });
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
    saveData({ users, beats, photos });
    res.json(userWithoutPassword);
});

app.delete('/api/users/:id', authenticateToken, (req, res) => {
    const userId = parseInt(req.params.id);
    const userIndex = users.findIndex(u => u.id === userId);

    if (userIndex === -1) {
        return res.status(404).json({ message: 'User not found' });
    }

    users.splice(userIndex, 1);
    saveData({ users, beats, photos });
    res.json({ message: 'User deleted successfully' });
});

app.get('/api/beats', (req, res) => {
    res.json(beats);
});

app.post('/api/beats', authenticateToken, upload.array('files', 2), async (req, res) => {
    const { title, genre, category, bpm, key, duration, price } = req.body;

    let audioFile = null;
    let coverArt = null;

    if (req.files) {
        for (const file of req.files) {
            if (file.mimetype.startsWith('audio/')) {
                audioFile = `/uploads/${file.filename}`;
            } else if (file.mimetype.startsWith('image/')) {
                const uploadPath = `uploads/covers/${file.filename}`;
                const processedPath = await processCoverArt(uploadPath);
                coverArt = processedPath.replace(/\\/g, '/');
            }
        }
    }

    const newBeat = {
        id: beats.length + 1,
        title,
        genre,
        category,
        bpm: parseInt(bpm),
        key,
        duration: parseInt(duration),
        price: parseFloat(price),
        audioFile: audioFile,
        coverArt: coverArt,
        createdAt: new Date().toISOString()
    };

    beats.push(newBeat);
    saveData({ users, beats, photos });
    res.status(201).json(newBeat);
});

app.put('/api/beats/:id', authenticateToken, upload.array('files', 2), async (req, res) => {
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

    if (req.files && req.files.length > 0) {
        for (const file of req.files) {
            if (file.mimetype.startsWith('audio/')) {
                beats[beatIndex].audioFile = `/uploads/${file.filename}`;
            } else if (file.mimetype.startsWith('image/')) {
                const uploadPath = `uploads/covers/${file.filename}`;
                const processedPath = await processCoverArt(uploadPath);
                beats[beatIndex].coverArt = processedPath.replace(/\\/g, '/');
            }
        }
    }

    saveData({ users, beats, photos });
    res.json(beats[beatIndex]);
});

app.delete('/api/beats/:id', authenticateToken, (req, res) => {
    const beatId = parseInt(req.params.id);
    const beatIndex = beats.findIndex(b => b.id === beatId);

    if (beatIndex === -1) {
        return res.status(404).json({ message: 'Beat not found' });
    }

    beats.splice(beatIndex, 1);
    saveData({ users, beats, photos });
    res.json({ message: 'Beat deleted successfully' });
});

app.get('/api/photos', (req, res) => {
    res.json(photos);
});

app.post('/api/photos', authenticateToken, upload.single('photoFile'), async (req, res) => {
    const { name, role, credits, category, description, displayOnHome } = req.body;

    if (!category) {
        return res.status(400).json({ message: 'Category is required' });
    }

    let photoPath = null;
    if (req.file) {
        const uploadPath = `uploads/photos/${category}/${req.file.filename}`;
        const processedPath = await processTeamPhoto(uploadPath);
        photoPath = processedPath.replace(/\\/g, '/');
    }

    const newPhoto = {
        id: photos.length + 1,
        name: name || 'Untitled Photo',
        role: role || '',
        credits: credits || '',
        category: category,
        description: description || '',
        photoFile: photoPath,
        displayOnHome: displayOnHome === 'true' || displayOnHome === true,
        createdAt: new Date().toISOString()
    };

    photos.push(newPhoto);
    saveData({ users, beats, photos });
    res.status(201).json(newPhoto);
});

app.put('/api/photos/:id', authenticateToken, upload.single('photoFile'), async (req, res) => {
    const photoId = parseInt(req.params.id);
    const { name, role, credits, category, description, displayOnHome } = req.body;

    const photoIndex = photos.findIndex(p => p.id === photoId);
    if (photoIndex === -1) {
        return res.status(404).json({ message: 'Photo not found' });
    }

    if (name) photos[photoIndex].name = name;
    if (role) photos[photoIndex].role = role;
    if (credits) photos[photoIndex].credits = credits;
    if (category) photos[photoIndex].category = category;
    if (description) photos[photoIndex].description = description;
    if (displayOnHome !== undefined) {
        photos[photoIndex].displayOnHome = displayOnHome === 'true' || displayOnHome === true;
    } else {
        photos[photoIndex].displayOnHome = photos[photoIndex].displayOnHome || false;
    }
    
    if (req.file) {
        const catToUse = category || photos[photoIndex].category;
        const uploadPath = `uploads/photos/${catToUse}/${req.file.filename}`;
        const processedPath = await processTeamPhoto(uploadPath);
        photos[photoIndex].photoFile = processedPath.replace(/\\/g, '/');
    }

    saveData({ users, beats, photos });
    res.json(photos[photoIndex]);
});

app.delete('/api/photos/:id', authenticateToken, (req, res) => {
    const photoId = parseInt(req.params.id);
    const photoIndex = photos.findIndex(p => p.id === photoId);

    if (photoIndex === -1) {
        return res.status(404).json({ message: 'Photo not found' });
    }

    photos.splice(photoIndex, 1);
    saveData({ users, beats, photos });
    res.json({ message: 'Photo deleted successfully' });
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log('Default admin credentials:');
    console.log('Username: admin');
    console.log('Password: admin123');
});
