# Authentication & Security Guide

## How Companies Handle Secure Logins

### The Big Picture

When you log in to Twitter, Facebook, or any major platform, here's what happens behind the scenes:

1. **You enter credentials** (email + password)
2. **Server verifies** your password against a hashed version in the database
3. **Server issues a token** (like a temporary key card)
4. **Your browser stores the token** and sends it with every request
5. **Server validates the token** to know who you are

**Key Principle:** Never store passwords in plain text. Never send passwords except over HTTPS.

## Password Security - How Companies Do It

### ❌ What NOT to Do (Dangerous)
```javascript
// NEVER DO THIS!
const password = "myPassword123";
database.save({ password: password }); // Plain text = DISASTER

// If database is hacked, all passwords are exposed!
```

### ✅ What Companies Actually Do

**Step 1: Hashing**
```javascript
const bcrypt = require('bcrypt');

// When user signs up:
const password = "myPassword123";
const saltRounds = 10;
const hashedPassword = await bcrypt.hash(password, saltRounds);
// Result: "$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy"

// Save THIS to database, not the original password
database.save({ password_hash: hashedPassword });
```

**What is hashing?**
- One-way function: password → scrambled text
- Same password always gives same hash
- But you can't reverse: hash → password
- Even if database is stolen, hackers can't get original passwords

**Step 2: Salting**
- A "salt" is random data added to each password before hashing
- Prevents "rainbow table" attacks
- bcrypt does this automatically
- Each user gets a unique salt

**Example:**
```
User 1: password "hello123" → salt "x7k9m2" → hash "abc123def..."
User 2: password "hello123" → salt "p4n8q1" → hash "xyz789uvw..."
```
Same password, different hashes!

### Real-World Example: The 2012 LinkedIn Breach

**What happened:**
- LinkedIn stored passwords with SHA-1 hashing
- BUT: No salts were used
- Hackers stole 6.5 million password hashes
- Used rainbow tables to crack millions of passwords in hours

**The lesson:** Always use bcrypt (or Argon2) with automatic salting

## Token-Based Authentication (JWT)

### How It Works

After login succeeds, instead of asking for password every time:

1. **Server creates a JWT (JSON Web Token)**
   ```javascript
   const jwt = require('jsonwebtoken');

   const token = jwt.sign(
     { userId: user.id, username: user.username },  // Payload
     'your-secret-key',                             // Secret
     { expiresIn: '7d' }                           // Expires in 7 days
   );
   ```

2. **Server sends token to client**
   ```javascript
   res.cookie('authToken', token, {
     httpOnly: true,    // JavaScript can't access it
     secure: true,      // Only sent over HTTPS
     sameSite: 'strict', // CSRF protection
     maxAge: 7 * 24 * 60 * 60 * 1000  // 7 days
   });
   ```

3. **Client sends token with every request**
   ```
   GET /api/tweets
   Cookie: authToken=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   ```

4. **Server validates token**
   ```javascript
   const decoded = jwt.verify(token, 'your-secret-key');
   // decoded = { userId: 123, username: 'john' }
   ```

### JWT Structure

A JWT looks like this:
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEyMywidXNlcm5hbWUiOiJqb2huIn0.abc123def456
```

It's three parts separated by dots:
1. **Header** (algorithm used)
2. **Payload** (your data: userId, username)
3. **Signature** (proves it hasn't been tampered with)

**Important:** JWTs are encoded, NOT encrypted. Anyone can read the payload!
- ✅ Put user ID in JWT
- ❌ Don't put password or sensitive data in JWT

## Complete Authentication Flow

### Sign Up Flow

```
User                    Frontend                Backend                Database
 |                         |                       |                       |
 |--Submit Form---------> |                       |                       |
 |  (email, password)     |                       |                       |
 |                        |--POST /api/auth----> |                       |
 |                        |   /register           |                       |
 |                        |                       |--Check email-------> |
 |                        |                       |   exists?             |
 |                        |                       | <--No-----------------|
 |                        |                       |                       |
 |                        |                       |--Hash password        |
 |                        |                       |  (bcrypt)             |
 |                        |                       |                       |
 |                        |                       |--Save user---------> |
 |                        |                       | <--User created------|
 |                        |                       |                       |
 |                        |                       |--Generate JWT         |
 |                        |                       |                       |
 |                        | <--Set cookie---------|                       |
 |                        |    (httpOnly)         |                       |
 | <--Redirect to home----|                       |                       |
