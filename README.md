# Twitter Clone

A modern, scalable Twitter-like social media platform built with React, TypeScript, Node.js, and PostgreSQL.

## Quick Answer to Your Questions

### Should I use JS/CSS?
**Yes, but with TypeScript + Tailwind CSS**
- TypeScript (superset of JavaScript) for type safety and better developer experience
- Tailwind CSS for rapid, utility-first styling
- Modern JavaScript (ES6+) features throughout

### Should I use Tailwind?
**Absolutely!** Tailwind is perfect for this project because:
- Rapid UI development with utility classes
- Consistent design system
- Smaller bundle sizes than traditional CSS frameworks
- Easy to customize

### Should I use C?
**No!** C is for low-level system programming (operating systems, embedded devices). For web applications, you want:
- **Frontend**: TypeScript + React
- **Backend**: Node.js (also JavaScript/TypeScript)
- **Database**: PostgreSQL
- **Styling**: Tailwind CSS

## What This Project Includes

### Core Features
- [x] User authentication (sign up, login, logout)
- [x] User profiles with followers/following
- [x] Tweet creation (280 characters)
- [x] Home timeline feed
- [x] Likes and retweets
- [x] Reply threads
- [x] Real-time updates
- [x] Media uploads (images, videos)
- [x] Search (tweets and users)
- [x] Notifications
- [x] Direct messages

### Technology Stack

**Frontend:**
- React 18+ with TypeScript
- Tailwind CSS for styling
- Vite for blazing-fast builds
- React Query for data fetching
- React Router for navigation

**Backend:**
- Node.js with Express/Fastify
- TypeScript for type safety
- PostgreSQL for data storage
- Redis for caching
- Socket.io for real-time features

**Infrastructure:**
- Docker for containerization
- GitHub Actions for CI/CD
- Vercel (frontend hosting)
- Railway/Fly.io (backend hosting)

## Project Structure Options

### Option 1: Monorepo (Recommended for Learning)
```
twitter-clone/
├── frontend/              # React app
│   ├── src/
│   │   ├── components/   # Reusable UI components
│   │   ├── pages/        # Page components
│   │   ├── hooks/        # Custom React hooks
│   │   ├── api/          # API client
│   │   └── types/        # TypeScript types
│   ├── public/           # Static assets
│   └── package.json
│
├── backend/              # Express API
│   ├── src/
│   │   ├── routes/       # API routes
│   │   ├── controllers/  # Request handlers
│   │   ├── models/       # Database models
│   │   ├── middleware/   # Auth, validation, etc.
│   │   └── services/     # Business logic
│   └── package.json
│
├── shared/               # Shared code
│   └── types/            # Shared TypeScript types
│
└── docker-compose.yml    # Local development
```

### Option 2: Next.js Full-Stack (Faster Setup)
```
twitter-clone/
├── app/                  # Next.js App Router
│   ├── (auth)/          # Auth pages
│   ├── (main)/          # Main app pages
│   └── api/             # API routes
├── components/          # React components
├── lib/                 # Database, utilities
└── prisma/              # Database schema
```

## Getting Started

### Prerequisites
- Node.js 18+ installed
- PostgreSQL installed locally (or use Docker)
- Git for version control

### Quick Start

I can help you set up either option. Which would you prefer?

**Option 1 (Monorepo)**: Better separation, more flexible, great for learning full-stack development

**Option 2 (Next.js)**: Faster to get started, all-in-one framework, simpler deployment

## How Twitter Systems Work

### 1. Tweet Feed Generation
- When you follow someone, their tweets appear in your feed
- Feeds are cached in Redis for performance
- New tweets are "fan-out" to followers' feeds

### 2. Engagement System
- Likes, retweets, and replies are separate tables
- Counts are denormalized (stored on tweet) for performance
- Updated via database triggers or application logic

### 3. Real-Time Updates
- WebSocket connection to server
- Server pushes new tweets, likes, notifications
- Client updates UI without page refresh

### 4. Follow Relationships
- Many-to-many relationship in database
- Follower count cached for performance
- Graph-like queries for "who to follow" suggestions

### 5. Media Handling
- Images/videos uploaded to S3-compatible storage
- URLs stored in database
- CDN for fast global delivery

### 6. Search
- Elasticsearch indexes all tweets
- Full-text search with relevance ranking
- Updates near real-time

### 7. Notifications
- Triggered by actions (follow, like, retweet, mention)
- Stored in database
- Delivered via WebSocket for real-time updates

## Development Phases

### Phase 1: Foundation (Week 1-2)
- Set up project structure
- User authentication
- Basic tweet CRUD
- Simple timeline

### Phase 2: Core Features (Week 3-4)
- Follow system
- Likes and retweets
- User profiles
- Reply threads

### Phase 3: Polish (Week 5-6)
- Media uploads
- Real-time updates
- Notifications
- Search

### Phase 4: Scale (Week 7+)
- Performance optimization
- Caching layer
- Deployment
- Monitoring

## Learning Resources

- **Full Architecture**: See [ARCHITECTURE.md](./ARCHITECTURE.md)
- **React**: https://react.dev
- **TypeScript**: https://www.typescriptlang.org/docs
- **Tailwind CSS**: https://tailwindcss.com/docs
- **Node.js**: https://nodejs.org/docs
- **PostgreSQL**: https://www.postgresql.org/docs

## Next Steps

1. **Choose your approach** (monorepo vs Next.js)
2. **Tell me your preference** and I'll set up the entire project structure
3. **Start coding!** I'll guide you through each feature

## Questions?

Let me know:
- Which project structure you prefer (Option 1 or 2)
- Your experience level with web development
- Any specific features you want to prioritize

I'll set everything up for you and get you started!

---

**Built with care to make social media better**
