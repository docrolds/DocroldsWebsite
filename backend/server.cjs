const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');
const nodemailer = require('nodemailer');
const sgMail = require('@sendgrid/mail');
const { PrismaClient } = require('@prisma/client');
const { SquareClient, SquareEnvironment } = require('square');
const mm = require('music-metadata');
require('dotenv').config();

// Initialize SendGrid if API key is available
if (process.env.SENDGRID_API_KEY) {
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);
    console.log('[EMAIL] SendGrid initialized');
}

// Initialize Square
const squareClient = new SquareClient({
    token: process.env.SQUARE_ACCESS_TOKEN,
    environment: process.env.SQUARE_ENVIRONMENT === 'production'
        ? SquareEnvironment.Production
        : SquareEnvironment.Sandbox
});
console.log('[SQUARE] Square client initialized in', process.env.SQUARE_ENVIRONMENT || 'sandbox', 'mode');

const prisma = new PrismaClient();
const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_CUSTOMER_SECRET = process.env.JWT_CUSTOMER_SECRET || 'customer-jwt-secret-change-in-production';
const ADMIN_USERNAME = process.env.ADMIN_USERNAME;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

if (!ADMIN_USERNAME || !ADMIN_PASSWORD) {
    console.error('[SECURITY] ADMIN_USERNAME and ADMIN_PASSWORD must be set in environment variables');
    process.exit(1);
}
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
const DOWNLOAD_LINK_EXPIRY_DAYS = parseInt(process.env.DOWNLOAD_LINK_EXPIRY_DAYS) || 7;

const allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://127.0.0.1:3000',
    'https://docrolds-frontend.vercel.app',
    'https://docrolds.vercel.app',
    'https://livedeployment.vercel.app',
    'https://www.docrolds.com',
    'https://docrolds.com',
    'https://api.docrolds.com'
];

// Security middleware
app.use(helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// Rate limiter for login attempts
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 attempts per window
    message: { message: 'Too many login attempts, please try again after 15 minutes' },
    standardHeaders: true,
    legacyHeaders: false
});

// CORS configuration - only allow known origins
app.use(cors({
    origin: function (origin, callback) {
        // Allow requests with no origin (mobile apps, Postman, etc.)
        if (!origin) {
            callback(null, true);
            return;
        }
        // Allow localhost for development
        if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
            callback(null, true);
            return;
        }
        // Check if origin is in allowed list
        if (allowedOrigins.includes(origin)) {
            callback(null, true);
            return;
        }
        // Reject unknown origins
        callback(new Error('Not allowed by CORS'));
    },
    credentials: true
}));

// Square webhook (optional - for refunds/disputes)
app.post('/api/webhooks/square', express.json(), async (req, res) => {
    console.log('[SQUARE WEBHOOK] Event received:', req.body.type);
    // Square webhooks can be added later for refunds, disputes, etc.
    res.json({ received: true });
});

app.use(express.json());
app.use('/uploads', express.static('uploads'));

if (!fs.existsSync('uploads')) {
    fs.mkdirSync('uploads');
}

// Helper to sanitize filenames
const sanitizeFilename = (filename) => {
    return filename.replace(/[^a-zA-Z0-9._-]/g, '_').substring(0, 200);
};

// Helper to escape HTML for email templates
const escapeHtml = (text) => {
    if (!text) return '';
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
};

// Email validation helper
const isValidEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
};

const initializeDefaultData = async () => {
    try {
        console.log('[INIT] Checking for admin user...');
        console.log('[INIT] Admin username:', ADMIN_USERNAME);
        console.log('[INIT] Admin password length:', ADMIN_PASSWORD.length);
        const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, 10);
        console.log('[INIT] Hashed password generated');
        const result = await prisma.user.upsert({
            where: { username: ADMIN_USERNAME },
            update: { password: hashedPassword, email: ADMIN_USERNAME },
            create: {
                username: ADMIN_USERNAME,
                email: ADMIN_USERNAME,
                password: hashedPassword,
                role: 'admin'
            }
        });
        console.log('[INIT] ✓ Default admin user configured, id:', result.id);
    } catch (error) {
        console.error('[INIT] Error initializing default data:', error.message);
        console.error('[INIT] Full error:', error);
    }
};

// Disk storage for audio files (beats)
const diskStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        let uploadDir = 'uploads/';
        
        if (file.mimetype.startsWith('audio/')) {
            uploadDir = 'uploads/';
        } else if (file.mimetype.startsWith('image/')) {
            uploadDir = 'uploads/covers/';
            if (!fs.existsSync(uploadDir)) {
                fs.mkdirSync(uploadDir, { recursive: true });
            }
        }
        
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + sanitizeFilename(file.originalname));
    }
});

// Memory storage for photos (stored in database)
const memoryStorage = multer.memoryStorage();

// Upload for photos (memory storage)
const upload = multer({ 
    storage: memoryStorage,
    fileFilter: (req, file, cb) => {
        const allowedImage = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
        
        if (allowedImage.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type'));
        }
    }
});

// Upload for beats (disk storage)
const uploadBeats = multer({ 
    storage: diskStorage,
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

async function processPhotoToBase64(buffer, width = 500, height = 500, quality = 80) {
    try {
        const processedBuffer = await sharp(buffer)
            .resize(width, height, {
                fit: 'cover',
                position: 'center'
            })
            .webp({ quality })
            .toBuffer();
        
        return `data:image/webp;base64,${processedBuffer.toString('base64')}`;
    } catch (error) {
        console.error('Error processing photo:', error);
        throw error;
    }
}

async function processCoverArtToBase64(buffer) {
    return processPhotoToBase64(buffer, 800, 800, 85);
}

async function processTeamPhotoToBase64(buffer) {
    return processPhotoToBase64(buffer, 500, 500, 80);
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

// Protected: Only works if no admin exists yet
app.post('/api/auth/admin-setup', async (req, res) => {
    try {
        // Check if admin already exists
        const existingAdmin = await prisma.user.findFirst({
            where: { role: 'admin' }
        });

        if (existingAdmin) {
            return res.status(403).json({ message: 'Admin already configured. Use admin panel to manage users.' });
        }

        const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, 10);

        const result = await prisma.user.create({
            data: {
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

// Rate limited login endpoint
app.post('/api/auth/login', loginLimiter, async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ message: 'Username and password are required' });
        }

        const user = await prisma.user.findUnique({
            where: { username }
        });

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
    } catch (error) {
        console.error('[LOGIN] Server error');
        res.status(500).json({ message: 'Server error' });
    }
});

// Unified login endpoint - checks both Admin (User) and Customer tables
app.post('/api/auth/unified-login', loginLimiter, async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ message: 'Email and password are required' });
        }

        // First, check if it's an admin user (by username or email)
        const adminUser = await prisma.user.findFirst({
            where: {
                OR: [
                    { username: email },
                    { email: email }
                ]
            }
        });

        if (adminUser) {
            const validPassword = await bcrypt.compare(password, adminUser.password);
            if (validPassword) {
                const token = jwt.sign(
                    { id: adminUser.id, username: adminUser.username, role: adminUser.role },
                    JWT_SECRET,
                    { expiresIn: '24h' }
                );

                return res.json({
                    token,
                    role: 'admin',
                    user: {
                        id: adminUser.id,
                        username: adminUser.username,
                        email: adminUser.email,
                        role: adminUser.role
                    }
                });
            }
        }

        // If not admin, check customer table
        const customer = await prisma.customer.findUnique({
            where: { email }
        });

        if (customer && !customer.isGuest && customer.password) {
            // Check if customer is blocked
            if (customer.isBlocked) {
                return res.status(403).json({
                    message: 'Account blocked',
                    reason: customer.blockedReason || 'Your account has been blocked. Please contact support.'
                });
            }

            const validPassword = await bcrypt.compare(password, customer.password);
            if (validPassword) {
                const token = jwt.sign(
                    { id: customer.id, email: customer.email },
                    JWT_CUSTOMER_SECRET,
                    { expiresIn: '7d' }
                );

                return res.json({
                    token,
                    role: 'customer',
                    customer: {
                        id: customer.id,
                        email: customer.email,
                        firstName: customer.firstName,
                        lastName: customer.lastName,
                        stageName: customer.stageName,
                        profilePicture: customer.profilePicture
                    }
                });
            }
        }

        // No match found
        return res.status(401).json({ message: 'Invalid credentials' });

    } catch (error) {
        console.error('[UNIFIED LOGIN] Server error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Admin authorization middleware
const requireAdmin = (req, res, next) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Admin access required' });
    }
    next();
};

