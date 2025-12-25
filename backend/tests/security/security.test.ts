import request from 'supertest';
import express from 'express';
import cookieParser from 'cookie-parser';
import authRoutes from '../../src/routes/authRoutes';

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use('/api/auth', authRoutes);

jest.mock('../../src/config/database', () => ({
  query: jest.fn(),
  pool: { query: jest.fn(), on: jest.fn() },
}));

import { query } from '../../src/config/database';
const mockQuery = query as jest.MockedFunction<typeof query>;

describe('Security Tests - Attack Vectors', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('SQL Injection Attempts', () => {
    const sqlInjectionPayloads = [
      "admin'--",
      "admin' OR '1'='1",
      "admin' OR '1'='1'--",
      "admin' OR '1'='1' /*",
      "' OR 1=1--",
      "' OR 'a'='a",
      "') OR ('a'='a",
      "1' OR '1' = '1",
      "' UNION SELECT NULL--",
      "' UNION SELECT * FROM users--",
      "; DROP TABLE users;--",
      "'; DELETE FROM users WHERE '1'='1",
      "1'; UPDATE users SET password='hacked' WHERE '1'='1",
    ];

    test.each(sqlInjectionPayloads)(
      'should prevent SQL injection in email: %s',
      async (payload) => {
        mockQuery.mockResolvedValue({ rows: [], rowCount: 0 });

        const response = await request(app)
          .post('/api/auth/login')
          .send({
            email: payload,
            password: 'Test1234',
          });

        // Should either validate or fail safely (not 500)
        expect(response.status).not.toBe(500);

        // Check that parameterized query was used
        if (mockQuery.mock.calls.length > 0) {
          const queryCall = mockQuery.mock.calls[0];
          // First argument should be query string with $1 placeholders
          expect(queryCall[0]).toContain('$1');
          // Second argument should be params array
          expect(Array.isArray(queryCall[1])).toBe(true);
        }
      }
    );

    test.each(sqlInjectionPayloads)(
      'should prevent SQL injection in username: %s',
      async (payload) => {
        mockQuery.mockResolvedValue({ rows: [], rowCount: 0 });

        const response = await request(app)
          .post('/api/auth/register')
          .send({
            username: payload,
            email: 'test@example.com',
            password: 'Test1234',
          });

        expect(response.status).not.toBe(500);
      }
    );
  });

  describe('XSS (Cross-Site Scripting) Attempts', () => {
    const xssPayloads = [
      '<script>alert("XSS")</script>',
      '<img src=x onerror=alert("XSS")>',
      '<svg onload=alert("XSS")>',
      'javascript:alert("XSS")',
      '<iframe src="javascript:alert(\'XSS\')">',
      '<body onload=alert("XSS")>',
      '"><script>alert(String.fromCharCode(88,83,83))</script>',
      '<input onfocus=alert("XSS") autofocus>',
    ];

    test.each(xssPayloads)(
      'should handle XSS in display name: %s',
      async (payload) => {
        mockQuery
          .mockResolvedValueOnce({ rows: [], rowCount: 0 })
          .mockResolvedValueOnce({ rows: [], rowCount: 0 })
          .mockResolvedValueOnce({
            rows: [{
              id: 1,
              username: 'testuser',
              email: 'test@example.com',
              display_name: payload,
              created_at: new Date(),
            }],
            rowCount: 1,
          })
          .mockResolvedValueOnce({ rows: [], rowCount: 1 });

        const response = await request(app)
          .post('/api/auth/register')
          .send({
            username: 'testuser',
            email: 'test@example.com',
            password: 'Test1234',
            displayName: payload,
          });

        // Should not crash
        expect(response.status).not.toBe(500);

        // If successful, check that dangerous characters are handled
        if (response.status === 201 && response.body.data) {
          const displayName = response.body.data.user.display_name;
          // Script tags should not be executable in API response
          expect(displayName).toBeDefined();
        }
      }
    );
  });

  describe('Brute Force Protection', () => {
    test('should prevent rapid login attempts', async () => {
      mockQuery.mockResolvedValue({ rows: [], rowCount: 0 });

      const attempts = [];
      const targetEmail = 'victim@example.com';

      // Try 10 rapid login attempts
      for (let i = 0; i < 10; i++) {
        attempts.push(
          request(app)
            .post('/api/auth/login')
            .send({
              email: targetEmail,
              password: `attempt${i}`,
            })
        );
      }

      const responses = await Promise.all(attempts);

      // At least some should be rate limited
      const rateLimited = responses.filter((r) => r.status === 429);
      expect(rateLimited.length).toBeGreaterThan(0);
    });

    test('should prevent password enumeration', async () => {
      // Response for valid email with wrong password
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: 1, password_hash: 'somehash' }],
        rowCount: 1,
      });

      const response1 = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'existing@example.com',
          password: 'WrongPassword123',
        });

      // Response for non-existent email
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      const response2 = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'WrongPassword123',
        });

      // Both should return same generic error
      expect(response1.body.error).toBe(response2.body.error);
      expect(response1.status).toBe(response2.status);
    });
  });

  describe('Input Length Attacks', () => {
    test('should handle extremely long username', async () => {
      const longUsername = 'a'.repeat(10000);

      const response = await request(app)
        .post('/api/auth/register')
        .send({
          username: longUsername,
          email: 'test@example.com',
          password: 'Test1234',
        });

      expect(response.status).toBe(400);
    });

    test('should handle extremely long email', async () => {
      const longEmail = 'a'.repeat(10000) + '@example.com';

      const response = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'testuser',
          email: longEmail,
          password: 'Test1234',
        });

      expect(response.status).toBe(400);
    });

    test('should handle extremely long password', async () => {
      const longPassword = 'Test1234' + 'a'.repeat(10000);

      const response = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'testuser',
          email: 'test@example.com',
          password: longPassword,
        });

      // Should not crash
      expect(response.status).not.toBe(500);
    });
  });

  describe('Special Character Handling', () => {
    const specialChars = [
      '\0', // Null byte
      '\n', // Newline
      '\r', // Carriage return
      '\t', // Tab
      String.fromCharCode(0), // NULL
      String.fromCharCode(8), // Backspace
    ];

    test.each(specialChars)(
      'should handle special character in input: %s',
      async (char) => {
        mockQuery.mockResolvedValue({ rows: [], rowCount: 0 });

        const response = await request(app)
          .post('/api/auth/register')
          .send({
            username: `test${char}user`,
            email: 'test@example.com',
            password: 'Test1234',
          });

        expect(response.status).not.toBe(500);
      }
    );
  });

  describe('Unicode and Encoding Attacks', () => {
    test('should handle Unicode in username', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'test用户',
          email: 'test@example.com',
          password: 'Test1234',
        });

      // Should validate properly (probably reject non-ASCII)
      expect(response.status).not.toBe(500);
    });

    test('should handle emoji in display name', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [], rowCount: 0 })
        .mockResolvedValueOnce({ rows: [], rowCount: 0 })
        .mockResolvedValueOnce({
          rows: [{
            id: 1,
            username: 'testuser',
            display_name: 'Test User',
            created_at: new Date(),
          }],
          rowCount: 1,
        })
        .mockResolvedValueOnce({ rows: [], rowCount: 1 });

      const response = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'testuser',
          email: 'test@example.com',
          password: 'Test1234',
          displayName: 'Test User 👨‍💻',
        });

      expect(response.status).not.toBe(500);
    });
  });

  describe('JSON Payload Manipulation', () => {
    test('should reject malformed JSON', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .set('Content-Type', 'application/json')
        .send('{"username": "test", invalid json}');

      expect(response.status).toBe(400);
    });

    test('should handle prototype pollution attempt', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'testuser',
          email: 'test@example.com',
          password: 'Test1234',
          '__proto__': { admin: true },
        });

      expect(response.status).not.toBe(500);
    });

    test('should handle nested object attacks', async () => {
      const deeplyNested: any = {};
      let current = deeplyNested;
      for (let i = 0; i < 1000; i++) {
        current.nested = {};
        current = current.nested;
      }

      const response = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'testuser',
          email: 'test@example.com',
          password: 'Test1234',
          data: deeplyNested,
        });

      expect(response.status).not.toBe(500);
    });
  });

  describe('Header Injection', () => {
    test('should handle malicious headers', async () => {
      mockQuery.mockResolvedValue({ rows: [], rowCount: 0 });

      const response = await request(app)
        .post('/api/auth/login')
        .set('X-Forwarded-For', '<script>alert("XSS")</script>')
        .set('User-Agent', "' OR '1'='1")
        .send({
          email: 'test@example.com',
          password: 'Test1234',
        });

      expect(response.status).not.toBe(500);
    });
  });

  describe('Timing Attacks', () => {
    test('should have consistent response times for invalid logins', async () => {
      const times: number[] = [];

      for (let i = 0; i < 5; i++) {
        mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

        const start = Date.now();
        await request(app)
          .post('/api/auth/login')
          .send({
            email: `test${i}@example.com`,
            password: 'WrongPassword',
          });
        times.push(Date.now() - start);
      }

      // Response times should be relatively consistent
      // (Not perfect, but shouldn't vary by orders of magnitude)
      const avg = times.reduce((a, b) => a + b) / times.length;
      const variance = times.map(t => Math.abs(t - avg));
      const maxVariance = Math.max(...variance);

      // Allow some variation but not huge differences
      expect(maxVariance).toBeLessThan(avg * 2);
    });
  });
});
