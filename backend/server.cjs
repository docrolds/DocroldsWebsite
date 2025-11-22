const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');
require('dotenv').config();

const prisma = new PrismaClient({
  adapter: new PrismaPg(
    new Pool({
      connectionString: process.env.DATABASE_URL,
    })
  ),
});
const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

const allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://127.0.0.1:3000',
    'https://docrolds-frontend.vercel.app',
    'https://docrolds.vercel.app',
    'https://www.docrolds.com',
    'https://docrolds.com'
];

app.use(cors({
    origin: function (origin, callback) {
        if (!origin || origin.includes('localhost') || origin.includes('127.0.0.1')) {
            callback(null, true);
        } else if (origin.includes('vercel.app')) {
            callback(null, true);
        } else if (origin.includes('docrolds')) {
            callback(null, true);
        } else if (allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(null, true);
        }
    },
    credentials: true
}));
app.use(express.json());
app.use('/uploads', express.static('uploads'));

if (!fs.existsSync('uploads')) {
    fs.mkdirSync('uploads');
}

const initializeDefaultData = async () => {
    try {
        console.log(`[INIT] Checking for admin user: ${ADMIN_USERNAME}`);
        const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, 10);
        await prisma.user.upsert({
            where: { username: ADMIN_USERNAME },
            update: { password: hashedPassword },
            create: {
                username: ADMIN_USERNAME,
                email: 'admin@docrolds.com',
                password: hashedPassword,
                role: 'admin'
            }
        });
        console.log(`[INIT] ✓ Default admin user configured: ${ADMIN_USERNAME}`);
    } catch (error) {
        console.error('[INIT] Error initializing default data:', error);
        console.error('[INIT] Error details:', error.message);
        if (error.code) {
            console.error('[INIT] Error code:', error.code);
        }
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

app.post('/api/auth/admin-setup', async (req, res) => {
    try {
        const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, 10);
        
        const result = await prisma.user.upsert({
            where: { username: ADMIN_USERNAME },
            update: {
                password: hashedPassword,
                email: 'admin@docrolds.com',
                role: 'admin'
            },
            create: {
                username: ADMIN_USERNAME,
                email: 'admin@docrolds.com',
                password: hashedPassword,
                role: 'admin'
            }
        });

        res.json({
            message: 'Admin user configured successfully',
            user: {
                id: result.id,
                username: result.username,
                email: result.email,
                role: result.role
            }
        });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

app.post('/api/auth/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ message: 'Username and password are required' });
        }

        console.log(`[LOGIN] Attempting login for username: ${username}`);
        console.log(`[LOGIN] Password provided: ${password ? 'yes' : 'no'}`);

        const user = await prisma.user.findUnique({
            where: { username }
        });
        
        if (!user) {
            console.log(`[LOGIN] User not found: ${username}`);
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        console.log(`[LOGIN] User found: ${user.username}, role: ${user.role}`);
        console.log(`[LOGIN] Comparing password...`);

        const validPassword = await bcrypt.compare(password, user.password);
        console.log(`[LOGIN] Password valid: ${validPassword}`);
        
        if (!validPassword) {
            console.log(`[LOGIN] Invalid password for user: ${username}`);
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        const token = jwt.sign(
            { id: user.id, username: user.username, role: user.role },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        console.log(`[LOGIN] Successful login for user: ${username}`);
        res.json({
            token,
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                role: user.role
            }
        });
    } catch (error) {
        console.error('[LOGIN] Error:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

app.get('/api/users', authenticateToken, async (req, res) => {
    try {
        const users = await prisma.user.findMany({
            select: {
                id: true,
                username: true,
                email: true,
                role: true,
                createdAt: true
            }
        });
        res.json(users);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

app.post('/api/users', authenticateToken, async (req, res) => {
    try {
        const { username, email, password, role } = req.body;

        const existingUser = await prisma.user.findUnique({
            where: { username }
        });
        if (existingUser) {
            return res.status(400).json({ message: 'Username already exists' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = await prisma.user.create({
            data: {
                username,
                email,
                password: hashedPassword,
                role: role || 'user'
            }
        });

        const { password: _, ...userResponse } = newUser;
        res.status(201).json(userResponse);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

app.put('/api/users/:id', authenticateToken, async (req, res) => {
    try {
        const { username, email, password, role } = req.body;
        const user = await prisma.user.findUnique({
            where: { id: req.params.id }
        });

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        if (username && username !== user.username) {
            const existing = await prisma.user.findUnique({
                where: { username }
            });
            if (existing) {
                return res.status(400).json({ message: 'Username already exists' });
            }
        }

        const updateData = {
            ...(username && { username }),
            ...(email && { email }),
            ...(role && { role })
        };

        if (password) {
            updateData.password = await bcrypt.hash(password, 10);
        }

        const updatedUser = await prisma.user.update({
            where: { id: req.params.id },
            data: updateData
        });

        const { password: _, ...userResponse } = updatedUser;
        res.json(userResponse);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

app.delete('/api/users/:id', authenticateToken, async (req, res) => {
    try {
        const user = await prisma.user.delete({
            where: { id: req.params.id }
        });
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
        const beats = await prisma.beat.findMany();
        if (beats.length === 0) {
            return res.json(mockBeats);
        }
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

        const newBeat = await prisma.beat.create({
            data: {
                title,
                genre,
                category,
                bpm: bpm ? parseInt(bpm) : null,
                key,
                duration: duration ? parseInt(duration) : null,
                price: price ? parseFloat(price) : null,
                audioFile,
                coverArt
            }
        });

        res.status(201).json(newBeat);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

app.put('/api/beats/:id', authenticateToken, upload.array('files', 2), async (req, res) => {
    try {
        const { title, genre, category, bpm, key, duration, price } = req.body;
        const beat = await prisma.beat.findUnique({
            where: { id: req.params.id }
        });

        if (!beat) {
            return res.status(404).json({ message: 'Beat not found' });
        }

        const updateData = {
            ...(title && { title }),
            ...(genre && { genre }),
            ...(category && { category }),
            ...(bpm && { bpm: parseInt(bpm) }),
            ...(key && { key }),
            ...(duration && { duration: parseInt(duration) }),
            ...(price && { price: parseFloat(price) })
        };

        if (req.files && req.files.length > 0) {
            for (const file of req.files) {
                if (file.mimetype.startsWith('audio/')) {
                    updateData.audioFile = `/uploads/${file.filename}`;
                } else if (file.mimetype.startsWith('image/')) {
                    const uploadPath = `uploads/covers/${file.filename}`;
                    const processedPath = await processCoverArt(uploadPath);
                    updateData.coverArt = processedPath.replace(/\\/g, '/');
                }
            }
        }

        const updatedBeat = await prisma.beat.update({
            where: { id: req.params.id },
            data: updateData
        });
        res.json(updatedBeat);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

app.delete('/api/beats/:id', authenticateToken, async (req, res) => {
    try {
        const beat = await prisma.beat.delete({
            where: { id: req.params.id }
        });
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
        const photos = await prisma.photo.findMany();
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

        const newPhoto = await prisma.photo.create({
            data: {
                name: name || 'Untitled Photo',
                role: role || '',
                credits: credits || '',
                category,
                description: description || '',
                photoFile: photoPath,
                displayOnHome: displayOnHome === 'true' || displayOnHome === true
            }
        });

        res.status(201).json(newPhoto);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

app.put('/api/photos/:id', authenticateToken, upload.single('photoFile'), async (req, res) => {
    try {
        const { name, role, credits, category, description, displayOnHome } = req.body;
        const photo = await prisma.photo.findUnique({
            where: { id: req.params.id }
        });

        if (!photo) {
            return res.status(404).json({ message: 'Photo not found' });
        }

        const updateData = {
            ...(name && { name }),
            ...(role && { role }),
            ...(credits && { credits }),
            ...(category && { category }),
            ...(description && { description }),
            ...(displayOnHome !== undefined && { displayOnHome: displayOnHome === 'true' || displayOnHome === true })
        };

        if (req.file) {
            const catToUse = category || photo.category;
            const uploadPath = `uploads/photos/${catToUse}/${req.file.filename}`;
            const processedPath = await processTeamPhoto(uploadPath);
            updateData.photoFile = processedPath.replace(/\\/g, '/');
        }

        const updatedPhoto = await prisma.photo.update({
            where: { id: req.params.id },
            data: updateData
        });
        res.json(updatedPhoto);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

app.delete('/api/photos/:id', authenticateToken, async (req, res) => {
    try {
        const photo = await prisma.photo.delete({
            where: { id: req.params.id }
        });
        if (!photo) {
            return res.status(404).json({ message: 'Photo not found' });
        }
        res.json({ message: 'Photo deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

const runMigrations = async () => {
    try {
        const { execSync } = require('child_process');
        console.log('[MIGRATE] Running database migrations...');
        console.log('[MIGRATE] DATABASE_URL exists:', !!process.env.DATABASE_URL);
        
        // Run migration with explicit error handling
        try {
            const output = execSync('npx prisma migrate deploy', { 
                stdio: 'pipe',
                encoding: 'utf8',
                cwd: __dirname
            });
            console.log('[MIGRATE] Output:', output);
            console.log('[MIGRATE] ✓ Migrations completed successfully');
        } catch (migrateError) {
            console.error('[MIGRATE] Migration command failed:');
            console.error('[MIGRATE] Error message:', migrateError.message);
            if (migrateError.stdout) console.error('[MIGRATE] stdout:', migrateError.stdout.toString());
            if (migrateError.stderr) console.error('[MIGRATE] stderr:', migrateError.stderr.toString());
            throw migrateError;
        }
    } catch (error) {
        console.error('[MIGRATE] Migration error:', error.message);
        console.error('[MIGRATE] Full error:', error);
        // Don't continue - we need migrations to succeed
        throw error;
    }
};

app.listen(PORT, async () => {
    try {
        console.log('[STARTUP] Starting server initialization...');
        // Run migrations before initializing data
        console.log('[STARTUP] Step 1: Running migrations...');
        await runMigrations();
        console.log('[STARTUP] Step 2: Initializing default data...');
        await initializeDefaultData();
        console.log(`[STARTUP] ✓ Server running on http://localhost:${PORT}`);
        console.log('✓ Connected to PostgreSQL');
    } catch (error) {
        console.error('[STARTUP] Server startup error:', error);
        console.error('[STARTUP] Error stack:', error.stack);
        // Don't exit - let the server start anyway for debugging
    }
});
