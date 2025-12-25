-- Migration: Phase 3 Security Features
-- Date: 2024
--
-- Comprehensive security enhancements:
-- - Password history tracking (prevent reuse within 1 year)
-- - Login attempt monitoring and suspicious activity detection
-- - Trusted devices (remember device, skip 2FA)
-- - Recovery codes (emergency access)
-- - Force password reset capability

-- ============================================================================
-- PASSWORD HISTORY
-- ============================================================================
-- Track password hashes to prevent reuse within 1 year
CREATE TABLE IF NOT EXISTS password_history (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_password_history_user_id ON password_history(user_id);
CREATE INDEX IF NOT EXISTS idx_password_history_created_at ON password_history(created_at);

COMMENT ON TABLE password_history IS 'Track password hashes to prevent reuse (1 year retention)';

-- ============================================================================
-- LOGIN ATTEMPTS
-- ============================================================================
-- Comprehensive audit log of all login attempts (success and failure)
CREATE TABLE IF NOT EXISTS login_attempts (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  success BOOLEAN NOT NULL,
  failure_reason TEXT,
  ip_address TEXT,
  user_agent TEXT,
  device_info TEXT,
  location TEXT,
  suspicious BOOLEAN DEFAULT FALSE,
  suspicious_reason TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_login_attempts_user_id ON login_attempts(user_id);
CREATE INDEX IF NOT EXISTS idx_login_attempts_email ON login_attempts(email);
CREATE INDEX IF NOT EXISTS idx_login_attempts_ip ON login_attempts(ip_address);
CREATE INDEX IF NOT EXISTS idx_login_attempts_created_at ON login_attempts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_login_attempts_success ON login_attempts(success);
CREATE INDEX IF NOT EXISTS idx_login_attempts_suspicious ON login_attempts(suspicious) WHERE suspicious = TRUE;

COMMENT ON TABLE login_attempts IS 'Audit log of all login attempts with fraud detection';
COMMENT ON COLUMN login_attempts.suspicious IS 'Flagged by anomaly detection (new location, device, etc.)';

-- ============================================================================
-- TRUSTED DEVICES
-- ============================================================================
-- Devices that can skip 2FA for 30 days
CREATE TABLE IF NOT EXISTS trusted_devices (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_fingerprint TEXT NOT NULL,
  device_name TEXT,
  ip_address TEXT,
  user_agent TEXT,
  trusted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NOT NULL,
  last_used_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, device_fingerprint)
);

CREATE INDEX IF NOT EXISTS idx_trusted_devices_user_id ON trusted_devices(user_id);
CREATE INDEX IF NOT EXISTS idx_trusted_devices_fingerprint ON trusted_devices(device_fingerprint);
CREATE INDEX IF NOT EXISTS idx_trusted_devices_expires_at ON trusted_devices(expires_at);

COMMENT ON TABLE trusted_devices IS 'Devices trusted to skip 2FA for 30 days';
COMMENT ON COLUMN trusted_devices.device_fingerprint IS 'Browser fingerprint hash';

-- ============================================================================
-- RECOVERY CODES
-- ============================================================================
-- Emergency access codes (separate from 2FA backup codes)
CREATE TABLE IF NOT EXISTS recovery_codes (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code_hash TEXT NOT NULL,
  used BOOLEAN DEFAULT FALSE,
  used_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_recovery_codes_user_id ON recovery_codes(user_id);
CREATE INDEX IF NOT EXISTS idx_recovery_codes_used ON recovery_codes(used);

COMMENT ON TABLE recovery_codes IS 'Emergency recovery codes for account access (1-year expiry)';

-- ============================================================================
-- USER TABLE UPDATES
-- ============================================================================
-- Add fields for force password reset and tracking
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS force_password_reset BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS sms_2fa_enabled BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS sms_2fa_phone TEXT,
  ADD COLUMN IF NOT EXISTS email_2fa_enabled BOOLEAN DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_users_force_password_reset ON users(force_password_reset) WHERE force_password_reset = TRUE;

COMMENT ON COLUMN users.force_password_reset IS 'Admin can force user to reset password on next login';
COMMENT ON COLUMN users.password_changed_at IS 'Track when password was last changed';
COMMENT ON COLUMN users.sms_2fa_enabled IS 'SMS-based 2FA via Twilio';
COMMENT ON COLUMN users.email_2fa_enabled IS 'Email-based 2FA as fallback';