```

### Login Flow

```
User                    Frontend                Backend                Database
 |                         |                       |                       |
 |--Submit Form---------> |                       |                       |
 |  (email, password)     |                       |                       |
 |                        |--POST /api/auth----> |                       |
 |                        |   /login              |                       |
 |                        |                       |--Find user---------> |
 |                        |                       |   by email            |
 |                        |                       | <--User data---------|
 |                        |                       |   (with password_hash)|
 |                        |                       |                       |
 |                        |                       |--Compare password     |
 |                        |                       |  bcrypt.compare()     |
 |                        |                       |                       |
 |                        |                       |--Match? Yes!          |
 |                        |                       |                       |
 |                        |                       |--Generate JWT         |
 |                        |                       |                       |
 |                        | <--Set cookie---------|                       |
 |                        |    (httpOnly)         |                       |
 | <--Redirect to home----|                       |                       |
```

### Authenticated Request Flow

```
User                    Frontend                Backend                Database
 |                         |                       |                       |
 |--Click "Post Tweet"--> |                       |                       |
 |                        |--POST /api/tweets--> |                       |
 |                        |   Cookie: JWT         |                       |
 |                        |                       |                       |
 |                        |                       |--Verify JWT           |
 |                        |                       |  (middleware)         |
 |                        |                       |                       |
 |                        |                       |--Extract userId       |
 |                        |                       |  from JWT             |
 |                        |                       |                       |
 |                        |                       |--Save tweet---------> |
 |                        |                       |   (with userId)       |
 |                        |                       | <--Tweet saved--------|
 |                        | <--Success------------|                       |
 | <--Show new tweet------|                       |                       |
```

## Common Security Vulnerabilities & Fixes

### 1. SQL Injection
**❌ Vulnerable:**
```javascript
const query = `SELECT * FROM users WHERE email = '${email}'`;
// If email = "'; DROP TABLE users; --", you're hacked!
```

**✅ Safe (Use Parameterized Queries):**
```javascript
const query = 'SELECT * FROM users WHERE email = $1';
const result = await db.query(query, [email]);
```

### 2. Cross-Site Scripting (XSS)
**❌ Vulnerable:**
```javascript
// User enters: <script>stealCookies()</script>
const bio = userInput;
database.save({ bio: bio });
// Later displayed as HTML - script executes!
```

**✅ Safe (Sanitize Input):**
```javascript
const sanitizeHtml = require('sanitize-html');
const bio = sanitizeHtml(userInput, {
  allowedTags: [], // No HTML tags allowed
  allowedAttributes: {}
});
```

### 3. Cross-Site Request Forgery (CSRF)
**❌ Vulnerable:**
```javascript
// Attacker creates: <img src="https://twitter.com/api/tweets/delete/123">
// If user is logged in, their cookies are sent automatically!
```

**✅ Safe (Use SameSite Cookies):**
```javascript
res.cookie('authToken', token, {
  sameSite: 'strict', // Browser won't send cookie from other sites
  httpOnly: true
});
```

### 4. Brute Force Attacks
**❌ Vulnerable:**
```javascript
// Attacker tries 10,000 passwords per second
POST /api/auth/login
{ "email": "victim@email.com", "password": "guess1" }
POST /api/auth/login
{ "email": "victim@email.com", "password": "guess2" }
// ... continues until success
```

**✅ Safe (Rate Limiting):**
```javascript
const rateLimit = require('express-rate-limit');

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 requests per 15 minutes
  message: 'Too many login attempts, try again later'
});

app.post('/api/auth/login', loginLimiter, loginHandler);
```

### 5. Weak Passwords
**❌ Vulnerable:**
```javascript
// Allow any password
if (password.length > 0) { /* OK */ }
```

**✅ Safe (Password Requirements):**
```javascript
function validatePassword(password) {
  if (password.length < 8) {
    return 'Password must be at least 8 characters';
  }
  if (!/[A-Z]/.test(password)) {
    return 'Password must contain an uppercase letter';
  }
  if (!/[a-z]/.test(password)) {
    return 'Password must contain a lowercase letter';
  }
  if (!/[0-9]/.test(password)) {
    return 'Password must contain a number';
  }
  return null; // Valid
}
```

## Modern Authentication Patterns

### 1. Refresh Tokens (What Big Companies Use)

**Problem:** If JWT expires in 7 days, user stays logged in even if account is compromised.

**Solution:** Use short-lived access tokens + long-lived refresh tokens.

```javascript
// Access token: expires in 15 minutes
const accessToken = jwt.sign(payload, secret, { expiresIn: '15m' });

