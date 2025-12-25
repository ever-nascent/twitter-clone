const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, 'backend', '.env') });

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'twitter_clone',
  user: process.env.DB_USER || 'twitter',
  password: process.env.DB_PASSWORD || 'twitter_dev_password',
});

async function runMigration() {
  console.log('[MIGRATION] Running admin role migration...');
  console.log('[MIGRATION] Reading migration file...');

  const migrationPath = path.join(__dirname, 'database', 'migrations', '002_add_admin_role.sql');

  if (!fs.existsSync(migrationPath)) {
    console.error('[ERROR] Migration file not found:', migrationPath);
    process.exit(1);
  }

  const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

  try {
    console.log('[DATABASE] Connecting to database...');
    await pool.connect();
    console.log('[DATABASE] Connected to database');

    console.log('[MIGRATION] Executing migration...');
    await pool.query(migrationSQL);

    console.log('[SUCCESS] Migration completed successfully!');
    console.log('');
    console.log('The is_admin column has been added to the users table.');
    console.log('');
    console.log('[SUCCESS] Your database now supports admin roles!');
    console.log('');
    console.log('To grant admin access to a user, run:');
    console.log("  UPDATE users SET is_admin = TRUE WHERE email = 'your-email@example.com';");
    console.log('');
    console.log('You can now restart your dev server.');

    await pool.end();
    process.exit(0);
  } catch (err) {
    console.error('[ERROR] Migration failed:', err.message);
    console.error('');
    console.error('Full error:', err);
    await pool.end();
    process.exit(1);
  }
}

runMigration();
