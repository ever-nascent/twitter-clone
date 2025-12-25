import {
  hashPassword,
  comparePassword,
  generateAccessToken,
  generateRefreshToken,
  verifyToken,
  validatePassword,
  validateUsername,
  validateEmail,
} from '../../src/utils/auth';

describe('Authentication Utilities', () => {
  describe('Password Hashing', () => {
    test('should hash password successfully', async () => {
      const password = 'TestPassword123';
      const hash = await hashPassword(password);

      expect(hash).toBeDefined();
      expect(hash).not.toBe(password);
      expect(hash).toMatch(/^\$2[ab]\$/); // bcrypt hash format
    });

    test('should generate different hashes for same password', async () => {
      const password = 'TestPassword123';
      const hash1 = await hashPassword(password);
      const hash2 = await hashPassword(password);

      expect(hash1).not.toBe(hash2); // Different salts
    });

    test('should compare password correctly', async () => {
      const password = 'TestPassword123';
      const hash = await hashPassword(password);

      const isValid = await comparePassword(password, hash);
      expect(isValid).toBe(true);
    });

    test('should reject incorrect password', async () => {
      const password = 'TestPassword123';
      const wrongPassword = 'WrongPassword123';
      const hash = await hashPassword(password);

      const isValid = await comparePassword(wrongPassword, hash);
      expect(isValid).toBe(false);
    });

    test('should handle empty password', async () => {
      const hash = await hashPassword('');
      const isValid = await comparePassword('', hash);
      expect(isValid).toBe(true);
    });
  });

  describe('JWT Token Generation', () => {
    test('should generate valid access token', () => {
      const payload = { userId: 1, username: 'testuser' };
      const token = generateAccessToken(payload);

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3); // JWT has 3 parts
    });

    test('should verify token correctly', () => {
      const payload = { userId: 1, username: 'testuser' };
      const token = generateAccessToken(payload);

      const decoded = verifyToken(token);
      expect(decoded.userId).toBe(payload.userId);
      expect(decoded.username).toBe(payload.username);
    });

    test('should reject invalid token', () => {
      const invalidToken = 'invalid.token.here';

      expect(() => verifyToken(invalidToken)).toThrow();
    });

    test('should reject tampered token', () => {
      const payload = { userId: 1, username: 'testuser' };
      const token = generateAccessToken(payload);

      // Tamper with token
      const tamperedToken = token.slice(0, -5) + 'xxxxx';

      expect(() => verifyToken(tamperedToken)).toThrow();
    });

    test('should generate refresh token', () => {
      const token = generateRefreshToken();

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.length).toBeGreaterThan(50); // Should be long
    });

    test('should generate unique refresh tokens', () => {
      const token1 = generateRefreshToken();
      const token2 = generateRefreshToken();

      expect(token1).not.toBe(token2);
    });
  });

  describe('Password Validation', () => {
    test('should accept valid password', () => {
      const result = validatePassword('Test1234');
      expect(result).toBeNull();
    });

    test('should reject password without uppercase', () => {
      const result = validatePassword('test1234');
      expect(result).toContain('uppercase');
    });

    test('should reject password without lowercase', () => {
      const result = validatePassword('TEST1234');
      expect(result).toContain('lowercase');
    });

    test('should reject password without number', () => {
      const result = validatePassword('TestTest');
      expect(result).toContain('number');
    });

    test('should reject password too short', () => {
      const result = validatePassword('Test12');
      expect(result).toContain('8 characters');
    });

    test('should accept password with special characters', () => {
      const result = validatePassword('Test123!@#');
      expect(result).toBeNull();
    });

    test('should accept long password', () => {
      const result = validatePassword('TestPassword123456789');
      expect(result).toBeNull();
    });
  });

  describe('Username Validation', () => {
    test('should accept valid username', () => {
      const result = validateUsername('testuser');
      expect(result).toBeNull();
    });

    test('should accept username with numbers', () => {
      const result = validateUsername('test123');
      expect(result).toBeNull();
    });

    test('should accept username with underscores', () => {
      const result = validateUsername('test_user_123');
      expect(result).toBeNull();
    });

    test('should reject username too short', () => {
      const result = validateUsername('ab');
      expect(result).toContain('3 and 50');
    });

    test('should reject username too long', () => {
      const result = validateUsername('a'.repeat(51));
      expect(result).toContain('3 and 50');
    });

    test('should reject username starting with number', () => {
      const result = validateUsername('123test');
      expect(result).toContain('start with a letter');
    });

    test('should reject username with spaces', () => {
      const result = validateUsername('test user');
      expect(result).toContain('letters, numbers, and underscores');
    });

    test('should reject username with special characters', () => {
      const result = validateUsername('test@user');
      expect(result).toContain('letters, numbers, and underscores');
    });

    test('should reject username starting with underscore', () => {
      const result = validateUsername('_testuser');
      expect(result).toContain('start with a letter');
    });
  });

  describe('Email Validation', () => {
    test('should accept valid email', () => {
      const result = validateEmail('test@example.com');
      expect(result).toBeNull();
    });

    test('should accept email with subdomain', () => {
      const result = validateEmail('test@mail.example.com');
      expect(result).toBeNull();
    });

    test('should accept email with plus', () => {
      const result = validateEmail('test+tag@example.com');
      expect(result).toBeNull();
    });

    test('should accept email with dots', () => {
      const result = validateEmail('test.user@example.com');
      expect(result).toBeNull();
    });

    test('should reject email without @', () => {
      const result = validateEmail('testexample.com');
      expect(result).toContain('Invalid email');
    });

    test('should reject email without domain', () => {
      const result = validateEmail('test@');
      expect(result).toContain('Invalid email');
    });

    test('should reject email without local part', () => {
      const result = validateEmail('@example.com');
      expect(result).toContain('Invalid email');
    });

    test('should reject email with spaces', () => {
      const result = validateEmail('test @example.com');
      expect(result).toContain('Invalid email');
    });

    test('should reject email without TLD', () => {
      const result = validateEmail('test@example');
      expect(result).toContain('Invalid email');
    });
  });
});
