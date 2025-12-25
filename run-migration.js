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
  console.log('[MIGRATION] Running Phase 1 security migration...');
  console.log('[MIGRATION] Reading migration file...');

  const migrationPath = path.join(__dirname, 'database', 'migrations', '001_add_phase1_security_fields.sql');

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
    console.log('The following columns have been added to the users table:');
    console.log('  - email_verified');
    console.log('  - email_verification_token');
    console.log('  - email_verification_expires');
    console.log('  - password_reset_token');
    console.log('  - password_reset_expires');
    console.log('  - failed_login_attempts');
    console.log('  - locked_until');
    console.log('');
    console.log('Indexes created:');
    console.log('  - idx_users_email_verification_token');
    console.log('  - idx_users_password_reset_token');
    console.log('');
    console.log('[SUCCESS] Your database is now ready for Phase 1 features!');
    console.log('');
    console.log('You can now restart your dev server and test:');
    console.log('  - Email verification');
    console.log('  - Password reset');
    console.log('  - Account lockout');

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
