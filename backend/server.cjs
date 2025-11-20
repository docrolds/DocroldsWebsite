const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');
const mongoose = require('mongoose');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const MONGODB_URI = process.env.MONGODB_URI;

// Define allowed origins for CORS
const allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://127.0.0.1:3000',
    'https://docrolds-frontend.vercel.app',
    'https://www.docrolds.com'
];

app.use(cors({
    origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true
}));
app.use(express.json());
app.use('/uploads', express.static('uploads'));

if (!fs.existsSync('uploads')) {
    fs.mkdirSync('uploads');
}

let mongoConnected = false;

if (MONGODB_URI) {
    mongoose.connect(MONGODB_URI, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
        serverSelectionTimeoutMS: 5000,
        connectTimeoutMS: 5000,
        socketTimeoutMS: 5000
    }).then(() => {
        mongoConnected = true;
        console.log('Connected to MongoDB');
    }).catch(err => {
        console.error('MongoDB connection error:', err.message);
        console.warn('Continuing without MongoDB - some features may not work');
    });
} else {
    console.warn('No MONGODB_URI set - database features will not work');
}

const userSchema = new mongoose.Schema({
    username: { type: String, unique: true, required: true },
    email: String,
    password: { type: String, required: true },
    role: { type: String, default: 'user' },
    createdAt: { type: Date, default: Date.now }
});

const beatSchema = new mongoose.Schema({
    title: String,
    genre: String,
    category: String,
    bpm: Number,
    key: String,
    duration: Number,
    price: Number,
    audioFile: String,
    coverArt: String,
    createdAt: { type: Date, default: Date.now }
});

