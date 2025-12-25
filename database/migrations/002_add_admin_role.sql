-- Migration: Add admin role support
-- Date: 2025-12-25
-- Description: Adds is_admin column to users table for role-based access control

-- Add is_admin column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'users' AND column_name = 'is_admin'
    ) THEN
        ALTER TABLE users ADD COLUMN is_admin BOOLEAN DEFAULT FALSE;
        RAISE NOTICE '[SUCCESS] Added is_admin column to users table';
    ELSE
        RAISE NOTICE '[INFO] is_admin column already exists, skipping';
    END IF;
END $$;

-- Set existing users to non-admin by default
UPDATE users SET is_admin = FALSE WHERE is_admin IS NULL;

-- Optional: Make the first user an admin (uncomment if needed)
-- UPDATE users SET is_admin = TRUE WHERE id = (SELECT MIN(id) FROM users);

RAISE NOTICE '';
RAISE NOTICE '[MIGRATION COMPLETE] Admin role support added';
RAISE NOTICE '';
RAISE NOTICE 'To grant admin access to a user, run:';
RAISE NOTICE '  UPDATE users SET is_admin = TRUE WHERE email = ''your-email@example.com'';';
RAISE NOTICE '';
