# Doc Rolds Admin System

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

1. Copy `.env.example` to `.env` (optional, defaults are provided)
2. Update `JWT_SECRET` with a strong secret key for production

### 3. Start the Server

```bash
npm run server
```

The server will start on http://localhost:3000

### 4. Start the Frontend (in a separate terminal)

```bash
npm run dev
```

Or run both together:

```bash
npm start
```

## Default Admin Credentials

- **Username**: admin
- **Password**: admin123

**Important**: Change these credentials after first login!

## Features

### Login System
- JWT-based authentication
- Secure password hashing with bcrypt
- Session management

### Admin Dashboard
- Modern dark theme UI
- Sidebar navigation
- User profile display

### Users Management
- View all users
- Add new users
- Edit existing users
- Delete users
- Role-based access (admin/user)

### Beats Management
- View all beats
- Upload new beats with audio files
- Edit beat information
- Delete beats
- Automatic file storage with image compression

### Team Management
- Manage team member profiles
- Upload team member photos
- Assign multiple roles to team members
- Add custom roles (custom titles)
- Add credits and bio information
- Toggle visibility on home page

## API Endpoints

### Authentication
- `POST /api/auth/login` - Login with username/password

### Users
- `GET /api/users` - Get all users (requires auth)
- `POST /api/users` - Create new user (requires auth)
- `PUT /api/users/:id` - Update user (requires auth)
- `DELETE /api/users/:id` - Delete user (requires auth)

### Beats
- `GET /api/beats` - Get all beats (public)
- `POST /api/beats` - Create new beat (requires auth)
- `PUT /api/beats/:id` - Update beat (requires auth)
- `DELETE /api/beats/:id` - Delete beat (requires auth)

### Photos (Team Members)
- `GET /api/photos` - Get all photos (public)
- `POST /api/photos` - Create new photo (requires auth)
- `PUT /api/photos/:id` - Update photo (requires auth)
- `DELETE /api/photos/:id` - Delete photo (requires auth)

## File Structure

```
Test 2/
├── server.cjs          # Express backend server (Node.js)
├── admin.html          # Admin dashboard UI
├── admin.js            # Admin dashboard logic
├── login.html          # Login page
├── beats.html          # Public beats page
├── index.html          # Main website home page
├── src/                # React components
│   ├── components/     # Reusable components (Team, Hero, etc.)
│   ├── App.jsx         # Main app component
│   └── App.css         # Global styles
├── uploads/            # Uploaded files (photos, beats)
├── .env               # Environment variables (create from .env.example)
└── .env.example       # Environment variables template
```

## Data Storage

**Important**: Currently, all data (users, beats, photos) is stored in-memory only. This means:
- Data is **reset when the server restarts**
- Changes are **not persisted** between sessions
- This is suitable for development/testing only

### For Production:
You must implement a database such as:
- MongoDB
- PostgreSQL
- MySQL
- Firebase

Update the API endpoints to store/retrieve data from your chosen database instead of in-memory arrays.

## Security Notes

1. Change the JWT_SECRET in production (use `.env` file)
2. Use HTTPS in production
3. Change default admin password immediately after setup
4. Keep dependencies updated
5. Don't commit `.env` file to version control
6. Never hardcode secrets in code

## Troubleshooting

### Server won't start
- Make sure port 3000 is not in use
- Check that all dependencies are installed

### Can't login
- Verify server is running
- Check browser console for errors
- Ensure credentials are correct

### File uploads not working
- Check that `uploads/` directory exists
- Verify file permissions
- Check file size limits

## Next Steps

1. **Database Migration**: Set up a production database (MongoDB, PostgreSQL, etc.) and migrate from in-memory storage
2. **Session Management**: Implement proper token expiration and refresh mechanism
3. **Authentication**: Add email verification for new users
4. **Password Recovery**: Implement password reset functionality
5. **Dashboard Analytics**: Add stats and charts to the dashboard
6. **Deployment**: Prepare for production deployment (Docker, cloud hosting, etc.)
