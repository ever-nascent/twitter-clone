# Windows Setup Guide - Twitter Clone

This guide is specifically for setting up the Twitter Clone on Windows.

## Prerequisites

### 1. Check if Docker Desktop is Installed

Open PowerShell and run:

```powershell
docker --version
```

You should see something like: `Docker version 24.0.x, build xxxxx`

If you see an error, **you need to install Docker Desktop**:
- Download from: https://www.docker.com/products/docker-desktop/
- Install and restart your computer
- Make sure Docker Desktop is running (check system tray)

### 2. Verify Docker Compose

Modern Docker Desktop for Windows includes Docker Compose as a plugin. Test it:

```powershell
# New way (built into Docker Desktop)
docker compose version

# Should show: Docker Compose version v2.x.x
```

### 3. Check Node.js

```powershell
node --version
npm --version
```

You should see Node v18 or higher. If not, download from https://nodejs.org/

## Step-by-Step Setup

### 1. Install Dependencies

Open PowerShell in your project directory:

```powershell
# Install root dependencies
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

### 2. Start Docker Desktop

**IMPORTANT:** Make sure Docker Desktop is running!
- Look for the Docker whale icon in your system tray
- If it's not running, start "Docker Desktop" from the Start menu
- Wait until it says "Docker Desktop is running"

### 3. Start Database Services

```powershell
# Start PostgreSQL and Redis
npm run docker:up

# Or manually:
docker compose up -d
```

**Common Issues:**

**Error: "docker compose: command not found"**
- Make sure Docker Desktop is running
- Restart Docker Desktop
- Try: `docker --version` to verify Docker is working

**Error: "port is already allocated"**
- Another program is using port 5432 or 6379
- Stop other PostgreSQL/Redis instances
- Or change ports in `docker-compose.yml`

### 4. Verify Databases are Running

```powershell
# List running containers
docker ps

# You should see:
# - twitter-clone-db (PostgreSQL)
# - twitter-clone-redis (Redis)
```

### 5. Start the Application

```powershell
# Start both frontend and backend
npm run dev
```

This will open two terminal windows:
- Backend on http://localhost:3001
- Frontend on http://localhost:5173

**Alternative:** Run them separately in different PowerShell windows:

```powershell
# Terminal 1 - Backend
cd backend
npm run dev

# Terminal 2 - Frontend (new PowerShell window)
cd frontend
npm run dev
```

### 6. Open the Application

Open your browser to: http://localhost:5173

You should see the registration page!

## Testing the Setup

### Test Backend Health

Open PowerShell:

```powershell
# Test backend is running
curl http://localhost:3001/health

# Or in browser, go to:
# http://localhost:3001/health
```

### Test Database Connection

```powershell
# Connect to PostgreSQL
docker exec -it twitter-clone-db psql -U twitter -d twitter_clone

# Once connected, try:
\dt                    # List all tables
SELECT * FROM users;   # View users
\q                     # Quit
```

### Test Redis

```powershell
# Connect to Redis
docker exec -it twitter-clone-redis redis-cli

# Once connected, try:
PING               # Should return PONG
KEYS *             # List all keys
exit               # Quit
```

## Common Windows Issues

### Issue 1: "Cannot be loaded because running scripts is disabled"

**Solution:** Enable script execution in PowerShell (as Administrator):

```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

### Issue 2: Port 5432 already in use

**Problem:** You have PostgreSQL installed locally on Windows

**Solutions:**

Option A: Stop local PostgreSQL service
```powershell
# Run as Administrator
Stop-Service postgresql-x64-14  # Adjust version number
```

Option B: Change port in `docker-compose.yml`:
```yaml
ports:
  - "5433:5432"  # Use 5433 instead
```

Then update `backend/.env`:
```
DB_PORT=5433
```

### Issue 3: WSL 2 Error

**Error:** "WSL 2 installation is incomplete"

**Solution:**
1. Open PowerShell as Administrator
2. Run: `wsl --install`
3. Restart your computer
4. Open Docker Desktop settings
5. Go to "General" → Enable "Use WSL 2 based engine"

### Issue 4: Hyper-V Not Enabled

**Solution:**
1. Open PowerShell as Administrator
2. Run:
```powershell
Enable-WindowsOptionalFeature -Online -FeatureName Microsoft-Hyper-V -All
```
3. Restart computer

### Issue 5: npm WARN deprecated

The warnings you saw are normal and can be ignored:
```
npm warn deprecated inflight@1.0.6
npm warn deprecated rimraf@3.0.2
```

These are dependencies of dependencies and don't affect functionality.

### Issue 6: npm audit vulnerabilities

```powershell
# Check what the vulnerabilities are
npm audit

# Usually safe to run (but review first):
npm audit fix
```

For moderate vulnerabilities in development dependencies, it's usually safe.

## File Paths on Windows

When editing configuration files, use Windows paths:

**DON'T:**
```
/home/user/twitter-clone
```

**DO:**
```
C:\Users\Zechariah\Desktop\Programming\Websites\twitter-clone
```

## Stopping the Application

### Stop Backend/Frontend

Just press `Ctrl+C` in the PowerShell window running the server.

### Stop Docker Containers

```powershell
# Stop and remove containers
npm run docker:down

# Or manually:
docker compose down

# Stop and remove all data (WARNING: deletes database):
docker compose down -v
```

## Useful Commands

### View Logs

```powershell
# View all container logs
docker compose logs

# View specific container
docker compose logs postgres
docker compose logs redis

# Follow logs in real-time
docker compose logs -f
```

### Restart Containers

```powershell
# Restart all
docker compose restart

# Restart specific
docker compose restart postgres
```

### Clean Up Everything

```powershell
# Stop containers
docker compose down

# Remove all unused Docker data
docker system prune -a --volumes
```

## Development Workflow on Windows

### Recommended Tools

1. **VS Code** - Best editor for this project
   - Install "ES7+ React/Redux/React-Native snippets"
   - Install "Tailwind CSS IntelliSense"
   - Install "Docker" extension

2. **Windows Terminal** - Better than PowerShell
   - Download from Microsoft Store
   - Supports multiple tabs

3. **Git Bash** - Alternative to PowerShell
   - Comes with Git for Windows
   - Unix-like commands

### Hot Reload

Both frontend and backend support hot reload:
- Edit a file
- Save it
- Changes appear automatically (no restart needed)

### Environment Variables

Backend uses `.env` file - **already created for you!**

Located at: `backend\.env`

No need to change anything for development.

## Next Steps

Once everything is running:

1. Open http://localhost:5173
2. Click "Create a new account"
3. Fill in the registration form:
   - Username: `yourname` (3+ chars, start with letter)
   - Email: `your@email.com`
   - Password: `Test123456` (8+ chars, uppercase, lowercase, number)
4. Click "Create account"
5. You should be logged in and see the home page!

## Getting Help

If you're still stuck:

1. Check Docker Desktop is running (whale icon in system tray)
2. Restart Docker Desktop
3. Run `docker ps` to see if containers are running
4. Check the error messages carefully
5. Read the main `SETUP.md` for more details

## Windows-Specific Paths

When you see commands with `/`, you can use `\` on Windows:

```powershell
# Linux/Mac style
cd /path/to/folder

# Windows style (both work in PowerShell)
cd \path\to\folder
cd path/to/folder
```

But in PowerShell, both `/` and `\` usually work fine!
