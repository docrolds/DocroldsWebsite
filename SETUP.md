# Doc Rolds - Setup Guide

## Quick Start

### Step 1: Install Dependencies

```bash
# Backend
cd backend
npm install

# Frontend
cd ../frontend
npm install
```

### Step 2: Start the Backend Server

```bash
cd backend
node server.cjs
```

You should see:
```
[STARTUP] Server running on http://localhost:3000
Connected to PostgreSQL
```

### Step 3: Start the Frontend

```bash
cd frontend
npm run dev
```

### Step 4: Access the System

| URL | Description |
|-----|-------------|
| http://localhost:5173/ | Main Website |
| http://localhost:5173/beats | Beats Catalog |
| http://localhost:5173/login | Login (Admin & Customer) |
| http://localhost:5173/admin | Admin Dashboard |
| http://localhost:5173/dashboard | Customer Dashboard |

## Login Credentials

### Admin Account (Staging)
- Username: `admin`
- Password: `staging-admin-password`

### Test Customer
- Email: `test@docrolds.com`
- Password: `test123`

## Project Structure

```
DocroldsWebsite/
├── backend/
│   ├── server.cjs          # Express server
│   ├── prisma/              # Database schema
│   └── .env.staging         # Environment config
├── frontend/
│   ├── src/
│   │   ├── pages/           # React page components
│   │   │   ├── AdminDashboard.jsx
│   │   │   ├── AdminLoginPage.jsx
│   │   │   ├── CustomerDashboard.jsx
│   │   │   └── ...
│   │   ├── components/      # Reusable components
│   │   ├── context/         # React contexts
│   │   └── App.jsx          # Main app with routing
│   ├── index.html           # SPA entry point
│   └── vite.config.js       # Vite configuration
├── vercel.json              # Production deployment
└── vercel.staging.json      # Staging deployment
```

## Deployment

### Staging
```bash
git add .
git commit -m "Your message"
git push origin staging
```

### Production
```bash
git checkout main
git merge staging
git push origin main
```

## Environment Variables

Set these in Vercel dashboard:

| Variable | Staging | Production |
|----------|---------|------------|
| `VITE_API_URL` | `https://docrolds-staging-api.onrender.com/api` | `https://doc-rolds-api.onrender.com/api` |
