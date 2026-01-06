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
const { PrismaClient } = require('@prisma/client');
require('dotenv').config();

const prisma = new PrismaClient();
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
        console.log('[INIT] ✓ Default admin user configured');
    } catch (error) {
        console.error('[INIT] Error initializing default data:', error.message);
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

app.post('/api/beats', authenticateToken, uploadBeats.fields([
    { name: 'audioFile', maxCount: 1 },
    { name: 'wavFile', maxCount: 1 },
    { name: 'coverArt', maxCount: 1 }
]), async (req, res) => {
    try {
        const { title, genre, category, bpm, key, duration, price } = req.body;

        let audioFile = null;
        let wavFile = null;
        let coverArt = null;

        if (req.files) {
            // Handle MP3 preview file
            if (req.files.audioFile && req.files.audioFile[0]) {
                audioFile = `/uploads/${req.files.audioFile[0].filename}`;
            }

            // Handle WAV file
            if (req.files.wavFile && req.files.wavFile[0]) {
                wavFile = `/uploads/${req.files.wavFile[0].filename}`;
            }

            // Handle cover art
            if (req.files.coverArt && req.files.coverArt[0]) {
                const uploadPath = `uploads/covers/${req.files.coverArt[0].filename}`;
                const processedPath = await processCoverArt(uploadPath);
                coverArt = processedPath.replace(/\\/g, '/');
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
                wavFile,
                coverArt
            }
        });

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

        if (req.files) {
            // Handle MP3 preview file
            if (req.files.audioFile && req.files.audioFile[0]) {
                updateData.audioFile = `/uploads/${req.files.audioFile[0].filename}`;
            }

            // Handle WAV file
            if (req.files.wavFile && req.files.wavFile[0]) {
                updateData.wavFile = `/uploads/${req.files.wavFile[0].filename}`;
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

// Email configuration for contact form
const emailTransporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER || 'Docroldsllc@gmail.com',
        pass: process.env.EMAIL_APP_PASS
    }
});

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
