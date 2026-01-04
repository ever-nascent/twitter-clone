# System Status Page

A public-facing status page similar to Apple's System Status, showing the health of all services.

## Features

✅ **Real-time Service Monitoring**
- Checks all critical services (Database, Redis, Email, SMS, etc.)
- Color-coded status indicators (Green/Yellow/Red)
- Auto-refresh every 60 seconds

✅ **Service Categories**
- Authentication Services
- Security Services (2FA)
- Session & Account Management
- Infrastructure
- Third-Party Services

✅ **Status Types**
- **Available** (Green) - Service operational
- **Degraded** (Yellow) - Service slow but working
- **Unavailable** (Red) - Service down

## Endpoints

### Backend
```http
GET /api/status
GET /api/v1/status
```

**No authentication required** - This is a public endpoint.

### Frontend
```
http://localhost:5173/status
```

## API Response Format

```json
{
  "success": true,
  "data": {
    "overallStatus": "available",
    "lastUpdated": "2025-01-04T12:30:00.000Z",
    "services": {
      "Authentication Services": [
        {
          "name": "Account Registration",
          "status": "available",
          "description": "User registration and account creation"
        },
        {
          "name": "Login & Authentication",
          "status": "available",
          "description": "User login and session management"
        }
      ],
      "Security Services": [
        {
          "name": "Two-Factor Authentication (TOTP)",
          "status": "available",
          "description": "Authenticator app-based 2FA"
        }
      ]
    }
  }
}
```

## Service Health Checks

### Database (PostgreSQL)
- **Check**: `SELECT 1` query
- **Degraded if**: Response time > 1000ms
- **Unavailable if**: Connection fails

### Cache (Redis)
- **Check**: `PING` command
- **Degraded if**: Response time > 500ms
- **Unavailable if**: Not connected

### Email Service
- **Check**: Environment variables configured
- **Unavailable if**: Missing config in production

### SMS Service (Twilio)
- **Check**: Environment variables configured
- **Always available**: Falls back to console logging in dev

### Bot Protection (reCAPTCHA)
- **Check**: Secret key configured
- **Unavailable if**: Not configured or using default value

## How to Use

### 1. Start the Backend

Make sure you have a `.env` file in the `backend` directory:

```bash
cd backend
cp .env.example .env
# Edit .env with your credentials
npm run dev
```

### 2. Start the Frontend

```bash
cd frontend
npm run dev
```

### 3. Visit the Status Page

Open your browser to:
```
http://localhost:5173/status
```

Or test the API directly:
```bash
curl http://localhost:3001/api/status
```

## Customization

### Adding New Services

Edit `backend/src/controllers/statusController.ts`:

```typescript
const services: Service[] = [
  // ... existing services ...

  // Add your new service
  {
    name: 'My New Service',
    status: await checkMyService(), // Implement this function
    description: 'Description of the service',
  },
];
```

### Changing Auto-Refresh Interval

Edit `frontend/src/pages/StatusPage.tsx`:

```typescript
// Change from 60 seconds to your preferred interval
const interval = setInterval(fetchStatus, 60000); // milliseconds
```

### Changing Status Colors

The component uses Tailwind CSS classes. Edit in `StatusPage.tsx`:

```typescript
const getStatusColor = (status: string) => {
  switch (status) {
    case 'available':
      return 'bg-green-500';  // Change to your color
    case 'degraded':
      return 'bg-yellow-500'; // Change to your color
    case 'unavailable':
      return 'bg-red-500';    // Change to your color
  }
};
```

## Production Considerations

### 1. Caching

For high-traffic sites, cache the status response:

```typescript
// Add Redis caching with 30-second TTL
const cachedStatus = await redisClient.get('system:status');
if (cachedStatus) {
  return JSON.parse(cachedStatus);
}

// ... compute status ...

await redisClient.setEx('system:status', 30, JSON.stringify(status));
```

### 2. External Monitoring

Consider adding external health checks from:
- **UptimeRobot** (free)
- **Pingdom**
- **Better Uptime**

These can monitor your `/api/status` endpoint and alert you if it goes down.

### 3. Status History (Future Enhancement)

To track uptime over time like Apple:

```sql
-- Create status_checks table
CREATE TABLE status_checks (
  id SERIAL PRIMARY KEY,
  service_name VARCHAR(100),
  status VARCHAR(20),
  response_time_ms INTEGER,
  checked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Run checks every minute via cron
-- Calculate uptime percentages from historical data
```

### 4. CDN/Static Hosting

For maximum reliability, host the status page separately:
- **Cloudflare Pages** (free)
- **Netlify** (free)
- **GitHub Pages** (free)

This way users can check status even if your main server is down.

## Design Philosophy (Apple-Style)

1. **Simplicity** - Just a list of services with status dots
2. **Clarity** - Clear status indicators (green = good)
3. **Minimal** - No graphs, no clutter
4. **Fast** - Loads instantly, updates seamlessly
5. **Public** - No login required

## Screenshots

The status page will look like this:

```
┌─────────────────────────────────────────────────┐
│              System Status                      │
│    Last updated 9:16 AM PST                     │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│        ● All Systems Operational                │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│ Authentication Services                         │
├─────────────────────────────────────────────────┤
│ ● Account Registration        [Available]      │
│ ● Login & Authentication      [Available]      │
│ ● Password Reset              [Available]      │
│ ● Email Verification          [Available]      │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│ Security Services                               │
├─────────────────────────────────────────────────┤
│ ● TOTP 2FA                    [Available]      │
│ ● SMS 2FA                     [Available]      │
│ ● Email 2FA                   [Available]      │
│ ● Trusted Devices             [Available]      │
└─────────────────────────────────────────────────┘

... and more categories
```

## Files Created

1. **Backend Controller**: `backend/src/controllers/statusController.ts`
   - Contains all health check logic

2. **Backend Route**: `backend/src/routes/statusRoutes.ts`
   - Defines `/api/status` endpoint

3. **Frontend Page**: `frontend/src/pages/StatusPage.tsx`
   - React component for the status UI

4. **Server Integration**: `backend/src/server.ts`
   - Routes registered

5. **App Router**: `frontend/src/App.tsx`
   - `/status` route added

## Next Steps

**Phase 1 (Optional):**
- Add incident history tracking
- Add uptime percentages (90-day)
- Add status change notifications

**Phase 2 (Optional):**
- Separate status page deployment (CDN)
- External monitoring integration
- Historical data visualization

**Phase 3 (Optional):**
- Admin panel to post incidents manually
- Subscriber notifications (email when service down)
- Public incident timeline

---

**Questions?** The status page is fully functional and ready to use! Just start your backend and frontend servers.
