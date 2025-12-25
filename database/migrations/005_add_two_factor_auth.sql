-- Migration: Add Two-Factor Authentication (2FA) Support
-- Date: 2024
--
-- SECURITY ENHANCEMENT: Implement Time-based One-Time Password (TOTP) 2FA
--
-- This migration adds support for authenticator app-based 2FA (e.g., Google Authenticator, Authy)
-- Users can enable 2FA to add an extra layer of security to their accounts.
--
-- Features:
-- 1. TOTP secret storage (encrypted)
-- 2. Backup codes for account recovery
-- 3. 2FA enabled/disabled state

-- Add 2FA columns to users table
ALTER TABLE users
ADD COLUMN two_factor_secret TEXT,  -- Base32-encoded TOTP secret (will be encrypted in app)
ADD COLUMN two_factor_enabled BOOLEAN DEFAULT FALSE NOT NULL,  -- Whether 2FA is active
ADD COLUMN two_factor_backup_codes TEXT[];  -- Array of hashed backup codes (SHA-256)

-- Add index for 2FA lookups (for users with 2FA enabled)
CREATE INDEX idx_users_two_factor_enabled ON users(two_factor_enabled) WHERE two_factor_enabled = TRUE;

-- Add comment
COMMENT ON COLUMN users.two_factor_secret IS 'Base32-encoded TOTP secret for authenticator apps. Null if 2FA not set up.';
COMMENT ON COLUMN users.two_factor_enabled IS 'Whether two-factor authentication is enabled for this account.';
COMMENT ON COLUMN users.two_factor_backup_codes IS 'Array of SHA-256 hashed backup codes for 2FA recovery. Each code can be used once.';
