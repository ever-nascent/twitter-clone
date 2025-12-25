#!/usr/bin/env node

/**
 * List Users Script
 *
 * Shows all users in the database with their verification status
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

async function listUsers() {
  try {
    const result = await pool.query(
      'SELECT id, username, email, email_verified, created_at FROM users ORDER BY created_at DESC'
    );

    if (result.rows.length === 0) {
      console.log('No users found in database.');
      process.exit(0);
    }

    console.log('\n📋 Users in database:\n');
    console.log('ID | Username | Email | Verified | Created');
    console.log('---|----------|-------|----------|--------');

    result.rows.forEach(user => {
      const verified = user.email_verified ? '✅ Yes' : '❌ No';
      const date = new Date(user.created_at).toLocaleDateString();
      console.log(`${user.id} | ${user.username} | ${user.email} | ${verified} | ${date}`);
    });

    console.log('\n');
    const unverified = result.rows.filter(u => !u.email_verified);
    if (unverified.length > 0) {
      console.log(`⚠️  ${unverified.length} user(s) need email verification:`);
      unverified.forEach(u => {
        console.log(`   - ${u.email} (${u.username})`);
      });
      console.log('\nTo verify an email, run:');
      console.log('   npm run verify-email <email>');
    } else {
      console.log('✅ All users are verified!');
    }

  } catch (error) {
    console.error('❌ Error listing users:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

listUsers();