const photoSchema = new mongoose.Schema({
    name: String,
    role: String,
    credits: String,
    category: String,
    description: String,
    photoFile: String,
    displayOnHome: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);
const Beat = mongoose.model('Beat', beatSchema);
const Photo = mongoose.model('Photo', photoSchema);

const initializeDefaultData = async () => {
    try {
        const adminExists = await User.findOne({ username: 'admin' });
        if (!adminExists) {
            const hashedPassword = await bcrypt.hash('admin123', 10);
            await User.create({
                username: 'admin',
                email: 'admin@docrolds.com',
                password: hashedPassword,
                role: 'admin'
            });
            console.log('Default admin user created');
        }
    } catch (error) {
        console.error('Error initializing default data:', error);
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
    try {
        const { username, password } = req.body;

        const user = await User.findOne({ username });
        if (!user) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        const token = jwt.sign(
            { id: user._id, username: user.username, role: user.role },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.json({
            token,
            user: {
                id: user._id,
                username: user.username,
                email: user.email,
                role: user.role
            }
        });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

app.get('/api/users', authenticateToken, async (req, res) => {
    try {
        const users = await User.find().select('-password');
        res.json(users);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

app.post('/api/users', authenticateToken, async (req, res) => {
    try {
        const { username, email, password, role } = req.body;

        const existingUser = await User.findOne({ username });
        if (existingUser) {
            return res.status(400).json({ message: 'Username already exists' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = new User({
            username,
            email,
            password: hashedPassword,
            role: role || 'user'
        });

        await newUser.save();
        const userResponse = newUser.toObject();
        delete userResponse.password;
        res.status(201).json(userResponse);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

app.put('/api/users/:id', authenticateToken, async (req, res) => {
    try {
        const { username, email, password, role } = req.body;
        const user = await User.findById(req.params.id);

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        if (username && username !== user.username) {
            const existing = await User.findOne({ username });
            if (existing) {
                return res.status(400).json({ message: 'Username already exists' });
            }
            user.username = username;
        }

        if (email) user.email = email;
        if (password) user.password = await bcrypt.hash(password, 10);
        if (role) user.role = role;

        await user.save();
        const userResponse = user.toObject();
        delete userResponse.password;
        res.json(userResponse);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

app.delete('/api/users/:id', authenticateToken, async (req, res) => {
    try {
        const user = await User.findByIdAndDelete(req.params.id);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        res.json({ message: 'User deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

const mockBeats = [
    { title: 'Midnight Vibes', genre: 'Hip-Hop', category: 'Hip-Hop', bpm: 92, key: 'C Minor', duration: 165 },
    { title: 'Bass Trap', genre: 'Trap', category: 'Trap', bpm: 140, key: 'A Minor', duration: 180 },
    { title: 'Smooth Flows', genre: 'R&B', category: 'R&B', bpm: 95, key: 'F Major', duration: 200 },
    { title: 'Electric Dreams', genre: 'Pop', category: 'Pop', bpm: 120, key: 'G Major', duration: 210 }
];

app.get('/api/beats', async (req, res) => {
    try {
        if (!mongoConnected) {
            return res.json(mockBeats);
        }
        const beats = await Beat.find();
        res.json(beats);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

app.post('/api/beats', authenticateToken, upload.array('files', 2), async (req, res) => {
    try {
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

        const newBeat = new Beat({
            title,
            genre,
            category,
            bpm: parseInt(bpm),
            key,
            duration: parseInt(duration),
            price: parseFloat(price),
            audioFile,
            coverArt
        });

        await newBeat.save();
        res.status(201).json(newBeat);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

app.put('/api/beats/:id', authenticateToken, upload.array('files', 2), async (req, res) => {
    try {
        const { title, genre, category, bpm, key, duration, price } = req.body;
        const beat = await Beat.findById(req.params.id);

        if (!beat) {
            return res.status(404).json({ message: 'Beat not found' });
        }

        if (title) beat.title = title;
        if (genre) beat.genre = genre;
        if (category) beat.category = category;
        if (bpm) beat.bpm = parseInt(bpm);
        if (key) beat.key = key;
        if (duration) beat.duration = parseInt(duration);
        if (price) beat.price = parseFloat(price);

        if (req.files && req.files.length > 0) {
            for (const file of req.files) {
                if (file.mimetype.startsWith('audio/')) {
                    beat.audioFile = `/uploads/${file.filename}`;
                } else if (file.mimetype.startsWith('image/')) {
                    const uploadPath = `uploads/covers/${file.filename}`;
                    const processedPath = await processCoverArt(uploadPath);
                    beat.coverArt = processedPath.replace(/\\/g, '/');
                }
            }
        }

        await beat.save();
        res.json(beat);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

app.delete('/api/beats/:id', authenticateToken, async (req, res) => {
    try {
        const beat = await Beat.findByIdAndDelete(req.params.id);
        if (!beat) {
            return res.status(404).json({ message: 'Beat not found' });
        }
        res.json({ message: 'Beat deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

app.get('/api/photos', async (req, res) => {
    try {
        const photos = await Photo.find();
        res.json(photos);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

app.post('/api/photos', authenticateToken, upload.single('photoFile'), async (req, res) => {
    try {
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

        const newPhoto = new Photo({
            name: name || 'Untitled Photo',
            role: role || '',
            credits: credits || '',
            category,
            description: description || '',
            photoFile: photoPath,
            displayOnHome: displayOnHome === 'true' || displayOnHome === true
        });

        await newPhoto.save();
        res.status(201).json(newPhoto);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

app.put('/api/photos/:id', authenticateToken, upload.single('photoFile'), async (req, res) => {
    try {
        const { name, role, credits, category, description, displayOnHome } = req.body;
        const photo = await Photo.findById(req.params.id);

        if (!photo) {
            return res.status(404).json({ message: 'Photo not found' });
        }

        if (name) photo.name = name;
        if (role) photo.role = role;
        if (credits) photo.credits = credits;
        if (category) photo.category = category;
        if (description) photo.description = description;
        if (displayOnHome !== undefined) {
            photo.displayOnHome = displayOnHome === 'true' || displayOnHome === true;
        }

        if (req.file) {
            const catToUse = category || photo.category;
            const uploadPath = `uploads/photos/${catToUse}/${req.file.filename}`;
            const processedPath = await processTeamPhoto(uploadPath);
            photo.photoFile = processedPath.replace(/\\/g, '/');
        }

        await photo.save();
        res.json(photo);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

app.delete('/api/photos/:id', authenticateToken, async (req, res) => {
    try {
        const photo = await Photo.findByIdAndDelete(req.params.id);
        if (!photo) {
            return res.status(404).json({ message: 'Photo not found' });
        }
        res.json({ message: 'Photo deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

app.listen(PORT, async () => {
    if (mongoConnected) {
        await initializeDefaultData();
    }
    console.log(`Server running on http://localhost:${PORT}`);
    if (mongoConnected) {
        console.log('✓ Connected to MongoDB');
    } else {
        console.log('⚠ Running without MongoDB - database features disabled');
    }
});
