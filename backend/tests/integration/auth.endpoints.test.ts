import request from 'supertest';
import express from 'express';
import cookieParser from 'cookie-parser';
import authRoutes from '../../src/routes/authRoutes';

// Create a test app
const app = express();
app.use(express.json());
app.use(cookieParser());
app.use('/api/auth', authRoutes);

// Mock database queries
jest.mock('../../src/config/database', () => ({
  query: jest.fn(),
  pool: {
    query: jest.fn(),
    on: jest.fn(),
  },
}));

import { query } from '../../src/config/database';
const mockQuery = query as jest.MockedFunction<typeof query>;

describe('Auth Endpoints Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/auth/register', () => {
    test('should register new user successfully', async () => {
      // Mock no existing user
      mockQuery
        .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // Check username
        .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // Check email
        .mockResolvedValueOnce({ // Insert user
          rows: [{
            id: 1,
            username: 'testuser',
            email: 'test@example.com',
            display_name: 'Test User',
            created_at: new Date(),
          }],
          rowCount: 1,
        })
        .mockResolvedValueOnce({ rows: [], rowCount: 1 }); // Insert refresh token

      const response = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'testuser',
          email: 'test@example.com',
          password: 'Test1234',
          displayName: 'Test User',
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.user.username).toBe('testuser');
      expect(response.headers['set-cookie']).toBeDefined();
    });

    test('should reject duplicate username', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ id: 1 }], rowCount: 1 });

      const response = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'existinguser',
          email: 'new@example.com',
          password: 'Test1234',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Username already taken');
    });

    test('should reject duplicate email', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // Username check
        .mockResolvedValueOnce({ rows: [{ id: 1 }], rowCount: 1 }); // Email check

      const response = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'newuser',
          email: 'existing@example.com',
          password: 'Test1234',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Email already registered');
    });

    test('should reject weak password', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'testuser',
          email: 'test@example.com',
          password: 'weak',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Password');
    });

    test('should reject invalid username', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          username: '123invalid',
          email: 'test@example.com',
          password: 'Test1234',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Username');
    });

    test('should reject invalid email', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'testuser',
          email: 'invalid-email',
          password: 'Test1234',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('email');
    });

    test('should reject missing fields', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'testuser',
          // Missing email and password
        });

      expect(response.status).toBe(400);
    });

    test('should handle database errors gracefully', async () => {
      mockQuery.mockRejectedValueOnce(new Error('Database error'));

      const response = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'testuser',
          email: 'test@example.com',
          password: 'Test1234',
        });

      expect(response.status).toBe(500);
    });
  });

  describe('POST /api/auth/login', () => {
    const hashedPassword = '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy'; // bcrypt hash of "Test1234"

    test('should login successfully with correct credentials', async () => {
      mockQuery
        .mockResolvedValueOnce({ // Find user
          rows: [{
            id: 1,
            username: 'testuser',
            email: 'test@example.com',
            password_hash: hashedPassword,
            display_name: 'Test User',
            created_at: new Date(),
          }],
          rowCount: 1,
        })
        .mockResolvedValueOnce({ rows: [], rowCount: 1 }); // Insert refresh token

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'Test1234',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.headers['set-cookie']).toBeDefined();
    });

    test('should reject wrong password', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{
          id: 1,
          password_hash: hashedPassword,
        }],
        rowCount: 1,
      });

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'WrongPassword123',
        });

      expect(response.status).toBe(401);
      expect(response.body.error).toContain('Invalid email or password');
    });

    test('should reject non-existent email', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'Test1234',
        });

      expect(response.status).toBe(401);
      expect(response.body.error).toContain('Invalid email or password');
    });

    test('should reject missing fields', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          // Missing password
        });

      expect(response.status).toBe(400);
    });
  });

  describe('Rate Limiting', () => {
    test('should rate limit login attempts', async () => {
      mockQuery.mockResolvedValue({ rows: [], rowCount: 0 });

      // Make 6 requests (limit is 5)
      const requests = [];
      for (let i = 0; i < 6; i++) {
        requests.push(
          request(app)
            .post('/api/auth/login')
            .send({
              email: 'test@example.com',
              password: 'Test1234',
            })
        );
      }

      const responses = await Promise.all(requests);
      const rateLimited = responses.filter((r) => r.status === 429);

      expect(rateLimited.length).toBeGreaterThan(0);
    });

    test('should rate limit register attempts', async () => {
      mockQuery.mockResolvedValue({ rows: [], rowCount: 0 });

      const requests = [];
      for (let i = 0; i < 6; i++) {
        requests.push(
          request(app)
            .post('/api/auth/register')
            .send({
              username: `user${i}`,
              email: `test${i}@example.com`,
              password: 'Test1234',
            })
        );
      }

      const responses = await Promise.all(requests);
      const rateLimited = responses.filter((r) => r.status === 429);

      expect(rateLimited.length).toBeGreaterThan(0);
    });
  });
});
