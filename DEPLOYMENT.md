# Deployment Guide - Frontend & Backend Split

This guide explains how to deploy the frontend to Vercel and the backend to Render.

## Backend Deployment (Render)

### Step 1: Push Backend to GitHub

```bash
cd backend
git init
git add .
git commit -m "Initial backend setup"
git remote add origin https://github.com/yourusername/docrolds-api.git
git push -u origin main
```

### Step 2: Create Render Service

1. Go to https://render.com and sign up
2. Click "New +" → "Web Service"
3. Connect your GitHub repository (`docrolds-api`)
4. Configure:
   - **Name**: `docrolds-api`
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
5. Add Environment Variables:
   - `JWT_SECRET`: (Generate a strong secret key)
   - `PORT`: `3000`
6. Deploy

### Step 3: Note Your Backend URL

Once deployed, Render will provide a URL like: `https://docrolds-api.onrender.com`

## Frontend Deployment (Vercel)

### Step 1: Update Backend URL

In the root directory, update `.env.production`:

```env
VITE_API_URL=https://your-render-backend-url.onrender.com/api
```

Replace `your-render-backend-url` with your actual Render service name.

### Step 2: Push Frontend to GitHub

```bash
# Remove backend from git (if it was included)
rm -rf backend

git add .env.production
git commit -m "Update backend URL for production"
git push
```

### Step 3: Deploy to Vercel

1. Go to https://vercel.com and sign up
2. Click "Add New..." → "Project"
3. Import your GitHub repository
4. Configure:
   - **Framework**: `Vite`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
5. Environment Variables:
   - `VITE_API_URL`: `https://your-render-backend-url.onrender.com/api`
6. Deploy

## Verify Deployment

1. Visit your Vercel frontend URL
2. Navigate to Admin Dashboard (login with admin/admin123)
3. Test adding a team member - it should persist after page reload

## Troubleshooting

### CORS Issues
If frontend can't connect to backend:
1. Check that `VITE_API_URL` is correct in frontend
2. Verify backend is running on Render (check logs)
3. Ensure backend `.env` has `JWT_SECRET` set

### File Uploads Not Persisting
- Render free tier has ephemeral file storage
- Configure a persistent disk volume in Render dashboard for `/data.json`
- Or migrate to a database service

### Admin Login Not Working
- Default credentials: `admin` / `admin123`
- Check backend logs for errors
- Verify `JWT_SECRET` is set in backend environment
