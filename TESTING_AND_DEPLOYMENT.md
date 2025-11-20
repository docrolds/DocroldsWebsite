# Testing and Deployment Guide - Doc Rolds Website

## 📋 Project Overview

- **Frontend**: React + Vite (Deployed to Vercel)
- **Backend**: Express.js + MongoDB (Deployed to Render)
- **Local Development**: Both frontend and backend run locally

---

## 🚀 Local Development Setup

### Prerequisites
- Node.js v18+ installed
- npm installed
- Git configured

### Step 1: Install Dependencies

```bash
# Install root-level dependencies
npm install

# Install backend dependencies
cd backend
npm install
cd ..

# Install frontend dependencies
cd frontend
npm install
cd ..
```

### Step 2: Configure Backend Environment

The `.env` file is already created in `/backend`. For local testing without MongoDB:

**File: `backend/.env`**
```env
PORT=3000
JWT_SECRET=test-secret-key-change-in-production
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/database?appName=DocRoldsAPI
```

- **Without MongoDB**: API returns mock data (default beats loaded)
- **With MongoDB**: Data persists in database (required for production)

### Step 3: Start Development Servers

Open **two terminal windows**:

**Terminal 1 - Backend:**
```bash
cd backend
npm run dev
# or: node server.cjs
```

Expected output:
```
Server running on http://localhost:3000
⚠ Running without MongoDB - database features disabled
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
```

Expected output:
```
➜  Local:   http://localhost:5173/
➜  Network: http://192.168.254.69:5173/
```

### Step 4: Access the Application

- **Main Website**: http://localhost:5173/
- **Beats Page**: http://localhost:5173/beats.html
- **Login Page**: http://localhost:5173/login.html
- **Admin Dashboard**: http://localhost:5173/admin.html

### Step 5: Test Login (Without MongoDB)

Default admin credentials:
- **Username**: `admin`
- **Password**: `admin123`

⚠️ **Note**: Login will **NOT** work without MongoDB because user authentication requires database access.

---

## 🔧 Setting Up MongoDB for Full Functionality

### Option 1: MongoDB Atlas Cloud (Recommended)

1. **Create Account**: https://www.mongodb.com/cloud/atlas
2. **Create Cluster**: Free tier available
3. **Get Connection String**:
   - Go to Cluster → Connect
   - Choose "Drivers" → Node.js
   - Copy the connection string
4. **Update `.env`**:
   ```env
   MONGODB_URI=mongodb+srv://yourUsername:yourPassword@cluster.mongodb.net/docrolds?retryWrites=true&w=majority
   ```
5. **Restart Backend**: `node server.cjs`

### Option 2: Local MongoDB

1. **Install MongoDB**: https://docs.mongodb.com/manual/installation/
2. **Start MongoDB**:
   ```bash
   mongod
   ```
3. **Update `.env`**:
   ```env
   MONGODB_URI=mongodb://localhost:27017/docrolds
   ```
4. **Restart Backend**: `node server.cjs`

### Verify Connection

After setting MONGODB_URI and restarting:

```bash
curl http://localhost:3000/api/users
```

Should return:
```json
[{"_id":"...", "username":"admin", "email":"admin@docrolds.com", "role":"admin"}]
```

---

## ✅ Testing Checklist

### Frontend Tests

- [ ] Navigate to http://localhost:5173
- [ ] Click through all pages (Home, Beats, Services)
- [ ] Check that beats load and display correctly
- [ ] Test responsive design (try different screen sizes)
- [ ] Verify links and buttons work

### Backend API Tests

```bash
# Get all beats (should work without MongoDB)
curl http://localhost:3000/api/beats

# Login attempt
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'

# Get users (requires valid JWT token and MongoDB)
curl http://localhost:3000/api/users \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

### Admin Dashboard Tests (Requires MongoDB)

1. Go to http://localhost:5173/login.html
2. Login with `admin` / `admin123`
3. Check **Users** section - should see admin user
4. Check **Beats** section - should see mock beats
5. Check **Team** section - should be empty initially
6. Try adding a new user/beat (requires MongoDB)

### CORS Tests

The backend now accepts:
- `http://localhost:3000`
- `http://localhost:5173`
- `http://127.0.0.1:5173`
- `http://127.0.0.1:3000`
- `https://docrolds-frontend.vercel.app`
- `https://www.docrolds.com`

---

## 🚀 Deployment Guide

### Phase 1: Backend Deployment (Render)

#### Step 1: Push Backend to GitHub

```bash
cd backend
git init
git add .
git commit -m "Initial backend setup"
git remote add origin https://github.com/yourusername/docrolds-api.git
git push -u origin main
```

#### Step 2: Deploy to Render

1. Go to https://render.com
2. Sign up / Login
3. Click **"New +"** → **"Web Service"**
4. Connect your GitHub repository `docrolds-api`
5. Configure:
   - **Name**: `docrolds-api`
   - **Environment**: `Node`
   - **Region**: Choose closest to you
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
6. Click **"Create Web Service"**

#### Step 3: Set Environment Variables in Render

