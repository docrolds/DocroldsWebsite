# Doc Rolds API - Backend

Node.js Express server for the Doc Rolds website.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create `.env` file:
```bash
cp .env.example .env
```

3. Update `.env` with your JWT_SECRET

## Running Locally

```bash
npm start
```

Server runs on `http://localhost:3000`

**Default Admin Credentials:**
- Username: `admin`
- Password: `admin123`

## Deployment to Render

1. Create a new Render service at https://render.com
2. Connect your GitHub repository
3. Render will automatically detect `render.yaml` for deployment configuration
4. Set environment variables in Render dashboard:
   - `JWT_SECRET`: Generate a strong secret
   - `PORT`: Will be set automatically by Render

## API Endpoints

- **Auth**: `/api/auth/login`
- **Users**: `/api/users`, `/api/users/:id`
- **Beats**: `/api/beats`, `/api/beats/:id`
- **Photos**: `/api/photos`, `/api/photos/:id`
- **Uploads**: `/uploads/*`

## Data Persistence

Data is stored in `data.json` in the project root. On Render, ensure you configure a persistent disk volume for `/data.json`.

> **Note**: For production, migrate to a proper database (MongoDB, PostgreSQL) instead of file-based storage.
