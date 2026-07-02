# Quick Start Guide - Doc Rolds Website

## 🎯 Get Running in 5 Minutes

### For Local Development

**Terminal 1 - Backend:**
```bash
cd backend
npm install
npm run dev
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm install
npm run dev
```

**Then visit**: http://localhost:5173

---

## 📝 What Works Now ✅

- ✅ Frontend loads and displays all pages
- ✅ Backend API running and serving data
- ✅ Beats page loads with mock data
- ✅ CORS configured for local + production
- ✅ API returns sample beats without MongoDB

## ⚠️ What Needs Setup 🔧

To get **full features** (login, user management, database):

1. **Set up MongoDB** (see TESTING_AND_DEPLOYMENT.md)
2. **Test admin login** with credentials: `admin` / `admin123`
3. **Deploy to Render** (backend) and **Vercel** (frontend)

---

## 🚀 Deploy to Production

### Backend (Render)
1. Push code to GitHub
2. Connect to Render
3. Set MONGODB_URI, JWT_SECRET
4. Deploy

### Frontend (Vercel)
1. Set VITE_API_URL to your Render backend
2. Push code to GitHub  
3. Connect to Vercel
4. Deploy

See **TESTING_AND_DEPLOYMENT.md** for detailed instructions.

---

## 🆘 Quick Fixes

**Backend won't start?**
```bash
taskkill /F /IM node.exe
npm run dev
```

**Port 3000 in use?**
```bash
# Find and kill the process
lsof -ti:3000 | xargs kill -9
```

**Frontend can't reach backend?**
- Check frontend `.env.development` has: `VITE_API_URL=http://localhost:3000/api`
- Verify backend is running: `curl http://localhost:3000/api/beats`

---

For full details, see **TESTING_AND_DEPLOYMENT.md**
