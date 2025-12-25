# Twitter Clone - System Architecture

## Executive Summary

This document outlines the architecture for a scalable Twitter-like social media platform. The goal is to create a modern, maintainable application that can handle core Twitter features while being accessible to developers.

## Technology Stack Recommendation

### Frontend
- **Framework**: React with TypeScript
- **Styling**: Tailwind CSS
- **State Management**: React Query + Zustand
- **Build Tool**: Vite
- **Routing**: React Router

**Why?**
- React has the largest ecosystem and community
- TypeScript prevents bugs and improves developer experience
- Tailwind CSS allows rapid UI development with utility classes
- Vite provides lightning-fast development builds

### Backend
- **Runtime**: Node.js
- **Framework**: Express.js or Fastify
- **Language**: TypeScript
- **API Style**: REST + GraphQL (optional for complex queries)
- **Real-time**: Socket.io or WebSockets

**Why?**
- Node.js allows code sharing between frontend and backend
- TypeScript provides type safety across the full stack
- Express/Fastify are proven, performant frameworks
- Socket.io enables real-time features (live tweets, notifications)

### Database
- **Primary Database**: PostgreSQL
- **Cache Layer**: Redis
- **Search**: Elasticsearch (for tweet search)
- **File Storage**: AWS S3 or Cloudflare R2

**Why?**
- PostgreSQL handles complex relationships (followers, likes, retweets)
- Redis caches feeds and reduces database load
- Elasticsearch enables full-text search at scale
- S3-compatible storage for images, videos, profile pictures

### Infrastructure
- **Containerization**: Docker
- **Orchestration**: Docker Compose (dev), Kubernetes (production)
- **CI/CD**: GitHub Actions
- **Hosting**: Vercel (frontend), Railway/Fly.io (backend)

## Why NOT C?

C is a low-level systems programming language meant for:
- Operating systems
- Embedded systems
- Performance-critical libraries

For a web application, C would be:
- Extremely time-consuming (no web frameworks)
- Prone to memory management bugs
- Lacking modern web development tools
- Difficult to find developers for

## Core Twitter Features to Build

### Phase 1: MVP (Minimum Viable Product)
1. **User Authentication**
   - Sign up / Login / Logout
   - Password reset
   - Email verification

2. **User Profiles**
   - Profile picture and banner
   - Bio, location, website
   - Join date
   - Following/Followers count

3. **Tweets**
   - Create tweet (280 characters)
   - Delete own tweets
   - View tweet feed
   - View single tweet

4. **Timeline**
   - Home feed (tweets from followed users)
   - User profile timeline
   - Chronological sorting

### Phase 2: Engagement Features
1. **Likes**
   - Like/unlike tweets
   - View liked tweets

2. **Retweets**
   - Retweet/unretweet
   - Quote tweets

3. **Replies**
   - Reply to tweets
   - View conversation threads

4. **Follow System**
   - Follow/unfollow users
   - View followers/following lists

### Phase 3: Advanced Features
1. **Media Uploads**
   - Images (up to 4 per tweet)
   - Videos
   - GIFs

2. **Notifications**
   - Real-time notifications
   - Notification feed

3. **Search**
   - Search tweets
   - Search users
   - Trending topics

4. **Direct Messages**
   - One-on-one messaging
   - Real-time chat

### Phase 4: Polish & Scale
1. **Performance**
   - Feed caching
   - Infinite scroll
   - Image optimization

2. **Moderation**
   - Block users
   - Mute users
   - Report tweets

3. **Advanced Features**
   - Lists
   - Bookmarks
   - Spaces (audio rooms)
   - Twitter Blue features

## System Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     Client (Browser)                     │
│                                                           │
│  React + TypeScript + Tailwind CSS                       │
│  - Components                                             │
│  - State Management (React Query + Zustand)              │
│  - Real-time updates (WebSocket client)                  │
└─────────────────────────────────────────────────────────┘
                          │
                          │ HTTPS / WSS
                          ▼
┌─────────────────────────────────────────────────────────┐
│                    API Gateway / CDN                     │
│                  (Cloudflare / Nginx)                    │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│                   Backend Services                       │
│                                                           │
│  ┌────────────────┐  ┌────────────────┐                 │
│  │  REST API      │  │  WebSocket     │                 │
│  │  (Express)     │  │  Server        │                 │
│  └────────────────┘  └────────────────┘                 │
│           │                   │                          │
│           └─────────┬─────────┘                          │
└─────────────────────┼────────────────────────────────────┘
                      │
        ┌─────────────┼─────────────┐
        │             │             │
        ▼             ▼             ▼
┌──────────────┐ ┌─────────┐ ┌──────────────┐
│  PostgreSQL  │ │  Redis  │ │     S3       │
│   (Primary)  │ │ (Cache) │ │  (Storage)   │
└──────────────┘ └─────────┘ └──────────────┘
        │
        ▼
