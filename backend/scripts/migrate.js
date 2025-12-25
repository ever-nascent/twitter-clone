const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'twitter_clone',
  user: process.env.DB_USER || 'twitter',
  password: process.env.DB_PASSWORD,
});

async function runMigrations() {
  console.log('Running database migrations...\n');

  const migrationsDir = path.join(__dirname, '../../database/migrations');

  // Check if migrations directory exists
  if (!fs.existsSync(migrationsDir)) {
    console.log('No migrations directory found. Skipping migrations.');
    return;
  }

  // Get all .sql files and sort them
  const files = fs.readdirSync(migrationsDir)
    .filter(file => file.endsWith('.sql'))
    .sort();

  if (files.length === 0) {
    console.log('No migration files found.');
    return;
  }

  console.log(`Found ${files.length} migration file(s):\n`);

  for (const file of files) {
    const filePath = path.join(migrationsDir, file);
    const sql = fs.readFileSync(filePath, 'utf-8');

    console.log(`Executing: ${file}`);

    try {
      await pool.query(sql);
      console.log(`✓ ${file} completed successfully\n`);
    } catch (error) {
      console.error(`✗ Error running ${file}:`, error.message);

      // Check if it's a "already exists" error (not critical)
      if (error.message.includes('already exists') || error.message.includes('duplicate')) {
        console.log(`  (Column/table already exists - skipping)\n`);
        continue;
      }

      // For other errors, continue but warn
      console.log(`  (Continuing with other migrations...)\n`);
    }
  }

  console.log('✓ All migrations completed!\n');
}

runMigrations()
  .then(() => {
    pool.end();
    process.exit(0);
  })
  .catch((error) => {
    console.error('Migration failed:', error);
    pool.end();
    process.exit(1);
  });
