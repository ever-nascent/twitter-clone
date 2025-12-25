#!/usr/bin/env node

/**
 * Grant Admin Access Script
 *
 * Usage: node scripts/grant-admin.js <email>
 * Example: node scripts/grant-admin.js user@example.com
 */

const { Pool } = require('pg');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'twitter_clone',
  user: process.env.DB_USER || 'twitter',
  password: process.env.DB_PASSWORD || 'twitter_dev_password',
});

async function grantAdminAccess(email) {
  try {
    // Check if user exists
    const checkUser = await pool.query(
      'SELECT id, username, email, is_admin FROM users WHERE email = $1',
      [email]
    );

    if (checkUser.rows.length === 0) {
      console.error(`❌ Error: No user found with email: ${email}`);
      console.log('\nAvailable users:');
      const allUsers = await pool.query('SELECT id, username, email FROM users ORDER BY id');
      allUsers.rows.forEach(user => {
        console.log(`  - ${user.email} (${user.username})`);
      });
      process.exit(1);
    }

    const user = checkUser.rows[0];

    if (user.is_admin) {
      console.log(`ℹ️  User ${user.username} (${email}) is already an admin.`);
      process.exit(0);
    }

    // Grant admin access
    await pool.query(
      'UPDATE users SET is_admin = TRUE WHERE email = $1',
      [email]
    );

    console.log('✅ Success! Admin access granted.');
    console.log(`\nUser Details:`);
    console.log(`  Username: ${user.username}`);
    console.log(`  Email: ${email}`);
    console.log(`  Admin: true`);
    console.log(`\n🎉 You can now access the admin panel at /admin`);
    console.log(`   (You may need to log out and log back in)`);

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Parse command line arguments
const email = process.argv[2];

if (!email) {
  console.error('❌ Error: Email address is required');
  console.log('\nUsage: node scripts/grant-admin.js <email>');
  console.log('Example: node scripts/grant-admin.js user@example.com');
  process.exit(1);
}

// Run the script
grantAdminAccess(email);
