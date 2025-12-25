#!/usr/bin/env node

/**
 * Verify Email Script
 *
 * Manually verify a user's email address for development/testing purposes
 *
 * Usage:
 *   npm run verify-email user@example.com
 *   node scripts/verify-email.js user@example.com
 */

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'twitter_clone',
  user: process.env.DB_USER || 'twitter',
  password: process.env.DB_PASSWORD || 'twitter_dev_password',
});

async function verifyEmail(email) {
  try {
    // Check if user exists
    const userResult = await pool.query(
      'SELECT id, username, email, email_verified FROM users WHERE email = $1',
      [email]
    );

    if (userResult.rows.length === 0) {
      console.error(`❌ Error: No user found with email "${email}"`);
      process.exit(1);
    }

    const user = userResult.rows[0];

    if (user.email_verified) {
      console.log(`✅ Email "${email}" is already verified for user "${user.username}"`);
      process.exit(0);
    }

    // Verify the email
    await pool.query(
      `UPDATE users
       SET email_verified = TRUE,
           email_verification_token = NULL,
           email_verification_expires = NULL
       WHERE id = $1`,
      [user.id]
    );

    console.log(`✅ Successfully verified email "${email}" for user "${user.username}"`);
    console.log('   You can now log in to your account.');

  } catch (error) {
    console.error('❌ Error verifying email:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Get email from command line arguments
const email = process.argv[2];

if (!email) {
  console.error('Usage: npm run verify-email <email>');
  console.error('Example: npm run verify-email user@example.com');
  process.exit(1);
}

verifyEmail(email);
