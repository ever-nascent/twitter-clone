import request from 'supertest';
import app from '../../src/server';
import { query } from '../../src/config/database';

describe('Phase 1 Security Features', () => {
  let testUserEmail = `test-${Date.now()}@example.com`;
  let testUsername = `testuser${Date.now()}`;
  const testPassword = 'TestPassword123';
  let verificationToken: string;
  let resetToken: string;

  beforeAll(async () => {
    // Clean up test user if exists
    await query('DELETE FROM users WHERE email = $1', [testUserEmail]);
  });

  afterAll(async () => {
    // Clean up test data
    await query('DELETE FROM users WHERE email = $1', [testUserEmail]);
  });

  describe('Email Verification Flow', () => {
    it('should register user and send verification email', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          username: testUsername,
          email: testUserEmail,
          password: testPassword,
          displayName: 'Test User',
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.user.username).toBe(testUsername);
      expect(response.body.data.emailVerificationRequired).toBe(true);

      // Get verification token from database
      const result = await query(
        'SELECT email_verification_token, email_verified FROM users WHERE email = $1',
        [testUserEmail]
      );

      expect(result.rows.length).toBe(1);
      expect(result.rows[0].email_verified).toBe(false);
      expect(result.rows[0].email_verification_token).toBeTruthy();

      verificationToken = result.rows[0].email_verification_token;
    });

    it('should verify email with valid token', async () => {
      const response = await request(app)
        .post('/api/auth/verify-email')
        .send({ token: verificationToken });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('verified successfully');

      // Check database
      const result = await query(
        'SELECT email_verified, email_verification_token FROM users WHERE email = $1',
        [testUserEmail]
      );

      expect(result.rows[0].email_verified).toBe(true);
      expect(result.rows[0].email_verification_token).toBe(null);
    });

    it('should reject invalid verification token', async () => {
      const response = await request(app)
        .post('/api/auth/verify-email')
        .send({ token: 'invalid-token-12345' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should allow resending verification email', async () => {
      // Create another test user
      const newEmail = `test-resend-${Date.now()}@example.com`;
      await request(app)
        .post('/api/auth/register')
        .send({
          username: `resenduser${Date.now()}`,
          email: newEmail,
          password: testPassword,
        });

      const response = await request(app)
        .post('/api/auth/resend-verification')
        .send({ email: newEmail });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      // Clean up
      await query('DELETE FROM users WHERE email = $1', [newEmail]);
    });

    it('should not reveal if email exists when resending verification', async () => {
      const response = await request(app)
        .post('/api/auth/resend-verification')
        .send({ email: 'nonexistent@example.com' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('If that email is registered');
    });
  });

  describe('Password Reset Flow', () => {
    it('should request password reset', async () => {
      const response = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: testUserEmail });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('If that email is registered');

      // Get reset token from database
      const result = await query(
        'SELECT password_reset_token FROM users WHERE email = $1',
        [testUserEmail]
      );

      expect(result.rows[0].password_reset_token).toBeTruthy();
      resetToken = result.rows[0].password_reset_token;
    });

    it('should not reveal if email exists when requesting reset', async () => {
      const response = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: 'nonexistent@example.com' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should reset password with valid token', async () => {
      const newPassword = 'NewPassword456';

      const response = await request(app)
        .post('/api/auth/reset-password')
        .send({
          token: resetToken,
          newPassword: newPassword,
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('reset successfully');

      // Verify can login with new password
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUserEmail,
          password: newPassword,
        });

      expect(loginResponse.status).toBe(200);
      expect(loginResponse.body.success).toBe(true);

      // Verify cannot login with old password
      const oldPasswordResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUserEmail,
          password: testPassword,
        });

      expect(oldPasswordResponse.status).toBe(401);
    });

    it('should reject invalid reset token', async () => {
      const response = await request(app)
        .post('/api/auth/reset-password')
        .send({
          token: 'invalid-token-12345',
          newPassword: 'NewPassword789',
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should reject weak password when resetting', async () => {
      // Get a new reset token
      await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: testUserEmail });

      const result = await query(
        'SELECT password_reset_token FROM users WHERE email = $1',
        [testUserEmail]
      );

      const newResetToken = result.rows[0].password_reset_token;

      const response = await request(app)
        .post('/api/auth/reset-password')
        .send({
          token: newResetToken,
          newPassword: 'weak',
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('at least 8 characters');
    });

    it('should clear failed login attempts after password reset', async () => {
      // First, create failed login attempts
      const failEmail = `failtest-${Date.now()}@example.com`;
      await request(app)
        .post('/api/auth/register')
        .send({
          username: `failuser${Date.now()}`,
          email: failEmail,
          password: testPassword,
        });

      // Make some failed login attempts
      for (let i = 0; i < 3; i++) {
        await request(app)
          .post('/api/auth/login')
          .send({
            email: failEmail,
            password: 'wrongpassword',
          });
      }

      // Verify failed attempts were recorded
      let result = await query(
        'SELECT failed_login_attempts FROM users WHERE email = $1',
        [failEmail]
      );
      expect(result.rows[0].failed_login_attempts).toBe(3);

      // Request password reset
      await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: failEmail });

      result = await query(
        'SELECT password_reset_token FROM users WHERE email = $1',
        [failEmail]
      );
      const token = result.rows[0].password_reset_token;

      // Reset password
      await request(app)
        .post('/api/auth/reset-password')
        .send({
          token: token,
          newPassword: 'NewSecurePassword123',
        });

      // Verify failed attempts were cleared
      result = await query(
        'SELECT failed_login_attempts FROM users WHERE email = $1',
        [failEmail]
      );
      expect(result.rows[0].failed_login_attempts).toBe(0);

      // Clean up
      await query('DELETE FROM users WHERE email = $1', [failEmail]);
    });
  });

  describe('Account Lockout Mechanism', () => {
    let lockoutEmail = `lockout-${Date.now()}@example.com`;

    beforeAll(async () => {
      // Create test user for lockout tests
      await request(app)
        .post('/api/auth/register')
        .send({
          username: `lockoutuser${Date.now()}`,
          email: lockoutEmail,
          password: testPassword,
        });
    });

    afterAll(async () => {
      await query('DELETE FROM users WHERE email = $1', [lockoutEmail]);
    });

    it('should track failed login attempts', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: lockoutEmail,
          password: 'wrongpassword',
        });

      expect(response.status).toBe(401);
      expect(response.body.attemptsRemaining).toBeDefined();
      expect(response.body.attemptsRemaining).toBeLessThan(5);

      // Check database
      const result = await query(
        'SELECT failed_login_attempts FROM users WHERE email = $1',
        [lockoutEmail]
      );
      expect(result.rows[0].failed_login_attempts).toBe(1);
    });

    it('should lock account after 5 failed attempts', async () => {
      // Make 4 more failed attempts (total 5)
      for (let i = 0; i < 4; i++) {
        await request(app)
          .post('/api/auth/login')
          .send({
            email: lockoutEmail,
            password: 'wrongpassword',
          });
      }

      // 5th attempt should lock the account
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: lockoutEmail,
          password: 'wrongpassword',
        });

      expect(response.status).toBe(403);
      expect(response.body.error).toContain('locked');
      expect(response.body.lockedUntil).toBeDefined();

      // Verify database
      const result = await query(
        'SELECT locked_until, failed_login_attempts FROM users WHERE email = $1',
        [lockoutEmail]
      );
      expect(result.rows[0].locked_until).not.toBeNull();
      expect(result.rows[0].failed_login_attempts).toBe(5);
    });

    it('should prevent login while account is locked even with correct password', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: lockoutEmail,
          password: testPassword,
        });

      expect(response.status).toBe(403);
      expect(response.body.error).toContain('locked');
    });

    it('should unlock account after lock period expires', async () => {
      // Manually expire the lock
      await query(
        `UPDATE users
         SET locked_until = NOW() - INTERVAL '1 minute'
         WHERE email = $1`,
        [lockoutEmail]
      );

      // Try to login - should reset lock
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: lockoutEmail,
          password: testPassword,
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      // Verify lock was cleared
      const result = await query(
        'SELECT locked_until, failed_login_attempts FROM users WHERE email = $1',
        [lockoutEmail]
      );
      expect(result.rows[0].locked_until).toBeNull();
      expect(result.rows[0].failed_login_attempts).toBe(0);
    });

    it('should reset failed attempts counter on successful login', async () => {
      const freshEmail = `fresh-${Date.now()}@example.com`;

      await request(app)
        .post('/api/auth/register')
        .send({
          username: `freshuser${Date.now()}`,
          email: freshEmail,
          password: testPassword,
        });

      // Make 2 failed attempts
      for (let i = 0; i < 2; i++) {
        await request(app)
          .post('/api/auth/login')
          .send({
            email: freshEmail,
            password: 'wrongpassword',
          });
      }

      // Verify attempts were recorded
      let result = await query(
        'SELECT failed_login_attempts FROM users WHERE email = $1',
        [freshEmail]
      );
      expect(result.rows[0].failed_login_attempts).toBe(2);

      // Successful login
      await request(app)
        .post('/api/auth/login')
        .send({
          email: freshEmail,
          password: testPassword,
        });

      // Verify attempts were reset
      result = await query(
        'SELECT failed_login_attempts FROM users WHERE email = $1',
        [freshEmail]
      );
      expect(result.rows[0].failed_login_attempts).toBe(0);

      // Clean up
      await query('DELETE FROM users WHERE email = $1', [freshEmail]);
    });
  });

  describe('Security Best Practices', () => {
    it('should not reveal whether user exists during password reset', async () => {
      const response = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: 'doesnotexist@example.com' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('If that email is registered');
    });

    it('should expire verification tokens after 24 hours', async () => {
      const expiredEmail = `expired-${Date.now()}@example.com`;

      await request(app)
        .post('/api/auth/register')
        .send({
          username: `expireduser${Date.now()}`,
          email: expiredEmail,
          password: testPassword,
        });

      // Get token and manually expire it
      let result = await query(
        'SELECT email_verification_token FROM users WHERE email = $1',
        [expiredEmail]
      );
      const token = result.rows[0].email_verification_token;

      await query(
        `UPDATE users
         SET email_verification_expires = NOW() - INTERVAL '1 hour'
         WHERE email = $1`,
        [expiredEmail]
      );

      // Try to verify with expired token
      const response = await request(app)
        .post('/api/auth/verify-email')
        .send({ token: token });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('expired');

      // Clean up
      await query('DELETE FROM users WHERE email = $1', [expiredEmail]);
    });

    it('should expire reset tokens after 1 hour', async () => {
      const expiredResetEmail = `reset-expired-${Date.now()}@example.com`;

      await request(app)
        .post('/api/auth/register')
        .send({
          username: `resetexpireduser${Date.now()}`,
          email: expiredResetEmail,
          password: testPassword,
        });

      // Request reset
      await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: expiredResetEmail });

      // Get token and manually expire it
      let result = await query(
        'SELECT password_reset_token FROM users WHERE email = $1',
        [expiredResetEmail]
      );
      const token = result.rows[0].password_reset_token;

      await query(
        `UPDATE users
         SET password_reset_expires = NOW() - INTERVAL '10 minutes'
         WHERE email = $1`,
        [expiredResetEmail]
      );

      // Try to reset with expired token
      const response = await request(app)
        .post('/api/auth/reset-password')
        .send({
          token: token,
          newPassword: 'NewPassword123',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('expired');

      // Clean up
      await query('DELETE FROM users WHERE email = $1', [expiredResetEmail]);
    });
  });
});