// Admin-only: Get all users
app.get('/api/users', authenticateToken, requireAdmin, async (req, res) => {
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

// Admin-only: Create user with validation
app.post('/api/users', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { username, email, password, role } = req.body;

        // Input validation
        if (!username || username.length < 3) {
            return res.status(400).json({ message: 'Username must be at least 3 characters' });
        }
        if (!password || password.length < 6) {
            return res.status(400).json({ message: 'Password must be at least 6 characters' });
        }
        if (email && !isValidEmail(email)) {
            return res.status(400).json({ message: 'Invalid email format' });
        }

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

// Admin-only: Update user with validation
app.put('/api/users/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { username, email, password, role } = req.body;
        const user = await prisma.user.findUnique({
            where: { id: req.params.id }
        });

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Input validation
        if (username && username.length < 3) {
            return res.status(400).json({ message: 'Username must be at least 3 characters' });
        }
        if (password && password.length < 6) {
            return res.status(400).json({ message: 'Password must be at least 6 characters' });
        }
        if (email && !isValidEmail(email)) {
            return res.status(400).json({ message: 'Invalid email format' });
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

// Admin-only: Delete user
app.delete('/api/users/:id', authenticateToken, requireAdmin, async (req, res) => {
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

app.get('/api/team', async (req, res) => {
    try {
        // Fetch team members from Photo model (where admin uploads them)
        // Filter by category='team' and displayOnHome=true for public display
        const teamMembers = await prisma.photo.findMany({
            where: {
                category: 'team',
                displayOnHome: true
            },
            orderBy: {
                createdAt: 'desc'
            }
        });

        // Map to consistent format for frontend
        const formattedTeam = teamMembers.map(member => ({
            id: member.id,
            name: member.name,
            role: member.role,
            bio: member.description,
            credits: member.credits,
            placements: member.placements,
            photoData: member.photoData,
            photoUrl: member.photoFile,
            displayOnHome: member.displayOnHome,
            createdAt: member.createdAt
        }));

        res.json(formattedTeam);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

app.post('/api/team', authenticateToken, upload.single('photo'), async (req, res) => {
    try {
        const { name, role, bio } = req.body;
        const photoUrl = req.file ? `/uploads/team/${req.file.filename}` : '';

        const newTeamMember = await prisma.teamMember.create({
            data: {
                name,
                role,
                bio,
                photoUrl
            }
        });

        res.status(201).json(newTeamMember);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

app.put('/api/team/:id', authenticateToken, upload.single('photo'), async (req, res) => {
    try {
        const { name, role, bio } = req.body;
        let photoUrl = req.body.photoUrl;

        if (req.file) {
            photoUrl = `/uploads/team/${req.file.filename}`;
        }

        const updatedTeamMember = await prisma.teamMember.update({
            where: { id: req.params.id },
            data: {
                name,
                role,
                bio,
                photoUrl
            }
        });

        res.json(updatedTeamMember);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

app.delete('/api/team/:id', authenticateToken, async (req, res) => {
    try {
        await prisma.teamMember.delete({
            where: { id: req.params.id }
        });
        res.json({ message: 'Team member deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

app.get('/api/content', async (req, res) => {
    try {
        const content = await prisma.content.findMany();
        const contentMap = content.reduce((acc, item) => {
            acc[item.key] = item.value;
            return acc;
        }, {});
        res.json(contentMap);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

app.put('/api/content/:key', authenticateToken, async (req, res) => {
    try {
        const { key } = req.params;
        const { value } = req.body;

        const updatedContent = await prisma.content.update({
            where: { key },
            data: { value },
        });

        res.json(updatedContent.value);
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

// Photo endpoints with database storage
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
        const { name, role, credits, placements, category, description, displayOnHome } = req.body;

        if (!category) {
            return res.status(400).json({ message: 'Category is required' });
        }

        let photoData = null;
        let mimeType = null;

        if (req.file) {
            mimeType = req.file.mimetype;
            photoData = await processTeamPhotoToBase64(req.file.buffer);
        }

        const newPhoto = await prisma.photo.create({
            data: {
                name: name || 'Untitled Photo',
                role: role || '',
                credits: credits || '',
                placements: placements || '',
                category,
                description: description || '',
                photoData,
                mimeType,
                displayOnHome: displayOnHome === 'true' || displayOnHome === true
            }
        });

        res.status(201).json(newPhoto);
    } catch (error) {
        console.error('Photo upload error:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

app.put('/api/photos/:id', authenticateToken, upload.single('photoFile'), async (req, res) => {
    try {
        const { name, role, credits, placements, category, description, displayOnHome } = req.body;
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
            ...(placements !== undefined && { placements }),
            ...(category && { category }),
            ...(description && { description }),
            ...(displayOnHome !== undefined && { displayOnHome: displayOnHome === 'true' || displayOnHome === true })
        };

        if (req.file) {
            updateData.photoData = await processTeamPhotoToBase64(req.file.buffer);
            updateData.mimeType = req.file.mimetype;
        }

        const updatedPhoto = await prisma.photo.update({
            where: { id: req.params.id },
            data: updateData
        });
        
        res.json(updatedPhoto);
    } catch (error) {
        console.error('Photo update error:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

app.delete('/api/photos/:id', authenticateToken, async (req, res) => {
    try {
        await prisma.photo.delete({
            where: { id: req.params.id }
        });
        res.json({ message: 'Photo deleted successfully' });
    } catch (error) {
        console.error('Photo delete error:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// Helper function to extract audio duration from file
async function getAudioDuration(filePath) {
    try {
        const fullPath = path.join(__dirname, filePath);
        const metadata = await mm.parseFile(fullPath);
        // Return duration in seconds (rounded to nearest integer)
        return Math.round(metadata.format.duration || 0);
    } catch (error) {
        console.error('[AUDIO DURATION] Error extracting duration:', error.message);
        return null;
    }
}

app.get('/api/beats', async (req, res) => {
    try {
        const beats = await prisma.beat.findMany({
            include: {
                _count: {
                    select: {
                        likes: true,
                        comments: true
                    }
                }
            }
        });
        if (beats.length === 0) {
            return res.json(mockBeats);
        }
        // Transform _count to likeCount and commentCount for easier frontend usage
        const beatsWithCounts = beats.map(beat => ({
            ...beat,
            likeCount: beat._count.likes,
            commentCount: beat._count.comments,
            _count: undefined
        }));
        res.json(beatsWithCounts);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

app.post('/api/beats', authenticateToken, uploadBeats.fields([
    { name: 'audioFile', maxCount: 1 },
    { name: 'wavFile', maxCount: 1 },
    { name: 'coverArt', maxCount: 1 }
]), async (req, res) => {
    try {
        const { title, genre, category, bpm, key, duration, price, producedBy, soldExclusively, soldExclusivelyTo } = req.body;

        console.log('[BEAT CREATE] Received data:', { title, genre, category, bpm, key, duration, price, producedBy, soldExclusively, soldExclusivelyTo });

        let audioFile = null;
        let wavFile = null;
        let coverArt = null;
        let extractedDuration = duration ? parseInt(duration) : null;

        if (req.files) {
            // Handle MP3 preview file
            if (req.files.audioFile && req.files.audioFile[0]) {
                audioFile = `/uploads/${req.files.audioFile[0].filename}`;

                // Auto-extract duration from audio file if not provided
                if (!extractedDuration) {
                    extractedDuration = await getAudioDuration(audioFile);
                    console.log('[BEAT CREATE] Auto-extracted duration:', extractedDuration, 'seconds');
                }
            }

            // Handle WAV file
            if (req.files.wavFile && req.files.wavFile[0]) {
                wavFile = `/uploads/${req.files.wavFile[0].filename}`;

                // If no duration yet, try to extract from WAV file
                if (!extractedDuration) {
                    extractedDuration = await getAudioDuration(wavFile);
                    console.log('[BEAT CREATE] Auto-extracted duration from WAV:', extractedDuration, 'seconds');
                }
            }

            // Handle cover art
            if (req.files.coverArt && req.files.coverArt[0]) {
                const uploadPath = `uploads/covers/${req.files.coverArt[0].filename}`;
                const processedPath = await processCoverArt(uploadPath);
                coverArt = processedPath.replace(/\\/g, '/');
            }
        }

        const isSoldExclusively = soldExclusively === 'true' || soldExclusively === true;

        const newBeat = await prisma.beat.create({
            data: {
                title,
                genre,
                category,
                bpm: bpm ? parseInt(bpm) : null,
                key,
                duration: extractedDuration,
                price: price ? parseFloat(price) : null,
                producedBy: producedBy && producedBy.trim() ? producedBy.trim() : null,
                audioFile,
                wavFile,
                coverArt,
                soldExclusively: isSoldExclusively,
                soldExclusivelyAt: isSoldExclusively ? new Date() : null,
                soldExclusivelyTo: isSoldExclusively && soldExclusivelyTo ? soldExclusivelyTo.trim() : null
            }
        });

        console.log('[BEAT CREATE] Created beat:', newBeat);
        res.status(201).json(newBeat);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

app.put('/api/beats/:id', authenticateToken, uploadBeats.fields([
    { name: 'audioFile', maxCount: 1 },
    { name: 'wavFile', maxCount: 1 },
    { name: 'coverArt', maxCount: 1 }
]), async (req, res) => {
    try {
        const { title, genre, category, bpm, key, duration, price, producedBy, soldExclusively, soldExclusivelyTo } = req.body;

        console.log('[BEAT UPDATE] Received data:', { title, genre, category, bpm, key, duration, price, producedBy, soldExclusively, soldExclusivelyTo });

        const beat = await prisma.beat.findUnique({
            where: { id: req.params.id }
        });

        if (!beat) {
            return res.status(404).json({ message: 'Beat not found' });
        }

        const isSoldExclusively = soldExclusively === 'true' || soldExclusively === true;
        const wasSoldExclusively = beat.soldExclusively;

        const updateData = {
            ...(title && { title }),
            ...(genre && { genre }),
            ...(category && { category }),
            ...(bpm && { bpm: parseInt(bpm) }),
            ...(key && { key }),
            ...(duration && { duration: parseInt(duration) }),
            ...(price && { price: parseFloat(price) }),
            // Handle producedBy - allow empty string to clear, keep existing if undefined
            producedBy: producedBy !== undefined ? (producedBy.trim() || null) : beat.producedBy,
            // Handle soldExclusively fields
            soldExclusively: isSoldExclusively,
            soldExclusivelyAt: isSoldExclusively && !wasSoldExclusively ? new Date() : (isSoldExclusively ? beat.soldExclusivelyAt : null),
            soldExclusivelyTo: isSoldExclusively ? (soldExclusivelyTo?.trim() || beat.soldExclusivelyTo) : null
        };

        console.log('[BEAT UPDATE] Update data:', updateData);

        if (req.files) {
            // Handle MP3 preview file
            if (req.files.audioFile && req.files.audioFile[0]) {
                updateData.audioFile = `/uploads/${req.files.audioFile[0].filename}`;

                // Auto-extract duration from new audio file if duration not manually provided
                if (!duration) {
                    const extractedDuration = await getAudioDuration(updateData.audioFile);
                    if (extractedDuration) {
                        updateData.duration = extractedDuration;
                        console.log('[BEAT UPDATE] Auto-extracted duration:', extractedDuration, 'seconds');
                    }
                }
            }

            // Handle WAV file
            if (req.files.wavFile && req.files.wavFile[0]) {
                updateData.wavFile = `/uploads/${req.files.wavFile[0].filename}`;

                // If no duration yet and new WAV uploaded, extract from WAV
                if (!duration && !updateData.duration) {
                    const extractedDuration = await getAudioDuration(updateData.wavFile);
                    if (extractedDuration) {
                        updateData.duration = extractedDuration;
                        console.log('[BEAT UPDATE] Auto-extracted duration from WAV:', extractedDuration, 'seconds');
                    }
                }
            }

            // Handle cover art
            if (req.files.coverArt && req.files.coverArt[0]) {
                const uploadPath = `uploads/covers/${req.files.coverArt[0].filename}`;
                const processedPath = await processCoverArt(uploadPath);
                updateData.coverArt = processedPath.replace(/\\/g, '/');
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
        const beatId = req.params.id;

        // Check if beat exists
        const beat = await prisma.beat.findUnique({
            where: { id: beatId },
            include: {
                orderItems: true
            }
        });

        if (!beat) {
            return res.status(404).json({ message: 'Beat not found' });
        }

        // Check if beat has been purchased - prevent deletion to preserve order history
        if (beat.orderItems && beat.orderItems.length > 0) {
            return res.status(400).json({
                message: 'Cannot delete this beat because it has been purchased. Consider hiding it instead.',
                orderCount: beat.orderItems.length
            });
        }

        // Delete related records first (likes, playlist entries, comments)
        // These have cascade delete but doing it explicitly for clarity
        await prisma.$transaction([
            prisma.beatLike.deleteMany({ where: { beatId } }),
            prisma.playlistBeat.deleteMany({ where: { beatId } }),
            prisma.comment.deleteMany({ where: { beatId } }),
            prisma.beat.delete({ where: { id: beatId } })
        ]);

        res.json({ message: 'Beat deleted successfully' });
    } catch (error) {
        console.error('Error deleting beat:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// Email configuration for contact form (Gmail fallback)
const emailTransporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER || 'Docroldsllc@gmail.com',
        pass: process.env.EMAIL_APP_PASS
    }
});

// SendGrid email sender configuration
const SENDGRID_FROM_EMAIL = process.env.SENDGRID_FROM_EMAIL || 'noreply@docrolds.com';
const SENDGRID_FROM_NAME = process.env.SENDGRID_FROM_NAME || 'Doc Rolds';

// ==========================================
// EMAIL HELPER FUNCTIONS (SendGrid Priority)
// ==========================================

/**
 * Send email via SendGrid (preferred) or fallback to Nodemailer
 * @param {Object} options - { to, subject, html, text }
 * @returns {Promise<boolean>} - Success status
 */
async function sendEmail({ to, subject, html, text }) {
    try {
        if (process.env.SENDGRID_API_KEY) {
            // Use SendGrid
            const msg = {
                to,
                from: {
                    email: SENDGRID_FROM_EMAIL,
                    name: SENDGRID_FROM_NAME
                },
                subject,
                html,
                text: text || subject
            };
            await sgMail.send(msg);
            console.log(`[EMAIL] SendGrid: Sent to ${to}`);
            return true;
        } else {
            // Fallback to Nodemailer
            await emailTransporter.sendMail({
                from: process.env.EMAIL_USER || 'Docroldsllc@gmail.com',
                to,
                subject,
                html,
                text
            });
            console.log(`[EMAIL] Nodemailer: Sent to ${to}`);
            return true;
        }
    } catch (error) {
        console.error('[EMAIL] Error sending email:', error.message);
        return false;
    }
}

// ==========================================
// NOTIFICATION HELPER FUNCTIONS
// ==========================================

/**
 * Create a notification for a customer
 * @param {string} customerId - Customer ID
 * @param {string} type - ORDER_COMPLETED, DOWNLOAD_READY, DOWNLOAD_EXPIRING, WELCOME
 * @param {string} title - Notification title
 * @param {string} message - Notification message
 * @param {Object} data - Optional additional data (orderNumber, beatId, actionUrl, etc.)
 */
async function createNotification(customerId, type, title, message, data = null) {
    try {
        const notification = await prisma.notification.create({
            data: {
                customerId,
                type,
                title,
                message,
                data
            }
        });
        console.log(`[NOTIFICATION] Created: ${type} for customer ${customerId}`);
        return notification;
    } catch (error) {
        console.error('[NOTIFICATION] Error creating notification:', error.message);
        return null;
    }
}

/**
 * Send welcome email to new customer
 * @param {Object} customer - Customer object with email, firstName
 */
async function sendWelcomeEmail(customer) {
    const firstName = customer.firstName || 'there';
    const subject = `Welcome to Doc Rolds! 🎵`;

    const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0d0d0d; color: #ffffff; padding: 40px;">
            <div style="text-align: center; margin-bottom: 30px;">
                <h1 style="color: #E83628; margin: 0;">Doc Rolds</h1>
                <p style="color: #888; margin: 5px 0 0 0;">Premium Beats & Production</p>
            </div>

            <h2 style="color: #ffffff; margin-bottom: 20px;">Welcome, ${escapeHtml(firstName)}! 🎉</h2>

            <p style="color: #ccc; line-height: 1.6;">
                Thank you for creating an account with Doc Rolds. You now have access to:
            </p>

            <ul style="color: #ccc; line-height: 1.8;">
                <li><strong style="color: #fff;">Unlimited Downloads</strong> - Your purchased beats never expire</li>
                <li><strong style="color: #fff;">Order History</strong> - Access all your purchases anytime</li>
                <li><strong style="color: #fff;">Like & Save Beats</strong> - Build your personal collection</li>
                <li><strong style="color: #fff;">Playlists</strong> - Organize beats for your projects</li>
            </ul>

            <div style="text-align: center; margin: 30px 0;">
                <a href="${FRONTEND_URL}/beats" style="display: inline-block; background: #E83628; color: #fff; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold;">
                    Browse Beats
                </a>
            </div>

            <p style="color: #888; font-size: 14px; border-top: 1px solid #333; padding-top: 20px; margin-top: 30px;">
                Questions? Reply to this email or visit our <a href="${FRONTEND_URL}/contact" style="color: #E83628;">contact page</a>.
            </p>
        </div>
    `;

    const text = `Welcome to Doc Rolds, ${firstName}! Thank you for creating an account. Browse our beats at ${FRONTEND_URL}/beats`;

    await sendEmail({ to: customer.email, subject, html, text });
}

/**
 * Send download expiry warning email
 * @param {Object} order - Order with customer and items
 */
async function sendExpiryWarningEmail(order) {
    const customer = order.customer;
    const firstName = customer.firstName || 'there';
    const expiryDate = new Date(order.downloadExpiresAt).toLocaleDateString();

    const subject = `Your download link expires soon - ${order.orderNumber}`;

    const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0d0d0d; color: #ffffff; padding: 40px;">
            <div style="text-align: center; margin-bottom: 30px;">
                <h1 style="color: #E83628; margin: 0;">Doc Rolds</h1>
            </div>

            <div style="background: #1a1a1a; border-left: 4px solid #eab308; padding: 20px; margin-bottom: 20px;">
                <h3 style="color: #eab308; margin: 0 0 10px 0;">⚠️ Download Link Expiring Soon</h3>
                <p style="color: #ccc; margin: 0;">Your download link for order <strong>${order.orderNumber}</strong> expires on <strong>${expiryDate}</strong>.</p>
            </div>

            <p style="color: #ccc; line-height: 1.6;">
                Hi ${escapeHtml(firstName)}, please download your beats before the link expires.
            </p>

            <div style="text-align: center; margin: 30px 0;">
                <a href="${FRONTEND_URL}/download/${order.downloadToken}" style="display: inline-block; background: #E83628; color: #fff; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold;">
                    Download Now
                </a>
            </div>

            <p style="color: #888; font-size: 14px;">
                <strong>Tip:</strong> Create an account to get unlimited access to your downloads!
            </p>
        </div>
    `;

    await sendEmail({ to: customer.email, subject, html });
}

// Contact form endpoint with validation and XSS protection
app.post('/api/contact', async (req, res) => {
    try {
        const { name, email, phone, message } = req.body;

        // Validate required fields
        if (!name || !email || !message) {
            return res.status(400).json({ message: 'Name, email, and message are required' });
        }

        // Validate email format
        if (!isValidEmail(email)) {
            return res.status(400).json({ message: 'Invalid email format' });
        }

        // Escape HTML to prevent XSS in email
        const safeName = escapeHtml(name);
        const safeEmail = escapeHtml(email);
        const safePhone = escapeHtml(phone || 'Not provided');
        const safeMessage = escapeHtml(message).replace(/\n/g, '<br>');

        // Email content
        const mailOptions = {
            from: process.env.EMAIL_USER || 'Docroldsllc@gmail.com',
            to: 'Docroldsllc@gmail.com',
            replyTo: email,
            subject: `New Contact Form Submission from ${safeName}`,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #E83628; border-bottom: 2px solid #E83628; padding-bottom: 10px;">
                        New Contact Form Submission
                    </h2>
                    <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
                        <p><strong>Name:</strong> ${safeName}</p>
                        <p><strong>Email:</strong> <a href="mailto:${safeEmail}">${safeEmail}</a></p>
                        <p><strong>Phone:</strong> ${safePhone}</p>
                    </div>
                    <div style="background: #fff; padding: 20px; border: 1px solid #ddd; border-radius: 8px;">
                        <h3 style="color: #333; margin-top: 0;">Message:</h3>
                        <p style="color: #555; line-height: 1.6;">${safeMessage}</p>
                    </div>
                    <p style="color: #999; font-size: 12px; margin-top: 20px;">
                        This email was sent from the Doc Rolds website contact form.
                    </p>
                </div>
            `,
            text: `
New Contact Form Submission

Name: ${name}
Email: ${email}
Phone: ${phone || 'Not provided'}

Message:
${message}

---
This email was sent from the Doc Rolds website contact form.
            `
        };

        // Send email
        await emailTransporter.sendMail(mailOptions);

        console.log('[CONTACT] Email sent successfully');
        res.json({ message: 'Message sent successfully' });

    } catch (error) {
        console.error('[CONTACT] Error sending email:', error.message);
        res.status(500).json({ message: 'Failed to send message' });
    }
});

// ==========================================
// PAYMENT SYSTEM HELPER FUNCTIONS
// ==========================================

// Generate order number: DR-2024-00001
async function generateOrderNumber() {
    const year = new Date().getFullYear();
    const lastOrder = await prisma.order.findFirst({
        where: {
            orderNumber: {
                startsWith: `DR-${year}-`
            }
        },
        orderBy: { orderNumber: 'desc' }
    });

    let sequence = 1;
    if (lastOrder) {
        const lastSequence = parseInt(lastOrder.orderNumber.split('-')[2]);
        sequence = lastSequence + 1;
    }

    return `DR-${year}-${sequence.toString().padStart(5, '0')}`;
}

// Handle successful payment (called after Square payment completes)
async function handleSuccessfulPayment(order, squarePaymentId) {
    console.log('[PAYMENT] Processing successful payment for order:', order.orderNumber);

    // Reload order with relations
    const fullOrder = await prisma.order.findUnique({
        where: { id: order.id },
        include: { customer: true, items: { include: { beat: true } } }
    });

    if (!fullOrder) {
        console.error('[PAYMENT] Order not found:', order.id);
        return;
    }

    // Update order status
    await prisma.order.update({
        where: { id: order.id },
        data: {
            status: 'COMPLETED',
            paymentStatus: 'PAID',
            squarePaymentId: squarePaymentId
        }
    });

    // Reload with updated status for email
    const updatedOrder = await prisma.order.findUnique({
        where: { id: order.id },
        include: { customer: true, items: { include: { beat: true } } }
    });

    // Send download email
    await sendDownloadEmail(updatedOrder);

    // Create notification for customer
    const beatTitles = fullOrder.items.map(item => item.beat.title).join(', ');
    await createNotification(
        fullOrder.customerId,
        'ORDER_COMPLETED',
        'Order Confirmed!',
        `Your order #${fullOrder.orderNumber} is complete. Your beats are ready to download: ${beatTitles}`,
        {
            orderNumber: fullOrder.orderNumber,
            downloadToken: fullOrder.downloadToken,
            total: fullOrder.total,
            actionUrl: `/download/${fullOrder.downloadToken}`
        }
    );

    console.log('[PAYMENT] Order completed:', fullOrder.orderNumber);
}

// Send download email to customer
async function sendDownloadEmail(order) {
    const downloadUrl = `${FRONTEND_URL}/download/${order.downloadToken}`;

    const licenseUrl = `${FRONTEND_URL}/licenses`;
    const itemsList = order.items.map(item => `
        <tr>
            <td style="padding: 10px; border-bottom: 1px solid #eee;">${escapeHtml(item.beat.title)}</td>
            <td style="padding: 10px; border-bottom: 1px solid #eee;">
                <a href="${licenseUrl}?type=${item.licenseType?.toLowerCase() || 'standard'}" style="color: #E83628; text-decoration: none;">
                    ${escapeHtml(item.licenseName)} ↗
                </a>
            </td>
            <td style="padding: 10px; border-bottom: 1px solid #eee;">$${item.price.toFixed(2)}</td>
        </tr>
    `).join('');

    const expiryNotice = order.customer.isGuest
        ? `<p style="color: #E83628; font-weight: bold;">⚠️ Guest checkout: Your download link expires in ${DOWNLOAD_LINK_EXPIRY_DAYS} days. Create an account for unlimited access!</p>`
        : '';

    const mailOptions = {
        from: process.env.EMAIL_USER || 'Docroldsllc@gmail.com',
        to: order.customer.email,
        subject: `Your Doc Rolds Order #${order.orderNumber} - Download Ready!`,
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #1a1a1a; color: #fff; padding: 30px;">
                <h1 style="color: #E83628; text-align: center;">🎵 Your Beats Are Ready!</h1>

                <p>Hey ${escapeHtml(order.customer.firstName || 'there')},</p>
                <p>Thanks for your purchase! Your order <strong>#${order.orderNumber}</strong> is complete.</p>

                ${expiryNotice}

                <h3 style="color: #E83628; margin-top: 30px;">Order Details:</h3>
                <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
                    <thead>
                        <tr style="background: #333;">
                            <th style="padding: 10px; text-align: left;">Beat</th>
                            <th style="padding: 10px; text-align: left;">License</th>
                            <th style="padding: 10px; text-align: left;">Price</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${itemsList}
                    </tbody>
                    <tfoot>
                        <tr style="background: #333;">
                            <td colspan="2" style="padding: 10px;"><strong>Total</strong></td>
                            <td style="padding: 10px;"><strong>$${order.total.toFixed(2)}</strong></td>
                        </tr>
                    </tfoot>
                </table>

                <div style="text-align: center; margin: 30px 0;">
                    <a href="${downloadUrl}" style="background: #E83628; color: #fff; padding: 15px 40px; text-decoration: none; border-radius: 5px; font-size: 18px; display: inline-block;">
                        📥 Download Your Beats
                    </a>
                </div>

                <p style="color: #999; font-size: 12px; margin-top: 30px; text-align: center;">
                    If the button doesn't work, copy this link: ${downloadUrl}
                </p>

                <div style="background: #222; border-radius: 8px; padding: 20px; margin-top: 30px;">
                    <h3 style="color: #E83628; margin: 0 0 15px 0; font-size: 14px;">📜 License Terms - IMPORTANT</h3>
                    <ul style="color: #ccc; font-size: 12px; margin: 0; padding-left: 20px; line-height: 1.8;">
                        <li><strong>Credit Required:</strong> You MUST credit "Prod. by Doc Rolds" on ALL releases</li>
                        <li><strong>Master Rights:</strong> Producer retains master ownership on all license types</li>
                        <li><strong>All Versions:</strong> Credit required on remixes, edits, and live performances</li>
                        <li>All licenses are perpetual (lifetime validity)</li>
                    </ul>
                    <p style="margin: 15px 0 0; text-align: center;">
                        <a href="${FRONTEND_URL}/licenses" style="color: #E83628; font-size: 12px;">View Full License Terms →</a>
                    </p>
                </div>

                <hr style="border: none; border-top: 1px solid #333; margin: 30px 0;">

                <p style="color: #999; font-size: 12px; text-align: center;">
                    Doc Rolds Music • <a href="${FRONTEND_URL}" style="color: #E83628;">docrolds.com</a>
                </p>
            </div>
        `
    };

    try {
        await emailTransporter.sendMail(mailOptions);
        await prisma.order.update({
            where: { id: order.id },
            data: { emailSent: true }
        });
        console.log('[EMAIL] Download email sent to:', order.customer.email);
    } catch (error) {
        console.error('[EMAIL] Failed to send download email:', error.message);
    }
}

// Customer authentication middleware
const authenticateCustomer = async (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ message: 'Access denied' });
    }

    jwt.verify(token, JWT_CUSTOMER_SECRET, async (err, customer) => {
        if (err) {
            return res.status(403).json({ message: 'Invalid token' });
        }

        // Check if customer is blocked
        try {
            const dbCustomer = await prisma.customer.findUnique({
                where: { id: customer.id },
                select: { isBlocked: true, blockedReason: true }
            });

            if (dbCustomer?.isBlocked) {
                return res.status(403).json({
                    message: 'Account blocked',
                    reason: dbCustomer.blockedReason || 'Your account has been blocked. Please contact support.'
                });
            }
        } catch (dbErr) {
            console.error('Error checking blocked status:', dbErr);
        }

        req.customer = customer;
        next();
    });
};

// Optional customer auth (doesn't fail if no token)
const optionalCustomerAuth = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return next();
    }

    jwt.verify(token, JWT_CUSTOMER_SECRET, (err, customer) => {
        if (!err) {
            req.customer = customer;
        }
        next();
    });
};

// ==========================================
// CHECKOUT ENDPOINTS (Square Payments)
// ==========================================

// Process payment with Square
app.post('/api/checkout/process-payment', async (req, res) => {
    try {
        const { sourceId, items, customer: customerData } = req.body;

        // Validate source ID (payment token from Square Web Payments SDK)
        if (!sourceId) {
            return res.status(400).json({ message: 'Payment source is required' });
        }

        if (!items || items.length === 0) {
            return res.status(400).json({ message: 'Cart is empty' });
        }

        if (!customerData || !customerData.email) {
            return res.status(400).json({ message: 'Customer email is required' });
        }

        if (!isValidEmail(customerData.email)) {
            return res.status(400).json({ message: 'Invalid email format' });
        }

        // Find or create customer
        let customer = await prisma.customer.findUnique({
            where: { email: customerData.email }
        });

        if (!customer) {
            customer = await prisma.customer.create({
                data: {
                    email: customerData.email,
                    firstName: customerData.firstName || null,
                    lastName: customerData.lastName || null,
                    phone: customerData.phone || null,
                    isGuest: !customerData.password
                }
            });
        }

        // Validate items and get beat details
        const beatIds = items.map(item => item.beatId);
        const beats = await prisma.beat.findMany({
            where: { id: { in: beatIds } }
        });

        if (beats.length !== items.length) {
            return res.status(400).json({ message: 'Some beats not found' });
        }

        // Calculate totals
        const orderItems = [];
        let subtotal = 0;

        for (const item of items) {
            const beat = beats.find(b => b.id === item.beatId);

            // Validate license type
            let price, licenseName;
            if (item.licenseType === 'STANDARD') {
                price = 50;
                licenseName = 'Standard Lease';
            } else if (item.licenseType === 'UNLIMITED') {
                price = 150;
                licenseName = 'Unlimited Lease';
            } else {
                return res.status(400).json({ message: `Invalid license type: ${item.licenseType}` });
            }

            subtotal += price;
            orderItems.push({
                beatId: beat.id,
                licenseType: item.licenseType,
                licenseName,
                price
            });
        }

        // Generate order number
        const orderNumber = await generateOrderNumber();

        // Set download expiry for guests (7 days)
        const downloadExpiresAt = customer.isGuest
            ? new Date(Date.now() + DOWNLOAD_LINK_EXPIRY_DAYS * 24 * 60 * 60 * 1000)
            : null;

        // Create order in pending state
        const order = await prisma.order.create({
            data: {
                orderNumber,
                customerId: customer.id,
                status: 'PENDING',
                paymentStatus: 'PENDING',
                subtotal,
                total: subtotal,
                downloadExpiresAt,
                items: {
                    create: orderItems
                }
            }
        });

        console.log('[SQUARE] Processing payment for order:', orderNumber, 'Amount:', subtotal * 100, 'cents');

        // Process payment with Square
        const paymentResponse = await squareClient.payments.create({
            sourceId: sourceId,
            idempotencyKey: order.id, // Use order ID as idempotency key
            amountMoney: {
                amount: BigInt(subtotal * 100), // Square uses cents as BigInt
                currency: 'USD'
            },
            locationId: process.env.SQUARE_LOCATION_ID,
            note: `Order ${orderNumber} - Doc Rolds Beats`,
            referenceId: orderNumber
        });

        if (paymentResponse.payment.status === 'COMPLETED') {
            console.log('[SQUARE] Payment successful:', paymentResponse.payment.id);

            // Handle successful payment
            await handleSuccessfulPayment(order, paymentResponse.payment.id);

            res.json({
                success: true,
                orderNumber: order.orderNumber,
                paymentId: paymentResponse.payment.id,
                redirectUrl: `/order/${orderNumber}?success=true`
            });
        } else {
            console.error('[SQUARE] Payment not completed:', paymentResponse.payment.status);

            // Update order as failed
            await prisma.order.update({
                where: { id: order.id },
                data: {
                    status: 'CANCELLED',
                    paymentStatus: 'FAILED'
                }
            });

            res.status(400).json({
                success: false,
                message: 'Payment was not completed',
                status: paymentResponse.payment.status
            });
        }

    } catch (error) {
        console.error('[CHECKOUT] Error processing payment:', error);

        // Square API errors have specific structure
        if (error.errors) {
            const squareError = error.errors[0];
            return res.status(400).json({
                success: false,
                message: squareError.detail || 'Payment failed',
                code: squareError.code
            });
        }

        res.status(500).json({
            success: false,
            message: 'Failed to process payment',
            error: error.message
        });
    }
});

// Get Square Application ID for frontend
app.get('/api/checkout/square-config', (req, res) => {
    res.json({
        applicationId: process.env.SQUARE_APPLICATION_ID,
        locationId: process.env.SQUARE_LOCATION_ID,
        environment: process.env.SQUARE_ENVIRONMENT || 'sandbox'
    });
});

// ==========================================
// BOOKING ENDPOINTS (Square Appointments)
// ==========================================

// Session type configuration (Legacy - kept for backwards compatibility)
const SESSION_TYPES = {
    STARTER: {
        name: 'Starter Session',
        price: 80,
        durationMinutes: 60,
        deposit: 25,
        squareServiceId: process.env.SQUARE_SERVICE_STARTER_ID
    },
    PROFESSIONAL: {
        name: 'Professional Session',
        price: 150,
        durationMinutes: 60,
        deposit: 25,
        squareServiceId: process.env.SQUARE_SERVICE_PROFESSIONAL_ID
    },
    PREMIUM: {
        name: 'Premium Package',
        price: 300,
        durationMinutes: 120,
        deposit: 25,
        squareServiceId: process.env.SQUARE_SERVICE_PREMIUM_ID
    },
    CONSULTATION: {
        name: 'Business Consultation',
        price: 750,
        durationMinutes: 60,
        deposit: 25,
        squareServiceId: process.env.SQUARE_SERVICE_CONSULTATION_ID
    }
};

// NEW: Recording hours pricing
const RECORDING_RATES = {
    getRate: (hours) => {
        if (hours >= 10) return 65;  // $15/hr discount
        if (hours >= 5) return 70;   // $10/hr discount
        return 80;                    // Base rate
    },
    deposit: 25
};

// NEW: Mixing tiers configuration
const MIXING_TIERS = {
    BASIC: {
        name: 'Basic Mix',
        price: 75,
        turnaround: '3-5 days',
        features: ['MP3/WAV Master'],
        allowInPerson: false
    },
    STANDARD: {
        name: 'Standard Mix',
        price: 100,
        turnaround: '3-5 days',
        features: ['Vocal stems + beat track', 'MP3/WAV delivery', '2 revisions'],
        allowInPerson: false
    },
    PRO: {
        name: 'Pro Mix',
        price: 200,
        turnaround: '2-3 days',
        features: ['Full stems + vocal stems', 'Mix & master', 'MP3/WAV/stems delivery'],
        allowInPerson: true
    },
    PREMIUM: {
        name: 'Premium Mix',
        price: 300,
        turnaround: '24-48 hrs',
        features: ['Complete package', 'Clean version', 'All formats', 'Priority queue'],
        allowInPerson: true
    }
};

// Studio hourly rate for in-person mixing
const STUDIO_HOURLY_RATE = 80;

// Generate booking number (BK-YYYY-00001)
async function generateBookingNumber() {
    const year = new Date().getFullYear();
    const prefix = `BK-${year}-`;

    // Find the last booking number for this year
    const lastBooking = await prisma.booking.findFirst({
        where: {
            bookingNumber: { startsWith: prefix }
        },
        orderBy: { bookingNumber: 'desc' }
    });

    let nextNumber = 1;
    if (lastBooking) {
        const lastNum = parseInt(lastBooking.bookingNumber.split('-')[2]);
        nextNumber = lastNum + 1;
    }

    return `${prefix}${nextNumber.toString().padStart(5, '0')}`;
}

// Send booking confirmation email
async function sendBookingConfirmationEmail(booking, serviceName = null) {
    const session = SESSION_TYPES[booking.sessionType];
    const displayName = serviceName || session?.name || booking.category || 'Service';
    const firstName = booking.name.split(' ')[0];

    // Handle remote mixing (no scheduling)
    const hasSchedule = booking.scheduledAt != null;
    const sessionDate = hasSchedule ? new Date(booking.scheduledAt).toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    }) : null;
    const sessionTime = hasSchedule ? new Date(booking.scheduledAt).toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        timeZone: booking.timezone
    }) : null;

    const subject = hasSchedule
        ? `Booking Confirmed: ${displayName} - ${sessionDate}`
        : `Order Confirmed: ${displayName} - ${booking.bookingNumber}`;

    // Build email body based on booking type
    const introMessage = hasSchedule
        ? 'Your session at Doc Rolds Studio has been confirmed. We\'re looking forward to working with you!'
        : 'Your order has been confirmed. We\'ll start processing your files and get back to you soon!';

    const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0d0d0d; color: #ffffff; padding: 40px;">
            <div style="text-align: center; margin-bottom: 30px;">
                <h1 style="color: #E83628; margin: 0;">Doc Rolds Studio</h1>
                <p style="color: #888; margin: 5px 0 0 0;">${hasSchedule ? 'Booking Confirmed!' : 'Order Confirmed!'}</p>
            </div>

            <p>Hey ${escapeHtml(firstName)},</p>
            <p>${introMessage}</p>

            <div style="background: #1a1a1a; padding: 20px; border-radius: 12px; margin: 25px 0; border: 1px solid #333;">
                <h3 style="color: #E83628; margin: 0 0 15px 0;">${hasSchedule ? 'Session Details' : 'Order Details'}</h3>
                <table style="width: 100%; border-collapse: collapse;">
                    <tr>
                        <td style="padding: 8px 0; color: #888;">${hasSchedule ? 'Booking' : 'Order'} #:</td>
                        <td style="padding: 8px 0; color: #fff; text-align: right;">${booking.bookingNumber}</td>
                    </tr>
                    <tr>
                        <td style="padding: 8px 0; color: #888;">Service:</td>
                        <td style="padding: 8px 0; color: #fff; text-align: right;">${displayName}</td>
                    </tr>
                    ${hasSchedule ? `
                    <tr>
                        <td style="padding: 8px 0; color: #888;">Date:</td>
                        <td style="padding: 8px 0; color: #fff; text-align: right;">${sessionDate}</td>
                    </tr>
                    <tr>
                        <td style="padding: 8px 0; color: #888;">Time:</td>
                        <td style="padding: 8px 0; color: #fff; text-align: right;">${sessionTime}</td>
                    </tr>
                    ${booking.durationMinutes ? `
                    <tr>
                        <td style="padding: 8px 0; color: #888;">Duration:</td>
                        <td style="padding: 8px 0; color: #fff; text-align: right;">${booking.durationMinutes} minutes</td>
                    </tr>
                    ` : ''}
                    ` : `
                    <tr>
                        <td style="padding: 8px 0; color: #888;">Turnaround:</td>
                        <td style="padding: 8px 0; color: #fff; text-align: right;">${booking.mixingTier === 'PREMIUM' ? '24-48 hrs' : booking.mixingTier === 'PRO' ? '2-3 days' : '3-5 days'}</td>
                    </tr>
                    `}
                </table>
            </div>

            <div style="background: #1a1a1a; padding: 20px; border-radius: 12px; margin: 25px 0; border: 1px solid #333;">
                <h3 style="color: #E83628; margin: 0 0 15px 0;">Payment Summary</h3>
                <table style="width: 100%; border-collapse: collapse;">
                    <tr>
                        <td style="padding: 8px 0; color: #888;">${booking.balanceAmount > 0 ? 'Deposit' : 'Amount'} Paid:</td>
                        <td style="padding: 8px 0; color: #22c55e; text-align: right;">$${booking.depositAmount.toFixed(2)} ✓</td>
                    </tr>
                    ${booking.balanceAmount > 0 ? `
                    <tr>
                        <td style="padding: 8px 0; color: #888;">Balance Due${hasSchedule ? ' at Studio' : ''}:</td>
                        <td style="padding: 8px 0; color: #f59e0b; text-align: right;">$${booking.balanceAmount.toFixed(2)}</td>
                    </tr>
                    ` : ''}
                    <tr style="border-top: 1px solid #333;">
                        <td style="padding: 12px 0 8px; color: #fff; font-weight: bold;">Total:</td>
                        <td style="padding: 12px 0 8px; color: #fff; text-align: right; font-weight: bold;">$${booking.sessionPrice.toFixed(2)}</td>
                    </tr>
                </table>
            </div>

            ${booking.songTitle || booking.recordingDetails || booking.artistName ? `
            <div style="background: #1a1a1a; padding: 20px; border-radius: 12px; margin: 25px 0; border: 1px solid #333;">
                <h3 style="color: #E83628; margin: 0 0 15px 0;">Your Project</h3>
                ${booking.artistName ? `<p style="margin: 5px 0; color: #888;">Artist: <span style="color: #fff;">${escapeHtml(booking.artistName)}</span></p>` : ''}
                ${booking.songTitle ? `<p style="margin: 5px 0; color: #888;">Song: <span style="color: #fff;">${escapeHtml(booking.songTitle)}</span></p>` : ''}
                ${booking.recordingDetails ? `<p style="margin: 5px 0; color: #888;">Notes: <span style="color: #fff;">${escapeHtml(booking.recordingDetails)}</span></p>` : ''}
            </div>
            ` : ''}

            ${hasSchedule ? `
            <div style="background: rgba(232, 54, 40, 0.1); padding: 15px 20px; border-radius: 8px; border: 1px solid rgba(232, 54, 40, 0.3); margin: 25px 0;">
                <p style="margin: 0; color: #E83628; font-size: 14px;">
                    <strong>Need to reschedule?</strong> Contact us at least 24 hours before your session.
                </p>
            </div>
            ` : `
            <div style="background: rgba(34, 197, 94, 0.1); padding: 15px 20px; border-radius: 8px; border: 1px solid rgba(34, 197, 94, 0.3); margin: 25px 0;">
                <p style="margin: 0; color: #22c55e; font-size: 14px;">
                    <strong>What's next?</strong> We'll review your files and start working on your mix. You'll receive an email when it's ready!
                </p>
            </div>
            `}

            <p style="color: #888; font-size: 14px; margin-top: 30px;">
                Questions? Reply to this email or call us at 727-282-5449.
            </p>

            <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #333;">
                <p style="color: #666; font-size: 12px; margin: 0;">
                    © ${new Date().getFullYear()} Doc Rolds. All rights reserved.
                </p>
            </div>
        </div>
    `;

    await sendEmail({ to: booking.email, subject, html });

    // Update booking
    await prisma.booking.update({
        where: { id: booking.id },
        data: { confirmationSent: true, confirmationSentAt: new Date() }
    });

    console.log(`[BOOKING] Confirmation email sent to ${booking.email}`);
}

// Get session types configuration (legacy)
app.get('/api/bookings/session-types', (req, res) => {
    const types = Object.entries(SESSION_TYPES).map(([id, config]) => ({
        id,
        name: config.name,
        price: config.price,
        durationMinutes: config.durationMinutes,
        deposit: config.deposit,
        balanceDue: config.price - config.deposit
    }));
    res.json(types);
});

// NEW: Get recording pricing configuration
app.get('/api/bookings/recording-pricing', (req, res) => {
    const pricing = [];
    for (let hours = 1; hours <= 10; hours++) {
        const rate = RECORDING_RATES.getRate(hours);
        const total = hours * rate;
        pricing.push({
            hours,
            rate,
            total,
            deposit: RECORDING_RATES.deposit,
            balance: total - RECORDING_RATES.deposit,
            discount: hours >= 10 ? 15 : hours >= 5 ? 10 : 0
        });
    }
    res.json(pricing);
});

// NEW: Get mixing tiers configuration
app.get('/api/bookings/mixing-tiers', (req, res) => {
    const tiers = Object.entries(MIXING_TIERS).map(([id, config]) => ({
        id,
        name: config.name,
        price: config.price,
        turnaround: config.turnaround,
        features: config.features,
        allowInPerson: config.allowInPerson,
        inPersonStudioRate: STUDIO_HOURLY_RATE
    }));
    res.json(tiers);
});

// NEW: Get active promos
app.get('/api/bookings/promos', async (req, res) => {
    try {
        const now = new Date();
        const promos = await prisma.promo.findMany({
            where: {
                active: true,
                OR: [
                    { validFrom: null },
                    { validFrom: { lte: now } }
                ],
                AND: [
                    {
                        OR: [
                            { validUntil: null },
                            { validUntil: { gte: now } }
                        ]
                    }
                ]
            },
            orderBy: { createdAt: 'desc' }
        });

        // Calculate savings for each promo
        const promosWithSavings = promos.map(promo => ({
            ...promo,
            savings: promo.originalValue - promo.price,
            savingsPercent: Math.round(((promo.originalValue - promo.price) / promo.originalValue) * 100)
        }));

        res.json(promosWithSavings);
    } catch (error) {
        console.error('[BOOKING] Get promos error:', error);
        res.status(500).json({ message: 'Failed to fetch promos' });
    }
});

// NEW: Get beats available for promo selection (MP3 Lease only)
app.get('/api/bookings/promo-beats', async (req, res) => {
    try {
        const beats = await prisma.beat.findMany({
            where: {
                soldExclusively: false  // Only available beats
            },
            select: {
                id: true,
                title: true,
                genre: true,
                bpm: true,
                key: true,
                coverArt: true,
                audioFile: true,  // MP3 preview
                producedBy: true
            },
            orderBy: { createdAt: 'desc' }
        });
        res.json(beats);
    } catch (error) {
        console.error('[BOOKING] Get promo beats error:', error);
        res.status(500).json({ message: 'Failed to fetch beats' });
    }
});

// NEW: File upload endpoint for remote mixing
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configure multer for mixing file uploads
const mixingUploadDir = path.join(__dirname, 'uploads', 'mixing');
if (!fs.existsSync(mixingUploadDir)) {
    fs.mkdirSync(mixingUploadDir, { recursive: true });
}

const mixingStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, mixingUploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + '-' + file.originalname);
    }
});

const mixingUpload = multer({
    storage: mixingStorage,
    limits: {
        fileSize: 2 * 1024 * 1024 * 1024,  // 2GB total limit
        files: 10  // Max 10 files
    },
    fileFilter: (req, file, cb) => {
        const allowedExtensions = ['.wav', '.mp3', '.aiff', '.flac', '.zip'];
        const ext = path.extname(file.originalname).toLowerCase();
        if (allowedExtensions.includes(ext)) {
            cb(null, true);
        } else {
            cb(new Error(`File type ${ext} not allowed. Accepted: WAV, MP3, AIFF, FLAC, ZIP`));
        }
    }
});

app.post('/api/bookings/upload', mixingUpload.array('files', 10), async (req, res) => {
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ message: 'No files uploaded' });
        }

        // Calculate total size
        const totalSize = req.files.reduce((sum, file) => sum + file.size, 0);
        const maxSize = 2 * 1024 * 1024 * 1024;  // 2GB

        if (totalSize > maxSize) {
            // Clean up uploaded files
            req.files.forEach(file => {
                fs.unlink(file.path, () => {});
            });
            return res.status(400).json({ message: 'Total file size exceeds 2GB limit' });
        }

        // Return file info
        const uploadedFiles = req.files.map(file => ({
            filename: file.filename,
            originalName: file.originalname,
            size: file.size,
            path: `/uploads/mixing/${file.filename}`
        }));

        console.log(`[BOOKING] Uploaded ${uploadedFiles.length} files for mixing (${(totalSize / 1024 / 1024).toFixed(1)} MB)`);

        res.json({
            success: true,
            files: uploadedFiles,
            totalSize
        });
    } catch (error) {
        console.error('[BOOKING] Upload error:', error);
        res.status(500).json({ message: error.message || 'File upload failed' });
    }
});

// Serve uploaded mixing files
app.use('/uploads/mixing', express.static(mixingUploadDir));

// Get availability from Square Appointments
app.post('/api/bookings/availability', async (req, res) => {
    try {
        const { sessionType, startDate, endDate } = req.body;

        // Validate session type
        const session = SESSION_TYPES[sessionType];
        if (!session) {
            return res.status(400).json({ message: 'Invalid session type' });
        }

        // Check if Square service ID is configured
        if (!session.squareServiceId) {
            // Return mock availability for development/testing
            console.log('[BOOKING] Square service ID not configured, returning mock availability');
            const mockAvailabilities = generateMockAvailability(startDate, endDate, session.durationMinutes);
            return res.json({ success: true, availabilities: mockAvailabilities });
        }

        // Call Square Bookings API
        const response = await squareClient.bookingsApi.searchAvailability({
            query: {
                filter: {
                    startAtRange: {
                        startAt: startDate,
                        endAt: endDate
                    },
                    locationId: process.env.SQUARE_LOCATION_ID,
                    segmentFilters: [{
                        serviceVariationId: session.squareServiceId
                    }]
                }
            }
        });

        res.json({
            success: true,
            availabilities: response.result.availabilities || []
        });
    } catch (error) {
        console.error('[BOOKING] Availability error:', error);

        // If Square API fails, return mock availability for development
        if (error.statusCode === 401 || error.statusCode === 404) {
            const { startDate, endDate, sessionType } = req.body;
            const session = SESSION_TYPES[sessionType];
            const mockAvailabilities = generateMockAvailability(startDate, endDate, session?.durationMinutes || 60);
            return res.json({ success: true, availabilities: mockAvailabilities, mock: true });
        }

        res.status(500).json({ message: 'Failed to fetch availability', error: error.message });
    }
});

// Generate mock availability for development
function generateMockAvailability(startDate, endDate, durationMinutes) {
    const availabilities = [];
    const start = new Date(startDate);
    const end = new Date(endDate);

    // Generate slots for the next 14 days
    for (let d = new Date(start); d <= end && d <= new Date(start.getTime() + 14 * 24 * 60 * 60 * 1000); d.setDate(d.getDate() + 1)) {
        // Skip past dates
        if (d < new Date()) continue;

        // Skip Sundays (day 0)
        if (d.getDay() === 0) continue;

        // Generate time slots from 10 AM to 6 PM
        for (let hour = 10; hour <= 18 - Math.ceil(durationMinutes / 60); hour++) {
            const slotDate = new Date(d);
            slotDate.setHours(hour, 0, 0, 0);

            // Skip if slot is in the past
            if (slotDate < new Date()) continue;

            // Randomly skip some slots to simulate booked times
            if (Math.random() > 0.7) continue;

            availabilities.push({
                startAt: slotDate.toISOString(),
                locationId: process.env.SQUARE_LOCATION_ID || 'mock-location',
                appointmentSegments: [{
                    durationMinutes,
                    teamMemberId: process.env.SQUARE_DEFAULT_TEAM_MEMBER_ID || 'mock-team-member',
                    serviceVariationId: 'mock-service'
                }]
            });
        }
    }

    return availabilities;
}

// Create booking with deposit/full payment (supports all categories)
app.post('/api/bookings/create', async (req, res) => {
    try {
        const {
            // Category and service selection
            category,           // RECORDING, MIXING, PROMO
            hours,              // For recording (1-10)
            mixingTier,         // For mixing (BASIC, STANDARD, PRO, PREMIUM)
            mixingDelivery,     // For mixing (remote, in-person)
            uploadedFiles,      // For remote mixing (array of file paths)
            promoId,            // For promo bookings
            beatId,             // For promo beatings (selected beat)

            // Scheduling (not needed for remote mixing)
            startAt,

            // Payment
            sourceId,

            // Legacy field support
            sessionType,

            // Customer info
            customer: customerData
        } = req.body;

        // Validate customer info
        if (!customerData?.name || !customerData?.email || !customerData?.phone) {
            return res.status(400).json({ message: 'Missing required customer fields: name, email, phone' });
        }

        if (!sourceId) {
            return res.status(400).json({ message: 'Missing payment source ID' });
        }

        // Determine booking type and calculate pricing
        let bookingCategory = category || 'RECORDING';
        let sessionPrice = 0;
        let depositAmount = 25;
        let balanceAmount = 0;
        let durationMinutes = 60;
        let serviceName = '';
        let requiresScheduling = true;

        // Handle different categories
        if (bookingCategory === 'RECORDING' || sessionType) {
            // RECORDING category (or legacy sessionType)
            if (sessionType && SESSION_TYPES[sessionType]) {
                // Legacy support
                const session = SESSION_TYPES[sessionType];
                sessionPrice = session.price;
                depositAmount = session.deposit;
                durationMinutes = session.durationMinutes;
                serviceName = session.name;
            } else {
                // New hour-based recording
                const recordingHours = hours || 1;
                const rate = RECORDING_RATES.getRate(recordingHours);
                sessionPrice = recordingHours * rate;
                depositAmount = RECORDING_RATES.deposit;
                durationMinutes = recordingHours * 60;
                serviceName = `${recordingHours} Hour Recording Session`;
            }
            balanceAmount = sessionPrice - depositAmount;

        } else if (bookingCategory === 'MIXING') {
            // MIXING category
            const tier = MIXING_TIERS[mixingTier];
            if (!tier) {
                return res.status(400).json({ message: 'Invalid mixing tier' });
            }

            if (mixingDelivery === 'remote') {
                // Remote mixing - full payment upfront, no scheduling
                sessionPrice = tier.price;
                depositAmount = tier.price;  // Full payment
                balanceAmount = 0;
                requiresScheduling = false;
                serviceName = `${tier.name} (Remote)`;
                durationMinutes = null;
            } else {
                // In-person mixing - deposit + studio time
                const studioHours = 2;  // Default 2hr for mixing session
                sessionPrice = tier.price + (studioHours * STUDIO_HOURLY_RATE);
                depositAmount = 25;
                balanceAmount = sessionPrice - depositAmount;
                serviceName = `${tier.name} (In-Person)`;
                durationMinutes = studioHours * 60;
            }

        } else if (bookingCategory === 'PROMO') {
            // PROMO category
            if (!promoId) {
                return res.status(400).json({ message: 'Missing promo ID' });
            }

            const promo = await prisma.promo.findUnique({ where: { id: promoId } });
            if (!promo || !promo.active) {
                return res.status(400).json({ message: 'Invalid or inactive promo' });
            }

            // Validate beat selection if promo includes beat
            if (promo.includesBeat && !beatId) {
                return res.status(400).json({ message: 'Promo requires beat selection' });
            }

            sessionPrice = promo.price;
            depositAmount = 25;
            balanceAmount = sessionPrice - depositAmount;
            serviceName = promo.name;
            durationMinutes = promo.sessionHours ? promo.sessionHours * 60 : 60;
        }

        // Validate scheduling for services that require it
        if (requiresScheduling) {
            if (!startAt) {
                return res.status(400).json({ message: 'Missing scheduled time' });
            }
            const scheduledDate = new Date(startAt);
            if (scheduledDate < new Date()) {
                return res.status(400).json({ message: 'Cannot book a session in the past' });
            }
        }

        // Generate booking number
        const bookingNumber = await generateBookingNumber();
        console.log(`[BOOKING] Creating ${bookingCategory} booking ${bookingNumber}: ${serviceName}`);

        // Find or create customer
        let customer = await prisma.customer.findUnique({
            where: { email: customerData.email.toLowerCase() }
        });

        if (!customer) {
            const nameParts = customerData.name.split(' ');
            customer = await prisma.customer.create({
                data: {
                    email: customerData.email.toLowerCase(),
                    firstName: nameParts[0],
                    lastName: nameParts.slice(1).join(' ') || null,
                    phone: customerData.phone,
                    stageName: customerData.artistName || null,
                    isGuest: true
                }
            });
            console.log(`[BOOKING] Created new customer: ${customer.email}`);
        }

        // Create booking record (pending payment)
        const booking = await prisma.booking.create({
            data: {
                bookingNumber,
                customerId: customer.id,
                name: customerData.name,
                email: customerData.email.toLowerCase(),
                phone: customerData.phone,
                artistName: customerData.artistName || null,
                songTitle: customerData.songTitle || null,
                recordingDetails: customerData.recordingDetails || null,

                // Category fields
                category: bookingCategory,
                hours: bookingCategory === 'RECORDING' ? (hours || null) : null,
                mixingTier: bookingCategory === 'MIXING' ? mixingTier : null,
                mixingDelivery: bookingCategory === 'MIXING' ? mixingDelivery : null,
                uploadedFiles: uploadedFiles || [],
                promoId: bookingCategory === 'PROMO' ? promoId : null,
                beatId: bookingCategory === 'PROMO' ? beatId : null,

                // Legacy sessionType (for backwards compatibility)
                sessionType: sessionType || bookingCategory,
                sessionPrice,
                durationMinutes,
                depositAmount,
                balanceAmount,
                scheduledAt: requiresScheduling ? new Date(startAt) : null,
                squareLocationId: process.env.SQUARE_LOCATION_ID,
                status: 'PENDING'
            }
        });

        console.log(`[BOOKING] Created pending booking: ${booking.id}`);

        // Process payment with Square (deposit or full payment depending on service type)
        try {
            const paymentResponse = await squareClient.paymentsApi.createPayment({
                sourceId: sourceId,
                idempotencyKey: booking.id,
                amountMoney: {
                    amount: BigInt(depositAmount * 100),
                    currency: 'USD'
                },
                locationId: process.env.SQUARE_LOCATION_ID,
                note: `${balanceAmount === 0 ? 'Payment' : 'Deposit'} for ${serviceName} - ${bookingNumber}`,
                referenceId: bookingNumber
            });

            if (paymentResponse.result.payment.status === 'COMPLETED') {
                console.log(`[BOOKING] Payment successful: ${paymentResponse.result.payment.id}`);

                // Update booking with payment info
                await prisma.booking.update({
                    where: { id: booking.id },
                    data: {
                        depositPaid: true,
                        depositPaymentId: paymentResponse.result.payment.id,
                        depositPaidAt: new Date(),
                        status: 'CONFIRMED',
                        // If full payment (remote mixing), mark balance as paid too
                        ...(balanceAmount === 0 && {
                            balancePaid: true,
                            balancePaidAt: new Date()
                        })
                    }
                });

                // Try to create Square Appointments booking for scheduled services
                if (requiresScheduling && process.env.SQUARE_DEFAULT_TEAM_MEMBER_ID && durationMinutes) {
                    try {
                        const squareBooking = await squareClient.bookingsApi.createBooking({
                            booking: {
                                startAt: startAt,
                                locationId: process.env.SQUARE_LOCATION_ID,
                                appointmentSegments: [{
                                    durationMinutes: durationMinutes,
                                    teamMemberId: process.env.SQUARE_DEFAULT_TEAM_MEMBER_ID
                                }],
                                customerNote: `${serviceName} - ${customerData.artistName || ''} - ${customerData.songTitle || ''}`
                            },
                            idempotencyKey: `booking-${booking.id}`
                        });

                        await prisma.booking.update({
                            where: { id: booking.id },
                            data: { squareBookingId: squareBooking.result.booking.id }
                        });
                        console.log(`[BOOKING] Square Appointments booking created: ${squareBooking.result.booking.id}`);
                    } catch (squareBookingError) {
                        console.warn('[BOOKING] Could not create Square Appointments booking:', squareBookingError.message);
                        // Continue anyway - payment was successful
                    }
                }

                // Send confirmation email
                const updatedBooking = await prisma.booking.findUnique({
                    where: { id: booking.id },
                    include: { promo: true }
                });
                await sendBookingConfirmationEmail(updatedBooking, serviceName);

                // Create notification for customer
                const notificationMessage = requiresScheduling
                    ? `Your ${serviceName} is confirmed for ${new Date(startAt).toLocaleDateString()}.`
                    : `Your ${serviceName} order has been received. We'll start processing your files soon!`;

                await createNotification(
                    customer.id,
                    'BOOKING_CONFIRMED',
                    'Booking Confirmed!',
                    notificationMessage,
                    { bookingNumber, category: bookingCategory, scheduledAt: startAt }
                );

                res.json({
                    success: true,
                    bookingNumber: booking.bookingNumber,
                    message: 'Booking confirmed!'
                });
            } else {
                // Payment not completed
                console.log(`[BOOKING] Payment status: ${paymentResponse.result.payment.status}`);
                await prisma.booking.update({
                    where: { id: booking.id },
                    data: { status: 'CANCELLED' }
                });

                res.status(400).json({
                    success: false,
                    message: 'Payment was not completed'
                });
            }
        } catch (paymentError) {
            console.error('[BOOKING] Payment error:', paymentError);

            // Update booking status
            await prisma.booking.update({
                where: { id: booking.id },
                data: { status: 'CANCELLED' }
            });

            res.status(400).json({
                success: false,
                message: paymentError.errors?.[0]?.detail || 'Payment processing failed'
            });
        }
    } catch (error) {
        console.error('[BOOKING] Create booking error:', error);
        res.status(500).json({ message: 'Failed to create booking', error: error.message });
    }
});

// Get booking by booking number (public)
app.get('/api/bookings/:bookingNumber', async (req, res) => {
    try {
        const booking = await prisma.booking.findUnique({
            where: { bookingNumber: req.params.bookingNumber },
            include: {
                customer: {
                    select: { email: true, firstName: true, lastName: true }
                }
            }
        });

        if (!booking) {
            return res.status(404).json({ message: 'Booking not found' });
        }

        // Return session info along with booking
        const session = SESSION_TYPES[booking.sessionType];

        res.json({
            ...booking,
            sessionName: session?.name || booking.sessionType
        });
    } catch (error) {
        console.error('[BOOKING] Get booking error:', error);
        res.status(500).json({ message: 'Failed to fetch booking' });
    }
});

// Admin: Get all bookings
app.get('/api/admin/bookings', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { status, startDate, endDate } = req.query;

        const where = {};
        if (status) where.status = status;
        if (startDate && endDate) {
            where.scheduledAt = {
                gte: new Date(startDate),
                lte: new Date(endDate)
            };
        }

        const bookings = await prisma.booking.findMany({
            where,
            include: {
                customer: {
                    select: { email: true, firstName: true, lastName: true }
                }
            },
            orderBy: { scheduledAt: 'asc' }
        });

        // Add session names
        const bookingsWithSessionNames = bookings.map(booking => ({
            ...booking,
            sessionName: SESSION_TYPES[booking.sessionType]?.name || booking.sessionType
        }));

        res.json(bookingsWithSessionNames);
    } catch (error) {
        console.error('[BOOKING] Admin get bookings error:', error);
        res.status(500).json({ message: 'Failed to fetch bookings' });
    }
});

// Admin: Update booking status
app.patch('/api/admin/bookings/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { status, notes, balancePaid } = req.body;

        const updateData = {};
        if (status) updateData.status = status;
        if (notes !== undefined) updateData.notes = notes;
        if (balancePaid !== undefined) {
            updateData.balancePaid = balancePaid;
            if (balancePaid) updateData.balancePaidAt = new Date();
        }

        const booking = await prisma.booking.update({
            where: { id: req.params.id },
            data: updateData
        });

        res.json(booking);
    } catch (error) {
        console.error('[BOOKING] Admin update error:', error);
        res.status(500).json({ message: 'Failed to update booking' });
    }
});

// Admin: Cancel booking
app.delete('/api/admin/bookings/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const booking = await prisma.booking.findUnique({
            where: { id: req.params.id }
        });

        if (!booking) {
            return res.status(404).json({ message: 'Booking not found' });
        }

        // Cancel in Square Appointments if it exists
        if (booking.squareBookingId) {
            try {
                await squareClient.bookingsApi.cancelBooking(booking.squareBookingId, {
                    idempotencyKey: `cancel-${booking.id}-${Date.now()}`
                });
                console.log(`[BOOKING] Cancelled Square booking: ${booking.squareBookingId}`);
            } catch (squareCancelError) {
                console.warn('[BOOKING] Could not cancel Square booking:', squareCancelError.message);
            }
        }

        // Update status to cancelled
        await prisma.booking.update({
            where: { id: booking.id },
            data: { status: 'CANCELLED' }
        });

        // TODO: Consider implementing deposit refund logic here

        res.json({ success: true, message: 'Booking cancelled' });
    } catch (error) {
        console.error('[BOOKING] Cancel error:', error);
        res.status(500).json({ message: 'Failed to cancel booking' });
    }
});

// ==========================================
// PROMO ADMIN ENDPOINTS
// ==========================================

// Admin: Get all promos
app.get('/api/admin/promos', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const promos = await prisma.promo.findMany({
            orderBy: { createdAt: 'desc' },
            include: {
                _count: {
                    select: { bookings: true }
                }
            }
        });

        // Add computed fields
        const promosWithStats = promos.map(promo => ({
            ...promo,
            bookingsCount: promo._count.bookings,
            savings: promo.originalValue - promo.price,
            savingsPercent: Math.round(((promo.originalValue - promo.price) / promo.originalValue) * 100)
        }));

        res.json(promosWithStats);
    } catch (error) {
        console.error('[PROMO] Admin get promos error:', error);
        res.status(500).json({ message: 'Failed to fetch promos' });
    }
});

// Admin: Create promo
app.post('/api/admin/promos', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const {
            name,
            description,
            price,
            originalValue,
            includesSession,
            sessionHours,
            includesBeat,
            beatLicenseType,
            includesMixing,
            mixingTier,
            active,
            validFrom,
            validUntil
        } = req.body;

        if (!name || !price || !originalValue) {
            return res.status(400).json({ message: 'Missing required fields: name, price, originalValue' });
        }

        const promo = await prisma.promo.create({
            data: {
                name,
                description,
                price: parseFloat(price),
                originalValue: parseFloat(originalValue),
                includesSession: includesSession ?? true,
                sessionHours: sessionHours ? parseInt(sessionHours) : null,
                includesBeat: includesBeat ?? false,
                beatLicenseType: beatLicenseType || null,
                includesMixing: includesMixing ?? false,
                mixingTier: mixingTier || null,
                active: active ?? true,
                validFrom: validFrom ? new Date(validFrom) : null,
                validUntil: validUntil ? new Date(validUntil) : null
            }
        });

        console.log(`[PROMO] Created promo: ${promo.name} (${promo.id})`);
        res.status(201).json(promo);
    } catch (error) {
        console.error('[PROMO] Create error:', error);
        res.status(500).json({ message: 'Failed to create promo' });
    }
});

// Admin: Update promo
app.patch('/api/admin/promos/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const {
            name,
            description,
            price,
            originalValue,
            includesSession,
            sessionHours,
            includesBeat,
            beatLicenseType,
            includesMixing,
            mixingTier,
            active,
            validFrom,
            validUntil
        } = req.body;

        const updateData = {};
        if (name !== undefined) updateData.name = name;
        if (description !== undefined) updateData.description = description;
        if (price !== undefined) updateData.price = parseFloat(price);
        if (originalValue !== undefined) updateData.originalValue = parseFloat(originalValue);
        if (includesSession !== undefined) updateData.includesSession = includesSession;
        if (sessionHours !== undefined) updateData.sessionHours = sessionHours ? parseInt(sessionHours) : null;
        if (includesBeat !== undefined) updateData.includesBeat = includesBeat;
        if (beatLicenseType !== undefined) updateData.beatLicenseType = beatLicenseType || null;
        if (includesMixing !== undefined) updateData.includesMixing = includesMixing;
        if (mixingTier !== undefined) updateData.mixingTier = mixingTier || null;
        if (active !== undefined) updateData.active = active;
        if (validFrom !== undefined) updateData.validFrom = validFrom ? new Date(validFrom) : null;
        if (validUntil !== undefined) updateData.validUntil = validUntil ? new Date(validUntil) : null;

        const promo = await prisma.promo.update({
            where: { id },
            data: updateData
        });

        console.log(`[PROMO] Updated promo: ${promo.name} (${promo.id})`);
        res.json(promo);
    } catch (error) {
        console.error('[PROMO] Update error:', error);
        res.status(500).json({ message: 'Failed to update promo' });
    }
});

// Admin: Delete promo
app.delete('/api/admin/promos/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;

        // Check if promo has any bookings
        const promo = await prisma.promo.findUnique({
            where: { id },
            include: {
                _count: { select: { bookings: true } }
            }
        });

        if (!promo) {
            return res.status(404).json({ message: 'Promo not found' });
        }

        if (promo._count.bookings > 0) {
            // Soft delete - just deactivate
            await prisma.promo.update({
                where: { id },
                data: { active: false }
            });
            console.log(`[PROMO] Deactivated promo with bookings: ${promo.name}`);
            return res.json({ success: true, message: 'Promo deactivated (has existing bookings)' });
        }

        // Hard delete if no bookings
        await prisma.promo.delete({ where: { id } });
        console.log(`[PROMO] Deleted promo: ${promo.name}`);
        res.json({ success: true, message: 'Promo deleted' });
    } catch (error) {
        console.error('[PROMO] Delete error:', error);
        res.status(500).json({ message: 'Failed to delete promo' });
    }
});

// ==========================================
// ORDER ENDPOINTS
// ==========================================

// Get order by order number (public - for order confirmation page)
app.get('/api/orders/:orderNumber', async (req, res) => {
    try {
        const order = await prisma.order.findUnique({
            where: { orderNumber: req.params.orderNumber },
            include: {
                customer: {
                    select: {
                        email: true,
                        firstName: true,
                        lastName: true,
                        isGuest: true
                    }
                },
                items: {
                    include: {
                        beat: {
                            select: {
                                id: true,
                                title: true,
                                genre: true,
                                bpm: true,
                                key: true,
                                coverArt: true
                            }
                        }
                    }
                }
            }
        });

        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }

        res.json(order);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// Download endpoint with token validation
app.get('/api/orders/download/:token', async (req, res) => {
    try {
        const order = await prisma.order.findUnique({
            where: { downloadToken: req.params.token },
            include: {
                customer: true,
                items: {
                    include: { beat: true }
                }
            }
        });

        if (!order) {
            return res.status(404).json({ message: 'Download link not found' });
        }

        if (order.paymentStatus !== 'PAID') {
            return res.status(403).json({ message: 'Payment not completed' });
        }

        // Check expiry for guests
        if (order.customer.isGuest && order.downloadExpiresAt) {
            if (new Date() > order.downloadExpiresAt) {
                return res.status(403).json({
                    message: 'Download link expired. Create an account to access your purchases.',
                    expired: true
                });
            }
        }

        // Update download count
        await prisma.order.update({
            where: { id: order.id },
            data: { downloadCount: { increment: 1 } }
        });

        // Return download info
        const downloads = order.items.map(item => {
            const files = [];

            // MP3 always included
            if (item.beat.audioFile) {
                files.push({
                    type: 'mp3',
                    url: item.beat.audioFile,
                    filename: `${item.beat.title} - ${item.licenseName}.mp3`
                });
            }

            // WAV only for Unlimited license
            if (item.licenseType === 'UNLIMITED' && item.beat.wavFile) {
                files.push({
                    type: 'wav',
                    url: item.beat.wavFile,
                    filename: `${item.beat.title} - ${item.licenseName}.wav`
                });
            }

            return {
                beatId: item.beatId,
                beatTitle: item.beat.title,
                license: item.licenseName,
                files
            };
        });

        res.json({
            orderNumber: order.orderNumber,
            downloads,
            expiresAt: order.downloadExpiresAt,
            downloadCount: order.downloadCount + 1
        });

    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// Download specific file
app.get('/api/orders/download/:token/:beatId/:fileType', async (req, res) => {
    try {
        const { token, beatId, fileType } = req.params;

        const order = await prisma.order.findUnique({
            where: { downloadToken: token },
            include: {
                customer: true,
                items: {
                    where: { beatId },
                    include: { beat: true }
                }
            }
        });

        if (!order) {
            return res.status(404).json({ message: 'Download link not found' });
        }

        if (order.paymentStatus !== 'PAID') {
            return res.status(403).json({ message: 'Payment not completed' });
        }

        // Check expiry for guests
        if (order.customer.isGuest && order.downloadExpiresAt) {
            if (new Date() > order.downloadExpiresAt) {
                return res.status(403).json({ message: 'Download link expired' });
            }
        }

        const item = order.items[0];
        if (!item) {
            return res.status(404).json({ message: 'Beat not found in order' });
        }

        // Validate file access based on license
        let filePath;
        if (fileType === 'mp3' && item.beat.audioFile) {
            filePath = path.join(__dirname, item.beat.audioFile);
        } else if (fileType === 'wav' && item.licenseType === 'UNLIMITED' && item.beat.wavFile) {
            filePath = path.join(__dirname, item.beat.wavFile);
        } else {
            return res.status(403).json({ message: 'File not available for your license' });
        }

        // Check if file exists
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ message: 'File not found' });
        }

        const filename = `${item.beat.title} - ${item.licenseName}.${fileType}`;
        res.download(filePath, filename);

    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// ==========================================
// CUSTOMER AUTHENTICATION ENDPOINTS
// ==========================================

// Customer registration
app.post('/api/customers/register', async (req, res) => {
    try {
        const { email, password, firstName, lastName, stageName, phone } = req.body;

        if (!email || !password) {
            return res.status(400).json({ message: 'Email and password are required' });
        }

        if (!isValidEmail(email)) {
            return res.status(400).json({ message: 'Invalid email format' });
        }

        if (password.length < 6) {
            return res.status(400).json({ message: 'Password must be at least 6 characters' });
        }

        // Check if customer exists
        const existingCustomer = await prisma.customer.findUnique({
            where: { email }
        });

        if (existingCustomer && !existingCustomer.isGuest) {
            return res.status(400).json({ message: 'Email already registered' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        let customer;
        if (existingCustomer) {
            // Upgrade guest to full account
            customer = await prisma.customer.update({
                where: { email },
                data: {
                    password: hashedPassword,
                    firstName,
                    lastName,
                    stageName,
                    phone,
                    isGuest: false
                }
            });

            // Remove download expiry from existing orders
            await prisma.order.updateMany({
                where: { customerId: customer.id },
                data: { downloadExpiresAt: null }
            });
        } else {
            customer = await prisma.customer.create({
                data: {
                    email,
                    password: hashedPassword,
                    firstName,
                    lastName,
                    stageName,
                    phone,
                    isGuest: false
                }
            });
        }

        // Create default playlist
        await prisma.playlist.create({
            data: {
                customerId: customer.id,
                name: 'Saved Beats',
                isDefault: true
            }
        });

        const token = jwt.sign(
            { id: customer.id, email: customer.email },
            JWT_CUSTOMER_SECRET,
            { expiresIn: '7d' }
        );

        // Send welcome email and create notification (non-blocking)
        sendWelcomeEmail(customer).catch(err =>
            console.error('[REGISTER] Failed to send welcome email:', err.message)
        );

        await createNotification(
            customer.id,
            'WELCOME',
            'Welcome to Doc Rolds!',
            `Welcome, ${customer.firstName || 'there'}! Your account is ready. Explore our beats and start creating.`,
            { actionUrl: '/beats' }
        );

        console.log('[REGISTER] New customer registered:', customer.email);

        res.status(201).json({
            token,
            customer: {
                id: customer.id,
                email: customer.email,
                firstName: customer.firstName,
                lastName: customer.lastName,
                stageName: customer.stageName
            }
        });

    } catch (error) {
        console.error('[REGISTER] Error:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// Customer login
app.post('/api/customers/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ message: 'Email and password are required' });
        }

        const customer = await prisma.customer.findUnique({
            where: { email }
        });

        if (!customer || customer.isGuest || !customer.password) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        const validPassword = await bcrypt.compare(password, customer.password);

        if (!validPassword) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        const token = jwt.sign(
            { id: customer.id, email: customer.email },
            JWT_CUSTOMER_SECRET,
            { expiresIn: '7d' }
        );

        res.json({
            token,
            customer: {
                id: customer.id,
                email: customer.email,
                firstName: customer.firstName,
                lastName: customer.lastName,
                stageName: customer.stageName,
                profilePicture: customer.profilePicture
            }
        });

    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// Get current customer profile
app.get('/api/customers/me', authenticateCustomer, async (req, res) => {
    try {
        const customer = await prisma.customer.findUnique({
            where: { id: req.customer.id },
            select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                stageName: true,
                username: true,
                phone: true,
                profession: true,
                dateOfBirth: true,
                city: true,
                state: true,
                profilePicture: true,
                createdAt: true
            }
        });

        if (!customer) {
            return res.status(404).json({ message: 'Customer not found' });
        }

        res.json(customer);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// Update customer profile
app.put('/api/customers/me', authenticateCustomer, async (req, res) => {
    try {
        const { firstName, lastName, stageName, username, phone, profession, dateOfBirth, city, state } = req.body;

        // Check username uniqueness
        if (username) {
            const existing = await prisma.customer.findFirst({
                where: {
                    username,
                    NOT: { id: req.customer.id }
                }
            });
            if (existing) {
                return res.status(400).json({ message: 'Username already taken' });
            }
        }

        const customer = await prisma.customer.update({
            where: { id: req.customer.id },
            data: {
                firstName,
                lastName,
                stageName,
                username,
                phone,
                profession,
                dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
                city,
                state
            },
            select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                stageName: true,
                username: true,
                phone: true,
                profession: true,
                dateOfBirth: true,
                city: true,
                state: true,
                profilePicture: true
            }
        });

        res.json(customer);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// Upload profile picture
app.post('/api/customers/me/profile-picture', authenticateCustomer, upload.single('profilePicture'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'No file uploaded' });
        }

        const photoData = await processTeamPhotoToBase64(req.file.buffer);

        const customer = await prisma.customer.update({
            where: { id: req.customer.id },
            data: { profilePicture: photoData }
        });

        res.json({ profilePicture: customer.profilePicture });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// Change password
app.put('/api/customers/me/password', authenticateCustomer, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;

        if (!currentPassword || !newPassword) {
            return res.status(400).json({ message: 'Current and new password required' });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({ message: 'Password must be at least 6 characters' });
        }

        const customer = await prisma.customer.findUnique({
            where: { id: req.customer.id }
        });

        const validPassword = await bcrypt.compare(currentPassword, customer.password);
        if (!validPassword) {
            return res.status(401).json({ message: 'Current password is incorrect' });
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);
        await prisma.customer.update({
            where: { id: req.customer.id },
            data: { password: hashedPassword }
        });

        res.json({ message: 'Password updated successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// Get customer's orders
app.get('/api/customers/me/orders', authenticateCustomer, async (req, res) => {
    try {
        const orders = await prisma.order.findMany({
            where: { customerId: req.customer.id },
            include: {
                items: {
                    include: {
                        beat: {
                            select: {
                                id: true,
                                title: true,
                                coverArt: true,
                                genre: true
                            }
                        }
                    }
                }
            },
            orderBy: { createdAt: 'desc' }
        });

        res.json(orders);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// Get customer's downloadable beats (for registered users - unlimited access)
app.get('/api/customers/me/downloads', authenticateCustomer, async (req, res) => {
    try {
        const orders = await prisma.order.findMany({
            where: {
                customerId: req.customer.id,
                paymentStatus: 'PAID'
            },
            include: {
                items: {
                    include: {
                        beat: true
                    }
                }
            }
        });

        const downloads = orders.flatMap(order =>
            order.items.map(item => ({
                orderId: order.id,
                orderNumber: order.orderNumber,
                downloadToken: order.downloadToken,
                beatId: item.beatId,
                beat: item.beat,
                license: item.licenseName,
                licenseType: item.licenseType,
                purchasedAt: order.createdAt
            }))
        );

        res.json(downloads);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// ==========================================
// SOCIAL FEATURES - LIKES
// ==========================================

// Like a beat
app.post('/api/beats/:id/like', authenticateCustomer, async (req, res) => {
    try {
        const existingLike = await prisma.beatLike.findUnique({
            where: {
                customerId_beatId: {
                    customerId: req.customer.id,
                    beatId: req.params.id
                }
            }
        });

        if (existingLike) {
            return res.status(400).json({ message: 'Already liked' });
        }

        await prisma.beatLike.create({
            data: {
                customerId: req.customer.id,
                beatId: req.params.id
            }
        });

        const likeCount = await prisma.beatLike.count({
            where: { beatId: req.params.id }
        });

        res.json({ liked: true, likeCount });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// Unlike a beat
app.delete('/api/beats/:id/like', authenticateCustomer, async (req, res) => {
    try {
        await prisma.beatLike.delete({
            where: {
                customerId_beatId: {
                    customerId: req.customer.id,
                    beatId: req.params.id
                }
            }
        });

        const likeCount = await prisma.beatLike.count({
            where: { beatId: req.params.id }
        });

        res.json({ liked: false, likeCount });
    } catch (error) {
        if (error.code === 'P2025') {
            return res.status(404).json({ message: 'Like not found' });
        }
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// Get beat like count and status
app.get('/api/beats/:id/likes', optionalCustomerAuth, async (req, res) => {
    try {
        const likeCount = await prisma.beatLike.count({
            where: { beatId: req.params.id }
        });

        let isLiked = false;
        if (req.customer) {
            const like = await prisma.beatLike.findUnique({
                where: {
                    customerId_beatId: {
                        customerId: req.customer.id,
                        beatId: req.params.id
                    }
                }
            });
            isLiked = !!like;
        }

        res.json({ likeCount, isLiked });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// Get customer's liked beats
app.get('/api/customers/me/likes', authenticateCustomer, async (req, res) => {
    try {
        const likes = await prisma.beatLike.findMany({
            where: { customerId: req.customer.id },
            include: {
                beat: true
            },
            orderBy: { createdAt: 'desc' }
        });

        res.json(likes.map(l => l.beat));
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// ==========================================
// SOCIAL FEATURES - PLAYLISTS
// ==========================================

// Get customer's playlists
app.get('/api/customers/me/playlists', authenticateCustomer, async (req, res) => {
    try {
        const playlists = await prisma.playlist.findMany({
            where: { customerId: req.customer.id },
            include: {
                beats: {
                    include: { beat: true },
                    orderBy: { addedAt: 'desc' }
                }
            },
            orderBy: [
                { isDefault: 'desc' },
                { createdAt: 'desc' }
            ]
        });

        res.json(playlists);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// Create new playlist
app.post('/api/customers/me/playlists', authenticateCustomer, async (req, res) => {
    try {
        const { name } = req.body;

        if (!name || name.trim().length === 0) {
            return res.status(400).json({ message: 'Playlist name is required' });
        }

        const playlist = await prisma.playlist.create({
            data: {
                customerId: req.customer.id,
                name: name.trim()
            }
        });

        res.status(201).json(playlist);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// Rename playlist
app.put('/api/playlists/:id', authenticateCustomer, async (req, res) => {
    try {
        const { name } = req.body;

        const playlist = await prisma.playlist.findFirst({
            where: {
                id: req.params.id,
                customerId: req.customer.id
            }
        });

        if (!playlist) {
            return res.status(404).json({ message: 'Playlist not found' });
        }

        if (playlist.isDefault) {
            return res.status(400).json({ message: 'Cannot rename default playlist' });
        }

        const updated = await prisma.playlist.update({
            where: { id: req.params.id },
            data: { name }
        });

        res.json(updated);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// Delete playlist
app.delete('/api/playlists/:id', authenticateCustomer, async (req, res) => {
    try {
        const playlist = await prisma.playlist.findFirst({
            where: {
                id: req.params.id,
                customerId: req.customer.id
            }
        });

        if (!playlist) {
            return res.status(404).json({ message: 'Playlist not found' });
        }

        if (playlist.isDefault) {
            return res.status(400).json({ message: 'Cannot delete default playlist' });
        }

        await prisma.playlist.delete({
            where: { id: req.params.id }
        });

        res.json({ message: 'Playlist deleted' });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// Save beat to playlist
app.post('/api/beats/:id/save', authenticateCustomer, async (req, res) => {
    try {
        const { playlistId } = req.body;

        // If no playlist specified, use default
        let targetPlaylistId = playlistId;
        if (!targetPlaylistId) {
            const defaultPlaylist = await prisma.playlist.findFirst({
                where: {
                    customerId: req.customer.id,
                    isDefault: true
                }
            });
            targetPlaylistId = defaultPlaylist?.id;

            if (!targetPlaylistId) {
                // Create default playlist if it doesn't exist
                const newDefault = await prisma.playlist.create({
                    data: {
                        customerId: req.customer.id,
                        name: 'Saved Beats',
                        isDefault: true
                    }
                });
                targetPlaylistId = newDefault.id;
            }
        }

        // Verify playlist belongs to customer
        const playlist = await prisma.playlist.findFirst({
            where: {
                id: targetPlaylistId,
                customerId: req.customer.id
            }
        });

        if (!playlist) {
            return res.status(404).json({ message: 'Playlist not found' });
        }

        // Check if already saved
        const existing = await prisma.playlistBeat.findUnique({
            where: {
                playlistId_beatId: {
                    playlistId: targetPlaylistId,
                    beatId: req.params.id
                }
            }
        });

        if (existing) {
            return res.status(400).json({ message: 'Beat already in playlist' });
        }

        await prisma.playlistBeat.create({
            data: {
                playlistId: targetPlaylistId,
                beatId: req.params.id
            }
        });

        res.json({ saved: true, playlistId: targetPlaylistId });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// Remove beat from playlist
app.delete('/api/playlists/:playlistId/beats/:beatId', authenticateCustomer, async (req, res) => {
    try {
        // Verify playlist belongs to customer
        const playlist = await prisma.playlist.findFirst({
            where: {
                id: req.params.playlistId,
                customerId: req.customer.id
            }
        });

        if (!playlist) {
            return res.status(404).json({ message: 'Playlist not found' });
        }

        await prisma.playlistBeat.delete({
            where: {
                playlistId_beatId: {
                    playlistId: req.params.playlistId,
                    beatId: req.params.beatId
                }
            }
        });

        res.json({ removed: true });
    } catch (error) {
        if (error.code === 'P2025') {
            return res.status(404).json({ message: 'Beat not in playlist' });
        }
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// ==========================================
// SOCIAL FEATURES - COMMENTS
// ==========================================

// Get beat comments (with replies and like counts)
app.get('/api/beats/:id/comments', async (req, res) => {
    try {
        // Get top-level comments only (no parentId)
        const comments = await prisma.comment.findMany({
            where: {
                beatId: req.params.id,
                isReported: false,
                parentId: null // Only top-level comments
            },
            include: {
                customer: {
                    select: {
                        id: true,
                        firstName: true,
                        stageName: true,
                        profilePicture: true
                    }
                },
                replies: {
                    where: { isReported: false },
                    include: {
                        customer: {
                            select: {
                                id: true,
                                firstName: true,
                                stageName: true,
                                profilePicture: true
                            }
                        },
                        _count: {
                            select: { likes: true }
                        }
                    },
                    orderBy: { createdAt: 'asc' }
                },
                _count: {
                    select: { likes: true }
                }
            },
            orderBy: { createdAt: 'desc' }
        });

        // Transform to include likeCount
        const transformedComments = comments.map(comment => ({
            ...comment,
            likeCount: comment._count.likes,
            _count: undefined,
            replies: comment.replies.map(reply => ({
                ...reply,
                likeCount: reply._count.likes,
                _count: undefined
            }))
        }));

        res.json(transformedComments);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// Add comment (or reply if parentId is provided)
app.post('/api/beats/:id/comments', authenticateCustomer, async (req, res) => {
    try {
        const { content, parentId } = req.body;

        if (!content || content.trim().length === 0) {
            return res.status(400).json({ message: 'Comment content is required' });
        }

        if (content.length > 1000) {
            return res.status(400).json({ message: 'Comment too long (max 1000 characters)' });
        }

        // If parentId is provided, verify it exists and belongs to this beat
        if (parentId) {
            const parentComment = await prisma.comment.findFirst({
                where: {
                    id: parentId,
                    beatId: req.params.id,
                    parentId: null // Can only reply to top-level comments
                }
            });
            if (!parentComment) {
                return res.status(400).json({ message: 'Invalid parent comment' });
            }
        }

        const comment = await prisma.comment.create({
            data: {
                customerId: req.customer.id,
                beatId: req.params.id,
                content: content.trim(),
                parentId: parentId || null
            },
            include: {
                customer: {
                    select: {
                        id: true,
                        firstName: true,
                        stageName: true,
                        profilePicture: true
                    }
                },
                _count: {
                    select: { likes: true }
                }
            }
        });

        res.status(201).json({
            ...comment,
            likeCount: comment._count.likes,
            _count: undefined,
            replies: []
        });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// Delete own comment
app.delete('/api/comments/:id', authenticateCustomer, async (req, res) => {
    try {
        const comment = await prisma.comment.findFirst({
            where: {
                id: req.params.id,
                customerId: req.customer.id
            }
        });

        if (!comment) {
            return res.status(404).json({ message: 'Comment not found' });
        }

        await prisma.comment.delete({
            where: { id: req.params.id }
        });

        res.json({ message: 'Comment deleted' });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// Report comment
app.post('/api/comments/:id/report', authenticateCustomer, async (req, res) => {
    try {
        await prisma.comment.update({
            where: { id: req.params.id },
            data: {
                isReported: true,
                reportedAt: new Date(),
                reportedBy: req.customer.id
            }
        });

        res.json({ message: 'Comment reported' });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// Like a comment
app.post('/api/comments/:id/like', authenticateCustomer, async (req, res) => {
    try {
        const commentId = req.params.id;

        // Check if comment exists
        const comment = await prisma.comment.findUnique({
            where: { id: commentId }
        });

        if (!comment) {
            return res.status(404).json({ message: 'Comment not found' });
        }

        // Check if already liked
        const existingLike = await prisma.commentLike.findUnique({
            where: {
                customerId_commentId: {
                    customerId: req.customer.id,
                    commentId
                }
            }
        });

        if (existingLike) {
            return res.status(409).json({ message: 'Already liked' });
        }

        await prisma.commentLike.create({
            data: {
                customerId: req.customer.id,
                commentId
            }
        });

        // Get updated like count
        const likeCount = await prisma.commentLike.count({
            where: { commentId }
        });

        res.json({ liked: true, likeCount });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// Unlike a comment
app.delete('/api/comments/:id/like', authenticateCustomer, async (req, res) => {
    try {
        const commentId = req.params.id;

        await prisma.commentLike.deleteMany({
            where: {
                customerId: req.customer.id,
                commentId
            }
        });

        // Get updated like count
        const likeCount = await prisma.commentLike.count({
            where: { commentId }
        });

        res.json({ liked: false, likeCount });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// Get user's liked comments for a beat
app.get('/api/beats/:id/comments/likes', authenticateCustomer, async (req, res) => {
    try {
        const beatId = req.params.id;

        const likedComments = await prisma.commentLike.findMany({
            where: {
                customerId: req.customer.id,
                comment: {
                    beatId
                }
            },
            select: {
                commentId: true
            }
        });

        res.json(likedComments.map(l => l.commentId));
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// ==========================================
// NOTIFICATION ENDPOINTS (Customer)
// ==========================================

// Get customer notifications
app.get('/api/customers/me/notifications', authenticateCustomer, async (req, res) => {
    try {
        const { limit = 20, unreadOnly = false, offset = 0 } = req.query;

        const whereClause = {
            customerId: req.customer.id
        };

        if (unreadOnly === 'true') {
            whereClause.isRead = false;
        }

        const notifications = await prisma.notification.findMany({
            where: whereClause,
            orderBy: { createdAt: 'desc' },
            take: parseInt(limit),
            skip: parseInt(offset)
        });

        res.json(notifications);
    } catch (error) {
        console.error('[NOTIFICATION] Error fetching notifications:', error.message);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// Get unread notification count
app.get('/api/customers/me/notifications/unread-count', authenticateCustomer, async (req, res) => {
    try {
        const count = await prisma.notification.count({
            where: {
                customerId: req.customer.id,
                isRead: false
            }
        });

        res.json({ count });
    } catch (error) {
        console.error('[NOTIFICATION] Error counting notifications:', error.message);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// Mark single notification as read
app.put('/api/customers/me/notifications/:id/read', authenticateCustomer, async (req, res) => {
    try {
        const notification = await prisma.notification.findFirst({
            where: {
                id: req.params.id,
                customerId: req.customer.id
            }
        });

        if (!notification) {
            return res.status(404).json({ message: 'Notification not found' });
        }

        const updated = await prisma.notification.update({
            where: { id: req.params.id },
            data: {
                isRead: true,
                readAt: new Date()
            }
        });

        res.json(updated);
    } catch (error) {
        console.error('[NOTIFICATION] Error marking as read:', error.message);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// Mark all notifications as read
app.put('/api/customers/me/notifications/read-all', authenticateCustomer, async (req, res) => {
    try {
        const result = await prisma.notification.updateMany({
            where: {
                customerId: req.customer.id,
                isRead: false
            },
            data: {
                isRead: true,
                readAt: new Date()
            }
        });

        res.json({ message: 'All notifications marked as read', count: result.count });
    } catch (error) {
        console.error('[NOTIFICATION] Error marking all as read:', error.message);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// Delete a notification
app.delete('/api/customers/me/notifications/:id', authenticateCustomer, async (req, res) => {
    try {
        const notification = await prisma.notification.findFirst({
            where: {
                id: req.params.id,
                customerId: req.customer.id
            }
        });

        if (!notification) {
            return res.status(404).json({ message: 'Notification not found' });
        }

        await prisma.notification.delete({
            where: { id: req.params.id }
        });

        res.json({ message: 'Notification deleted' });
    } catch (error) {
        console.error('[NOTIFICATION] Error deleting notification:', error.message);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// ==========================================
// ADMIN ENDPOINTS - ORDERS
// ==========================================

// Get all orders (admin)
app.get('/api/admin/orders', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const orders = await prisma.order.findMany({
            include: {
                customer: {
                    select: {
                        email: true,
                        firstName: true,
                        lastName: true,
                        isGuest: true
                    }
                },
                items: {
                    include: {
                        beat: {
                            select: { title: true }
                        }
                    }
                }
            },
            orderBy: { createdAt: 'desc' }
        });

        res.json(orders);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// Get order details (admin)
app.get('/api/admin/orders/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const order = await prisma.order.findUnique({
            where: { id: req.params.id },
            include: {
                customer: true,
                items: {
                    include: { beat: true }
                }
            }
        });

        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }

        res.json(order);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// Update order (admin)
app.put('/api/admin/orders/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { status, paymentStatus, notes, adminNotes, extendDownload, items, totalAmount } = req.body;

        const updateData = {};
        if (status) updateData.status = status;
        if (paymentStatus) updateData.paymentStatus = paymentStatus;
        // Support both 'notes' and 'adminNotes' - they both map to the notes field
        if (notes !== undefined) updateData.notes = notes;
        if (adminNotes !== undefined) updateData.notes = adminNotes;
        if (totalAmount !== undefined) updateData.totalAmount = parseFloat(totalAmount);

        if (extendDownload) {
            updateData.downloadExpiresAt = new Date(Date.now() + DOWNLOAD_LINK_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
        }

        // Update order
        const order = await prisma.order.update({
            where: { id: req.params.id },
            data: updateData,
            include: {
                customer: true,
                items: { include: { beat: true } }
            }
        });

        // Update order items (license upgrades)
        if (items && Array.isArray(items)) {
            for (const item of items) {
                if (item.id && (item.licenseType || item.price !== undefined)) {
                    await prisma.orderItem.update({
                        where: { id: item.id },
                        data: {
                            licenseType: item.licenseType,
                            licenseName: item.licenseType === 'UNLIMITED' ? 'Unlimited Lease' : 'Standard Lease',
                            price: parseFloat(item.price)
                        }
                    });
                }
            }
            console.log(`[ADMIN] Order ${order.orderNumber} items updated (license upgrade)`);
        }

        // Fetch updated order with items
        const updatedOrder = await prisma.order.findUnique({
            where: { id: req.params.id },
            include: {
                customer: true,
                items: { include: { beat: true } }
            }
        });

        res.json(updatedOrder);
    } catch (error) {
        console.error('[ADMIN] Error updating order:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// Resend download email (admin)
app.post('/api/admin/orders/:id/resend-email', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const order = await prisma.order.findUnique({
            where: { id: req.params.id },
            include: {
                customer: true,
                items: { include: { beat: true } }
            }
        });

        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }

        await sendDownloadEmail(order);
        res.json({ message: 'Email sent successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// Delete order (admin only)
app.delete('/api/admin/orders/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;

        // Check order exists
        const order = await prisma.order.findUnique({ where: { id } });
        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }

        // Delete order items first (foreign key constraint)
        await prisma.orderItem.deleteMany({ where: { orderId: id } });

        // Delete the order
        await prisma.order.delete({ where: { id } });

        console.log(`[ADMIN] Order ${order.orderNumber} deleted`);
        res.json({ message: 'Order deleted successfully', orderNumber: order.orderNumber });
    } catch (error) {
        console.error('[ADMIN] Error deleting order:', error);
        res.status(500).json({ message: 'Failed to delete order', error: error.message });
    }
});

// ==========================================
// ADMIN ENDPOINTS - CUSTOMERS
// ==========================================

// Get all customers (admin)
app.get('/api/admin/customers', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const customers = await prisma.customer.findMany({
            select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                stageName: true,
                phone: true,
                isGuest: true,
                isBlocked: true,
                blockedAt: true,
                blockedReason: true,
                createdAt: true,
                _count: {
                    select: { orders: true, comments: true }
                }
            },
            orderBy: { createdAt: 'desc' }
        });

        res.json(customers);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// Get customer details (admin)
app.get('/api/admin/customers/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const customer = await prisma.customer.findUnique({
            where: { id: req.params.id },
            include: {
                orders: {
                    include: {
                        items: {
                            include: { beat: true }
                        }
                    },
                    orderBy: { createdAt: 'desc' }
                },
                likes: {
                    include: { beat: true },
                    take: 20
                },
                playlists: {
                    include: {
                        beats: { include: { beat: true } }
                    }
                },
                comments: {
                    include: { beat: true },
                    take: 20
                }
            }
        });

        if (!customer) {
            return res.status(404).json({ message: 'Customer not found' });
        }

        // Remove password from response
        const { password, ...customerData } = customer;
        res.json(customerData);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// Update customer (admin)
app.put('/api/admin/customers/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { firstName, lastName, stageName, username, phone, profession, city, state, email } = req.body;

        const customer = await prisma.customer.update({
            where: { id: req.params.id },
            data: {
                firstName,
                lastName,
                stageName,
                username,
                phone,
                profession,
                city,
                state,
                email
            }
        });

        const { password, ...customerData } = customer;
        res.json(customerData);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// Reset customer password (admin)
app.post('/api/admin/customers/:id/reset-password', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { newPassword } = req.body;

        if (!newPassword || newPassword.length < 6) {
            return res.status(400).json({ message: 'Password must be at least 6 characters' });
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);

        await prisma.customer.update({
            where: { id: req.params.id },
            data: { password: hashedPassword, isGuest: false }
        });

        res.json({ message: 'Password reset successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// Delete customer (admin)
app.delete('/api/admin/customers/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const customerId = req.params.id;

        // Check if customer exists
        const customer = await prisma.customer.findUnique({
            where: { id: customerId },
            include: {
                _count: {
                    select: { orders: true }
                }
            }
        });

        if (!customer) {
            return res.status(404).json({ message: 'Customer not found' });
        }

        // Use a transaction to delete all related records first
        await prisma.$transaction(async (tx) => {
            // Delete comment likes by this customer
            await tx.commentLike.deleteMany({
                where: { customerId }
            });

            // Delete comments by this customer
            await tx.comment.deleteMany({
                where: { customerId }
            });

            // Delete beat likes
            await tx.beatLike.deleteMany({
                where: { customerId }
            });

            // Delete playlist beats (through playlists)
            await tx.playlistBeat.deleteMany({
                where: {
                    playlist: { customerId }
                }
            });

            // Delete playlists
            await tx.playlist.deleteMany({
                where: { customerId }
            });

            // Delete notifications
            await tx.notification.deleteMany({
                where: { customerId }
            });

            // Delete order items first, then orders
            await tx.orderItem.deleteMany({
                where: {
                    order: { customerId }
                }
            });

            await tx.order.deleteMany({
                where: { customerId }
            });

            // Finally delete the customer
            await tx.customer.delete({
                where: { id: customerId }
            });
        });

        res.json({ message: 'Customer and all related data deleted successfully' });
    } catch (error) {
        console.error('Error deleting customer:', error);
        res.status(500).json({ message: 'Failed to delete customer', error: error.message });
    }
});

// Block customer (admin)
app.post('/api/admin/customers/:id/block', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { reason } = req.body;

        const customer = await prisma.customer.update({
            where: { id: req.params.id },
            data: {
                isBlocked: true,
                blockedAt: new Date(),
                blockedReason: reason || 'Blocked by administrator'
            },
            select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                stageName: true,
                isBlocked: true,
                blockedAt: true,
                blockedReason: true
            }
        });

        res.json({ message: 'Customer blocked', customer });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// Unblock customer (admin)
app.post('/api/admin/customers/:id/unblock', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const customer = await prisma.customer.update({
            where: { id: req.params.id },
            data: {
                isBlocked: false,
                blockedAt: null,
                blockedReason: null
            },
            select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                stageName: true,
                isBlocked: true
            }
        });

        res.json({ message: 'Customer unblocked', customer });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// ==========================================
// ADMIN ENDPOINTS - COMMENTS MODERATION
// ==========================================

// Get comments (admin) - with optional filters
app.get('/api/admin/comments', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { reported, beatId, customerId, limit = 50 } = req.query;

        const whereClause = {};
        if (reported === 'true') {
            whereClause.isReported = true;
        }
        if (beatId) {
            whereClause.beatId = beatId;
        }
        if (customerId) {
            whereClause.customerId = customerId;
        }

        const comments = await prisma.comment.findMany({
            where: whereClause,
            include: {
                customer: {
                    select: {
                        id: true,
                        email: true,
                        firstName: true,
                        stageName: true,
                        isBlocked: true
                    }
                },
                beat: {
                    select: { id: true, title: true }
                },
                _count: {
                    select: { likes: true, replies: true }
                }
            },
            orderBy: { createdAt: 'desc' },
            take: parseInt(limit)
        });

        const transformedComments = comments.map(c => ({
            ...c,
            likeCount: c._count.likes,
            replyCount: c._count.replies,
            _count: undefined
        }));

        res.json(transformedComments);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// Delete comment (admin)
app.delete('/api/admin/comments/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        await prisma.comment.delete({
            where: { id: req.params.id }
        });

        res.json({ message: 'Comment deleted' });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// Approve/unreport comment (admin)
app.put('/api/admin/comments/:id/approve', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const comment = await prisma.comment.update({
            where: { id: req.params.id },
            data: {
                isReported: false,
                reportedAt: null,
                reportedBy: null
            }
        });

        res.json(comment);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// ==========================================
// ADMIN - VIEW AS CUSTOMER (Impersonation)
// ==========================================

// Generate a customer token for admin to "view as" a specific customer
app.post('/api/admin/customers/:id/impersonate', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const customer = await prisma.customer.findUnique({
            where: { id: req.params.id },
            select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                stageName: true,
                profilePicture: true,
                isGuest: true
            }
        });

        if (!customer) {
            return res.status(404).json({ message: 'Customer not found' });
        }

        // Generate a customer token for the admin to use
        const customerToken = jwt.sign(
            {
                id: customer.id,
                email: customer.email,
                impersonatedBy: req.user.id // Track who is impersonating
            },
            JWT_CUSTOMER_SECRET,
            { expiresIn: '1h' } // Short expiry for security
        );

        console.log(`[ADMIN] User ${req.user.username} is impersonating customer ${customer.email}`);

        res.json({
            token: customerToken,
            customer: {
                id: customer.id,
                email: customer.email,
                firstName: customer.firstName,
                lastName: customer.lastName,
                stageName: customer.stageName,
                profilePicture: customer.profilePicture,
                isGuest: customer.isGuest
            },
            message: `You are now viewing as ${customer.email}. Token expires in 1 hour.`
        });

    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// ==========================================
// ADMIN METRICS ENDPOINTS
// ==========================================

// Get order metrics for admin dashboard
app.get('/api/admin/metrics/orders', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { period = '30d' } = req.query;

        // Calculate date range
        const now = new Date();
        let startDate;
        switch (period) {
            case '7d':
                startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                break;
            case '90d':
                startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
                break;
            case '30d':
            default:
                startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        }

        // Get orders within period
        const orders = await prisma.order.findMany({
            where: {
                createdAt: { gte: startDate }
            },
            select: {
                id: true,
                total: true,
                status: true,
                paymentStatus: true,
                createdAt: true
            }
        });

        // Calculate metrics
        const totalOrders = orders.length;
        const completedOrders = orders.filter(o => o.status === 'COMPLETED').length;
        const pendingOrders = orders.filter(o => o.status === 'PENDING').length;
        const cancelledOrders = orders.filter(o => o.status === 'CANCELLED').length;

        const paidOrders = orders.filter(o => o.paymentStatus === 'PAID');
        const totalRevenue = paidOrders.reduce((sum, o) => sum + o.total, 0);
        const avgOrderValue = paidOrders.length > 0 ? totalRevenue / paidOrders.length : 0;

        // Orders by status
        const ordersByStatus = {
            COMPLETED: completedOrders,
            PENDING: pendingOrders,
            CANCELLED: cancelledOrders,
            REFUNDED: orders.filter(o => o.status === 'REFUNDED').length
        };

        // Orders by payment status
        const ordersByPaymentStatus = {
            PAID: paidOrders.length,
            PENDING: orders.filter(o => o.paymentStatus === 'PENDING').length,
            FAILED: orders.filter(o => o.paymentStatus === 'FAILED').length,
            REFUNDED: orders.filter(o => o.paymentStatus === 'REFUNDED').length
        };

        // Orders over time (group by day)
        const ordersByDay = {};
        orders.forEach(order => {
            const day = order.createdAt.toISOString().split('T')[0];
            if (!ordersByDay[day]) {
                ordersByDay[day] = { count: 0, revenue: 0 };
            }
            ordersByDay[day].count++;
            if (order.paymentStatus === 'PAID') {
                ordersByDay[day].revenue += order.total;
            }
        });

        // Convert to array sorted by date
        const revenueByDay = Object.entries(ordersByDay)
            .map(([date, data]) => ({ date, ...data }))
            .sort((a, b) => new Date(a.date) - new Date(b.date));

        // Get previous period for comparison
        const prevStartDate = new Date(startDate.getTime() - (now.getTime() - startDate.getTime()));
        const prevOrders = await prisma.order.findMany({
            where: {
                createdAt: {
                    gte: prevStartDate,
                    lt: startDate
                },
                paymentStatus: 'PAID'
            },
            select: { total: true }
        });

        const prevRevenue = prevOrders.reduce((sum, o) => sum + o.total, 0);
        const revenueChange = prevRevenue > 0
            ? ((totalRevenue - prevRevenue) / prevRevenue * 100).toFixed(1)
            : totalRevenue > 0 ? 100 : 0;

        res.json({
            period,
            totalOrders,
            completedOrders,
            pendingOrders,
            totalRevenue: parseFloat(totalRevenue.toFixed(2)),
            avgOrderValue: parseFloat(avgOrderValue.toFixed(2)),
            ordersByStatus,
            ordersByPaymentStatus,
            revenueByDay,
            comparison: {
                prevRevenue: parseFloat(prevRevenue.toFixed(2)),
                revenueChange: parseFloat(revenueChange)
            }
        });
    } catch (error) {
        console.error('[METRICS] Error fetching order metrics:', error.message);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// ==========================================
// CRON ENDPOINTS
// ==========================================

// Check for expiring downloads and send warning emails
// Should be called daily by an external cron service (e.g., cron-job.org)
app.get('/api/cron/check-expiring-downloads', async (req, res) => {
    try {
        // Verify cron secret
        const cronSecret = req.query.secret;
        if (!cronSecret || cronSecret !== process.env.CRON_SECRET) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        // Find orders expiring in 24-48 hours
        const now = new Date();
        const in24Hours = new Date(now.getTime() + 24 * 60 * 60 * 1000);
        const in48Hours = new Date(now.getTime() + 48 * 60 * 60 * 1000);

        const expiringOrders = await prisma.order.findMany({
            where: {
                downloadExpiresAt: {
                    gte: in24Hours,
                    lte: in48Hours
                },
                paymentStatus: 'PAID',
                status: 'COMPLETED'
            },
            include: {
                customer: true,
                items: {
                    include: {
                        beat: { select: { title: true } }
                    }
                }
            }
        });

        let emailsSent = 0;
        let notificationsCreated = 0;

        for (const order of expiringOrders) {
            // Check if we already sent a warning for this order
            const existingNotification = await prisma.notification.findFirst({
                where: {
                    customerId: order.customerId,
                    type: 'DOWNLOAD_EXPIRING',
                    data: {
                        path: ['orderNumber'],
                        equals: order.orderNumber
                    }
                }
            });

            if (!existingNotification) {
                // Send warning email
                await sendExpiryWarningEmail(order);
                emailsSent++;

                // Create notification
                await createNotification(
                    order.customerId,
                    'DOWNLOAD_EXPIRING',
                    'Download Link Expiring Soon',
                    `Your download link for order ${order.orderNumber} expires soon. Download your beats now!`,
                    {
                        orderNumber: order.orderNumber,
                        downloadToken: order.downloadToken,
                        expiresAt: order.downloadExpiresAt,
                        actionUrl: `/download/${order.downloadToken}`
                    }
                );
                notificationsCreated++;
            }
        }

        console.log(`[CRON] Expiring downloads check: ${expiringOrders.length} orders found, ${emailsSent} emails sent, ${notificationsCreated} notifications created`);

        res.json({
            message: 'Expiring downloads check completed',
            ordersChecked: expiringOrders.length,
            emailsSent,
            notificationsCreated
        });
    } catch (error) {
        console.error('[CRON] Error checking expiring downloads:', error.message);
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
        console.warn('[MIGRATE] Continuing without migrations (database may be unavailable)...');
        // Continue anyway for local development
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
