const { Pool } = require('pg');
require('dotenv').config({ path: require('path').join(__dirname, 'backend', '.env') });

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'twitter_clone',
  user: process.env.DB_USER || 'twitter',
  password: process.env.DB_PASSWORD || 'twitter_dev_password',
});

async function listUsers() {
  try {
    console.log('Fetching registered users...\n');

    const result = await pool.query(`
      SELECT
        id,
        username,
        email,
        display_name,
        email_verified,
        failed_login_attempts,
        locked_until,
        created_at
      FROM users
      ORDER BY created_at DESC
    `);

    if (result.rows.length === 0) {
      console.log('No users found.');
    } else {
      console.log(`Total Users: ${result.rows.length}\n`);
      console.log('─'.repeat(120));

      result.rows.forEach((user, index) => {
        console.log(`\n[${index + 1}] User ID: ${user.id}`);
        console.log(`    Username: ${user.username}`);
        console.log(`    Email: ${user.email}`);
        console.log(`    Display Name: ${user.display_name || 'Not set'}`);
        console.log(`    Email Verified: ${user.email_verified ? 'Yes' : 'No'}`);
        console.log(`    Failed Logins: ${user.failed_login_attempts}`);
        console.log(`    Account Locked: ${user.locked_until ? `Until ${new Date(user.locked_until).toLocaleString()}` : 'No'}`);
        console.log(`    Registered: ${new Date(user.created_at).toLocaleString()}`);
      });

      console.log('\n' + '─'.repeat(120));
    }

    await pool.end();
  } catch (error) {
    console.error('Error fetching users:', error.message);
    await pool.end();
    process.exit(1);
  }
}

listUsers();