1. Go to your service settings
2. Click **"Environment"**
3. Add these variables:
   - `PORT`: `3000`
   - `JWT_SECRET`: Generate a strong key (e.g., `$(openssl rand -base64 32)`)
   - `MONGODB_URI`: Your MongoDB Atlas connection string

#### Step 4: Verify Deployment

- Check Render dashboard for deployment logs
- Your backend URL will be: `https://docrolds-api.onrender.com`
- Test: `curl https://docrolds-api.onrender.com/api/beats`

### Phase 2: Frontend Deployment (Vercel)

#### Step 1: Update Environment Variables

**File: `frontend/.env.production`**
```env
VITE_API_URL=https://docrolds-api.onrender.com/api
```

Replace `docrolds-api` with your actual Render service name.

#### Step 2: Push Frontend to GitHub

```bash
cd frontend
git init
git add .
git commit -m "Initial frontend setup"
git remote add origin https://github.com/yourusername/docrolds-frontend.git
git push -u origin main
```

#### Step 3: Deploy to Vercel

1. Go to https://vercel.com
2. Sign up / Login
3. Click **"Add New..."** → **"Project"**
4. Import your GitHub repository `docrolds-frontend`
5. Configure:
   - **Framework**: `Vite`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
6. Click **"Deploy"**

#### Step 4: Set Environment Variables in Vercel

1. Go to Project Settings → **"Environment Variables"**
2. Add:
   - **Key**: `VITE_API_URL`
   - **Value**: `https://docrolds-api.onrender.com/api`
3. Redeploy the project

#### Step 5: Verify Deployment

- Check Vercel dashboard for deployment status
- Your frontend URL will be shown (e.g., `https://docrolds-frontend.vercel.app`)
- Visit the URL and test all features

---

## 🔒 Security Checklist Before Production

- [ ] Change default admin password
- [ ] Generate strong JWT_SECRET (minimum 32 characters)
- [ ] Use HTTPS everywhere (automatic on Vercel/Render)
- [ ] Configure CORS properly (only allow trusted origins)
- [ ] Validate all user inputs
- [ ] Set up MongoDB backups
- [ ] Enable MongoDB IP whitelist
- [ ] Monitor logs and errors
- [ ] Set up error tracking (optional: Sentry, Rollbar)

---

## 🐛 Troubleshooting

### Issue: Backend won't start

**Error**: `EADDRINUSE: address already in use :::3000`

**Solution**:
```bash
# Windows
taskkill /F /IM node.exe

# macOS/Linux
lsof -ti:3000 | xargs kill -9
```

### Issue: Frontend can't connect to backend

**Error**: CORS error or API calls hanging

**Solutions**:
1. Verify backend is running: `curl http://localhost:3000/api/beats`
2. Check frontend `.env.development`:
   ```env
   VITE_API_URL=http://localhost:3000/api
   ```
3. Verify CORS configuration in `backend/server.cjs`

### Issue: Login fails even with correct credentials

**Error**: Authentication error or "Invalid credentials"

**Cause**: MongoDB not connected or not initialized

**Solution**:
1. Set up MongoDB (see "Setting Up MongoDB" section)
2. Verify `MONGODB_URI` in `backend/.env`
3. Restart backend: `npm run dev`

### Issue: Beats not loading on /beats.html

**Error**: Empty playlist or mock data not showing

**Solutions**:
1. Check browser console for errors
2. Verify API endpoint: `curl http://localhost:3000/api/beats`
3. Check that `VITE_API_URL` is set correctly

### Issue: File uploads not working (Render deployment)

**Cause**: Render free tier has ephemeral storage

**Solutions**:
1. Upgrade to paid tier with persistent disk
2. Migrate file storage to AWS S3
3. Store file metadata in MongoDB only

### Issue: MongoDB connection timeout

**Error**: `querySrv ENOTFOUND _mongodb._tcp...`

**Solutions**:
1. Verify MongoDB URI is correct
2. Check IP whitelist on MongoDB Atlas
3. Verify internet connection
4. For local development: skip MongoDB and use mock data

---

## 📊 API Endpoints Summary

### Public Endpoints (No Auth Required)

- `GET /api/beats` - Get all beats
- `POST /api/auth/login` - Login

### Protected Endpoints (Require JWT Token)

- `GET /api/users` - Get all users
- `POST /api/users` - Create user
- `PUT /api/users/:id` - Update user
- `DELETE /api/users/:id` - Delete user
- `POST /api/beats` - Create beat
- `PUT /api/beats/:id` - Update beat
- `DELETE /api/beats/:id` - Delete beat

### File Uploads

- Beats: Audio + Cover Art
- Photos: Team member photos
- Path: `/uploads/` (local) or persistent storage (production)

---

## 🎯 Next Steps

1. ✅ Local development working
2. ⬜ Set up MongoDB
3. ⬜ Deploy backend to Render
4. ⬜ Deploy frontend to Vercel
5. ⬜ Configure custom domain (optional)
6. ⬜ Set up CI/CD pipeline (optional)
7. ⬜ Monitor production (optional)

---

## 📞 Support

For issues:
1. Check this guide's troubleshooting section
2. Review application logs
3. Check GitHub issues/discussions
4. Contact support

---

**Last Updated**: November 2025
**Status**: Ready for local testing and deployment
