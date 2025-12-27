// Quick script to run migration 008
// This uses the same database connection settings as your backend

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config();

async function runMigration() {
  console.log('🔄 Running Phase 3 migration...\n');

  // Create database connection with same settings as backend
  const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'twitter_clone',
    user: process.env.DB_USER || 'twitter',
    password: process.env.DB_PASSWORD || 'twitter_dev_password',
  });

  try {
    // Test connection
    console.log('🔌 Connecting to database...');
    await pool.query('SELECT NOW()');
    console.log('✅ Connected successfully!\n');

    // Read the migration SQL
    const migrationPath = path.join(__dirname, 'database/migrations/008_add_phase3_security_features.sql');
    const sql = fs.readFileSync(migrationPath, 'utf-8');

    console.log('📁 Running migration: 008_add_phase3_security_features.sql\n');

    // Run the migration
    await pool.query(sql);

    console.log('✅ Migration completed successfully!\n');
    console.log('📋 Created:');
    console.log('  ✓ password_history table');
    console.log('  ✓ login_attempts table');
    console.log('  ✓ trusted_devices table');
    console.log('  ✓ recovery_codes table');
    console.log('  ✓ Updated users table with new columns\n');
    console.log('🚀 Login will now work! The backend should auto-restart.\n');

    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error.message);

    if (error.code === 'ECONNREFUSED') {
      console.error('\n💡 Database connection refused. Is PostgreSQL running?');
      console.error('   Your backend is connected, so the database IS running.');
      console.error('   Try checking your .env file or database settings.\n');
    }

    await pool.end();
    process.exit(1);
  }
}

runMigration();
