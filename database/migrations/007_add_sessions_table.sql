-- Migration: Add sessions tracking table
-- Date: 2024
--
-- Implements comprehensive session management for security monitoring
-- Tracks active sessions with device info, location, and last activity

CREATE TABLE IF NOT EXISTS sessions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  refresh_token_hash TEXT NOT NULL,
  device_info TEXT,
  ip_address TEXT,
  user_agent TEXT,
  location TEXT,
  last_active_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NOT NULL
);

-- Index for finding user's sessions
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);

-- Index for token lookup
CREATE INDEX IF NOT EXISTS idx_sessions_token_hash ON sessions(refresh_token_hash);

-- Index for cleanup of expired sessions
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);

-- Index for last active (for sorting)
CREATE INDEX IF NOT EXISTS idx_sessions_last_active ON sessions(last_active_at DESC);

COMMENT ON TABLE sessions IS 'Active user sessions for device tracking and remote logout';
COMMENT ON COLUMN sessions.refresh_token_hash IS 'SHA-256 hash of the refresh token';
COMMENT ON COLUMN sessions.device_info IS 'Parsed device information (browser, OS, etc.)';
COMMENT ON COLUMN sessions.location IS 'Approximate location from IP (city, country)';
COMMENT ON COLUMN sessions.last_active_at IS 'Last time this session was used';
