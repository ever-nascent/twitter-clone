# Setup Guide - Twitter Clone

This guide will help you get the Twitter Clone running on your local machine.

## Prerequisites

Before you begin, make sure you have the following installed:

- **Node.js** (v18 or higher) - [Download here](https://nodejs.org/)
- **Docker** (for PostgreSQL and Redis) - [Download here](https://www.docker.com/)
- **Git** (for version control)

## Step-by-Step Setup

### 1. Install Dependencies

```bash
# Install root dependencies (for running both frontend and backend together)
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

### 2. Start Database Services

Start PostgreSQL and Redis using Docker Compose:

```bash
# Start databases in the background
npm run docker:up

# Or manually:
docker-compose up -d
```

This will:
- Start PostgreSQL on port 5432
- Start Redis on port 6379
- Automatically create the database schema from `database/init.sql`
- Create sample users and tweets for testing

### 3. Configure Environment Variables

The backend already has a `.env` file with development settings. In production, you should change these values!

Important environment variables in `backend/.env`:
- `JWT_SECRET` - Change this to a long random string in production
- `DB_PASSWORD` - Already set for development
- `FRONTEND_URL` - URL of your frontend (for CORS)

### 4. Start the Development Servers

You have two options:

#### Option A: Run Both Frontend and Backend Together (Recommended)

```bash
# From the root directory
npm run dev
```

This will start:
- Backend API on http://localhost:3001
- Frontend on http://localhost:5173

#### Option B: Run Frontend and Backend Separately

```bash
# Terminal 1 - Backend
cd backend
npm run dev

# Terminal 2 - Frontend
cd frontend
npm run dev
```

### 5. Test the Application

1. Open your browser to http://localhost:5173
2. You should see the registration page
3. Create a new account or use one of the sample accounts:
   - Email: `john@example.com`
   - Password: You need to set a proper password (the sample data has placeholder hashes)

### 6. Verify Everything is Working

Check that all services are running:

```bash
# Check backend health
curl http://localhost:3001/health

# Check PostgreSQL
docker exec -it twitter-clone-db psql -U twitter -d twitter_clone -c "SELECT COUNT(*) FROM users;"

# Check Redis
docker exec -it twitter-clone-redis redis-cli ping
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Create new account
- `POST /api/auth/login` - Login
- `POST /api/auth/logout` - Logout
- `GET /api/auth/me` - Get current user
- `POST /api/auth/refresh` - Refresh access token

## Testing the Authentication Flow

### Register a New User

```bash
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "email": "test@example.com",
    "password": "Test123456",
    "displayName": "Test User"
  }' \
  -c cookies.txt
```

### Login

```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "Test123456"
  }' \
  -c cookies.txt
```

### Get Current User

```bash
curl http://localhost:3001/api/auth/me \
  -b cookies.txt
```

## Database Access

To access the PostgreSQL database directly:

```bash
# Connect to database
docker exec -it twitter-clone-db psql -U twitter -d twitter_clone

# Useful queries:
SELECT * FROM users;
SELECT * FROM tweets;
SELECT * FROM follows;
SELECT * FROM likes;
```

## Common Issues

### Issue: "Connection refused" to PostgreSQL

**Solution:** Make sure Docker containers are running:
```bash
docker ps
# You should see twitter-clone-db and twitter-clone-redis
```

### Issue: Port already in use

**Solution:** Change the ports in:
- `docker-compose.yml` (for PostgreSQL/Redis)
- `backend/.env` (PORT variable)
- `frontend/vite.config.ts` (server.port)

### Issue: CORS errors in browser

**Solution:** Make sure `FRONTEND_URL` in `backend/.env` matches your frontend URL

### Issue: "Module not found" errors

**Solution:** Delete node_modules and reinstall:
```bash
rm -rf node_modules backend/node_modules frontend/node_modules
npm install
cd backend && npm install && cd ..
cd frontend && npm install && cd ..
```

## Stopping the Application

```bash
# Stop Docker containers
npm run docker:down

# Or manually:
docker-compose down

# Stop containers and remove volumes (WARNING: deletes all data)
docker-compose down -v
```

## Production Deployment

Before deploying to production:

1. **Change JWT_SECRET** to a long random string
2. **Use strong database passwords**
3. **Enable HTTPS** (set `secure: true` in cookie options)
4. **Set NODE_ENV=production**
5. **Use a managed PostgreSQL** service (not Docker)
6. **Use a managed Redis** service
7. **Set up proper logging and monitoring**

## Next Steps

Now that authentication is working, you can:

1. **Add Tweet Creation** - Let users post tweets
2. **Build Timeline** - Show tweets from followed users
3. **Add Follow System** - Let users follow each other
4. **Implement Likes & Retweets** - Engagement features
5. **Build User Profiles** - Show user information and their tweets
6. **Add Real-time Updates** - Use WebSockets for live feed

See `ARCHITECTURE.md` for the complete feature roadmap!

## Need Help?

- Check `AUTHENTICATION.md` for security best practices
- Read `ARCHITECTURE.md` for system design details
- Look at the code comments in `backend/src/` and `frontend/src/`
