-- Migration: Hash Refresh Tokens
-- Date: 2024
--
-- SECURITY ENHANCEMENT: Change refresh tokens from plaintext to hashed storage
--
-- Background:
-- Previously, refresh tokens were stored in plaintext in the database.
-- This migration implements hashing for refresh tokens (similar to password hashing).
-- If the database is compromised, attackers won't be able to use the tokens directly.
--
-- Impact:
-- - All existing refresh tokens will be invalidated
-- - Users will need to log in again
-- - This is a one-time disruption for better long-term security
--
-- Implementation:
-- The application code now:
-- 1. Generates a random token (sent to client in httpOnly cookie)
-- 2. Hashes the token using SHA-256
-- 3. Stores only the hashed version in the database
-- 4. When verifying, hashes the incoming token and compares with stored hash

-- Step 1: Delete all existing refresh tokens
-- This is necessary because we cannot retroactively hash plaintext tokens
-- Users will be logged out and need to sign in again
DELETE FROM refresh_tokens;

-- Step 2: Add a comment to the token column to document the change
COMMENT ON COLUMN refresh_tokens.token IS 'SHA-256 hash of the refresh token (not plaintext). As of migration 004, all tokens are hashed before storage.';

-- Migration complete
-- No schema changes needed - VARCHAR(500) is sufficient for SHA-256 hashes (64 chars)