// Refresh token: expires in 30 days, stored in database
const refreshToken = generateSecureRandomToken();
await db.query(
  'INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)',
  [userId, refreshToken, new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)]
);

// Send both to client
res.cookie('accessToken', accessToken, { maxAge: 15 * 60 * 1000 });
res.cookie('refreshToken', refreshToken, { maxAge: 30 * 24 * 60 * 60 * 1000 });
```

**Flow:**
1. Access token expires after 15 minutes
2. Frontend detects 401 error
3. Sends refresh token to `/api/auth/refresh`
4. Backend validates refresh token, issues new access token
5. If refresh token is invalid/expired, user must log in again

### 2. OAuth 2.0 / Social Login

**"Sign in with Google/Twitter/GitHub"**

**Why companies use it:**
- Less passwords to manage
- Users trust Google/Twitter security
- Faster signup (no email verification needed)

**How it works:**
1. User clicks "Sign in with Google"
2. Redirected to Google's login page
3. User approves access
4. Google redirects back with a code
5. Your server exchanges code for user info
6. Create account or log in existing user

**Implementation:**
```javascript
// Using Passport.js
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;

passport.use(new GoogleStrategy({
    clientID: GOOGLE_CLIENT_ID,
    clientSecret: GOOGLE_CLIENT_SECRET,
    callbackURL: "http://localhost:3000/auth/google/callback"
  },
  async (accessToken, refreshToken, profile, done) => {
    // Find or create user
    let user = await db.findUserByGoogleId(profile.id);
    if (!user) {
      user = await db.createUser({
        googleId: profile.id,
        email: profile.emails[0].value,
        displayName: profile.displayName
      });
    }
    return done(null, user);
  }
));
```

### 3. Two-Factor Authentication (2FA)

**Extra security layer:**
1. User enters password ✅
2. System sends code to phone/email
3. User enters code ✅
4. Now fully authenticated

**Types:**
- SMS codes (least secure, but convenient)
- Authenticator apps (Google Authenticator, Authy)
- Hardware keys (YubiKey - most secure)

## Best Practices Checklist

**Password Storage:**
- ✅ Use bcrypt with salt rounds ≥ 10
- ✅ Never store plain text passwords
- ✅ Use environment variables for secrets

**Token Security:**
- ✅ Use httpOnly cookies (prevents XSS)
- ✅ Use secure flag in production (HTTPS only)
- ✅ Use sameSite: 'strict' (prevents CSRF)
- ✅ Set reasonable expiration times

**Input Validation:**
- ✅ Validate on both frontend and backend
- ✅ Sanitize all user input
- ✅ Use parameterized queries (prevents SQL injection)

**Rate Limiting:**
- ✅ Limit login attempts (5 per 15 minutes)
- ✅ Limit signup attempts (3 per hour per IP)
- ✅ Limit API calls (100 per hour per user)

**HTTPS:**
- ✅ Always use HTTPS in production
- ✅ Redirect HTTP to HTTPS
- ✅ Use HSTS headers

**Error Messages:**
- ✅ Don't reveal if email exists: "Invalid email or password" (not "Email not found")
- ✅ Don't expose stack traces in production
- ✅ Log security events for monitoring

## Implementation for Your Twitter Clone

We'll implement:

1. **Email + Password Authentication**
   - bcrypt for password hashing
   - JWT for session management
   - httpOnly cookies for token storage

2. **Security Features**
   - Rate limiting on auth endpoints
   - Password strength validation
   - Email verification (optional)
   - CSRF protection

3. **User Model**
   ```sql
   CREATE TABLE users (
     id SERIAL PRIMARY KEY,
     username VARCHAR(50) UNIQUE NOT NULL,
     email VARCHAR(255) UNIQUE NOT NULL,
     password_hash VARCHAR(255) NOT NULL,
     display_name VARCHAR(100),
     created_at TIMESTAMP DEFAULT NOW(),
     verified BOOLEAN DEFAULT FALSE
   );
   ```

4. **Auth Endpoints**
   - POST /api/auth/register
   - POST /api/auth/login
   - POST /api/auth/logout
   - GET /api/auth/me

Ready to implement this? I'll set up the complete authentication system now!