┌──────────────┐
│Elasticsearch │
│   (Search)   │
└──────────────┘
```

### Database Schema (PostgreSQL)

**Key Tables:**

1. **users**
   - id, username, email, password_hash
   - display_name, bio, location, website
   - profile_image_url, banner_image_url
   - verified, created_at, updated_at

2. **tweets**
   - id, user_id, content, created_at
   - reply_to_tweet_id, retweet_of_tweet_id
   - likes_count, retweets_count, replies_count

3. **follows**
   - follower_id, following_id, created_at
   - Composite primary key (follower_id, following_id)

4. **likes**
   - user_id, tweet_id, created_at
   - Composite primary key (user_id, tweet_id)

5. **media**
   - id, tweet_id, media_type, url
   - width, height, created_at

6. **notifications**
   - id, user_id, type, content
   - read, created_at

### API Endpoints

**Authentication:**
- POST /api/auth/register
- POST /api/auth/login
- POST /api/auth/logout
- GET /api/auth/me

**Users:**
- GET /api/users/:username
- PUT /api/users/:username
- GET /api/users/:username/followers
- GET /api/users/:username/following
- POST /api/users/:username/follow
- DELETE /api/users/:username/follow

**Tweets:**
- POST /api/tweets
- GET /api/tweets/:id
- DELETE /api/tweets/:id
- GET /api/tweets (home feed)
- GET /api/tweets/user/:username
- POST /api/tweets/:id/like
- DELETE /api/tweets/:id/like
- POST /api/tweets/:id/retweet
- DELETE /api/tweets/:id/retweet

**Search:**
- GET /api/search/tweets?q=query
- GET /api/search/users?q=query

### Real-Time Features

Use WebSockets for:
- Live tweet updates in timeline
- Notification delivery
- Online status
- Typing indicators in DMs

### Caching Strategy

**Redis Cache:**
- User profiles (1 hour TTL)
- Home feed (5 minutes TTL)
- Trending topics (15 minutes TTL)
- Tweet counts (1 minute TTL)

### Security Considerations

1. **Authentication**
   - JWT tokens with refresh tokens
   - HTTP-only cookies for tokens
   - Rate limiting on auth endpoints

2. **Input Validation**
   - Sanitize all user inputs
   - Validate content length
   - Check file types for uploads

3. **Authorization**
   - Verify user owns resources before deletion
   - Check privacy settings before displaying content

4. **CORS**
   - Configure proper CORS headers
   - Whitelist allowed origins

## Getting Started - Recommended Approach

### Option 1: Monorepo with Separate Frontend/Backend
```
twitter-clone/
├── frontend/          # React + TypeScript + Vite
├── backend/           # Express + TypeScript
├── shared/            # Shared types and utilities
└── docker-compose.yml # Local development setup
```

### Option 2: Full-Stack with Next.js
```
twitter-clone/
├── app/              # Next.js 14+ App Router
├── components/       # React components
├── lib/              # Utilities and database
├── api/              # API routes
└── prisma/           # Database schema (Prisma ORM)
```

**Recommendation**: Start with Option 1 for learning and flexibility. Option 2 is faster for small teams but more opinionated.

## Development Workflow

1. **Set up development environment**
   - Install Node.js, PostgreSQL, Redis
   - Configure environment variables
   - Run database migrations

2. **Start with backend API**
   - User authentication
   - Tweet CRUD operations
   - Follow system

3. **Build frontend components**
   - Authentication forms
   - Tweet composer
   - Feed components
   - Profile pages

4. **Integrate frontend with backend**
   - API client setup
   - State management
   - Error handling

5. **Add real-time features**
   - WebSocket connection
   - Live updates
   - Notifications

6. **Performance optimization**
   - Add caching
   - Optimize queries
   - Image optimization
   - Code splitting

## Deployment

**Frontend (Vercel):**
- Automatic deployments from GitHub
- Edge network for global performance
- Built-in analytics

**Backend (Railway/Fly.io):**
- Docker container deployment
- Automatic scaling
- Database hosting

**Database:**
- Managed PostgreSQL (Supabase, Neon, or Railway)
- Redis Cloud for caching

## Next Steps

1. Choose your approach (monorepo vs Next.js)
2. Set up the project structure
3. Initialize databases
4. Build authentication first
5. Iterate on core features
6. Deploy early and often

## Resources

- **React Docs**: https://react.dev
- **Tailwind CSS**: https://tailwindcss.com
- **PostgreSQL**: https://www.postgresql.org/docs
- **Express.js**: https://expressjs.com
- **TypeScript**: https://www.typescriptlang.org

---

**Remember**: Start small, iterate quickly, and focus on core features first. Don't try to build everything at once!
