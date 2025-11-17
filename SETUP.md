# Doc Rolds Admin System - Complete Setup Guide

## 🚀 Quick Start

### Step 1: Install Dependencies

Open your terminal in the project directory and run:

```bash
npm install
```

This will install all required packages:
- express (backend server)
- cors (cross-origin requests)
- bcryptjs (password hashing)
- jsonwebtoken (authentication)
- multer (file uploads)
- nodemailer (email sending)
- concurrently (run multiple commands)

### Step 2: Start the Backend Server

```bash
npm run server
```

You should see:
```
Server running on http://localhost:3000
Default admin credentials:
Username: admin
Password: ***REDACTED-PASSWORD***
```

### Step 3: Start the Frontend (in a new terminal)

```bash
npm run dev
```

Or run both together:
```bash
npm start
```

### Step 4: Access the System

1. **Main Website**: http://localhost:5173/
2. **Beats Page**: http://localhost:5173/beats.html
3. **Admin Login**: http://localhost:5173/login.html
4. **Admin Dashboard**: http://localhost:5173/admin.html (after login)

## 🔐 Login Credentials

**Default Admin Account:**
- Username: `admin`
- Password: `***REDACTED-PASSWORD***`

⚠️ **IMPORTANT**: Change these credentials after first login!

## 📋 Features Overview

### 1. Login System
- Secure JWT-based authentication
- Password hashing with bcrypt
- Session management
- Auto-redirect if not authenticated

### 2. Admin Dashboard
- Modern dark theme UI (similar to your screenshot)
- Sidebar navigation
- User profile display
- Responsive design

### 3. Beats Management
- Upload beats with audio files
- Edit beat information (title, genre, BPM, key, price)
- Delete beats
- Files stored in `/uploads` folder
- Automatically displays on beats.html

### 4. Users Management
- View all users
- Add new users
- Edit user details
- Delete users
- Role-based access (admin/user)

### 5. SMTP Email (Optional)
- Configure in `.env` file
- Send notifications
- Newsletter functionality

## 📁 File Structure

```
Test 2/
├── server.js              # Backend API server
├── admin.html             # Admin dashboard
├── admin.js               # Admin dashboard logic
├── login.html             # Login page
├── beats.html             # Public beats page (updated to fetch from API)
├── index.html             # Main website
├── package.json           # Dependencies
├── uploads/               # Uploaded beat files (auto-created)
├── .env.example           # Environment variables template
└── README_ADMIN.md        # Detailed documentation
```

## 🔧 Configuration

### SMTP Email Setup (Optional)

1. Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

2. Edit `.env` with your email settings:
```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
```

For Gmail:
- Enable 2-factor authentication
- Generate App Password: https://myaccount.google.com/apppasswords
- Use the app password in `.env`

## 🎵 How to Upload Beats

1. Login to admin dashboard
2. Click "Beats" in sidebar
3. Click "Add Beat" button
4. Fill in beat details:
   - Title
   - Genre
   - Category
   - BPM
   - Key
   - Duration (in seconds)
   - Price
   - Audio File (optional)
5. Click "Save"
6. Beat will appear on beats.html automatically!

## 👥 How to Manage Users

1. Login to admin dashboard
2. Click "Users" in sidebar
3. Click "Add User" to create new user
4. Edit or delete existing users
5. Assign roles (admin/user)

## 🔒 Security Features

- ✅ Password hashing with bcrypt
- ✅ JWT token authentication
- ✅ Protected API endpoints
- ✅ Auto-logout on invalid token
- ✅ Secure file uploads

## 🐛 Troubleshooting

### Server won't start
```bash
# Check if port 3000 is in use
netstat -ano | findstr :3000

# Kill the process if needed
taskkill /PID <PID> /F
```

### Can't login
- Verify server is running on port 3000
- Check browser console for errors
- Try default credentials: admin/***REDACTED-PASSWORD***

### Beats not showing
- Check server is running
- Open browser console for errors
- Verify API is accessible at http://localhost:3000/api/beats

### File uploads not working
- Check `uploads/` folder exists
- Verify file permissions
- Check file size (default limit: 10MB)

## 📊 API Endpoints

### Authentication
- `POST /api/auth/login` - Login

### Users (requires auth)
- `GET /api/users` - Get all users
- `POST /api/users` - Create user
- `PUT /api/users/:id` - Update user
- `DELETE /api/users/:id` - Delete user

### Beats
- `GET /api/beats` - Get all beats (public)
- `POST /api/beats` - Create beat (requires auth)
- `PUT /api/beats/:id` - Update beat (requires auth)
- `DELETE /api/beats/:id` - Delete beat (requires auth)

### Email (requires auth)
- `POST /api/send-email` - Send email

## 🎨 Customization

### Change Theme Colors
Edit the CSS variables in `admin.html`:
```css
/* Primary color (currently red #E83628) */
background: linear-gradient(135deg, #E83628, #c41e1e);
```

### Add More Navigation Items
Edit the sidebar in `admin.html`:
```html
<div class="nav-item" data-section="your-section">
    <i class="fas fa-icon"></i>
    <span>Your Section</span>
</div>
```

## 📝 Next Steps

1. ✅ Change default admin password
2. ✅ Upload your beats
3. ✅ Configure SMTP for emails
4. ⬜ Set up production database
5. ⬜ Deploy to production server
6. ⬜ Add SSL certificate
7. ⬜ Set up automated backups

## 💡 Tips

- Keep the server running while using the admin panel
- Uploaded files are stored in `/uploads` folder
- Beats automatically sync to beats.html
- Use Chrome DevTools to debug issues
- Check server console for API errors

## 🆘 Need Help?

Check the detailed documentation in `README_ADMIN.md`

---

**Created for Doc Rolds Music Studio** 🎵
Dreams Over Careers
