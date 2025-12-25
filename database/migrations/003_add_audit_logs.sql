-- Migration: Add audit logging table for admin actions
-- Security: Track all admin operations for compliance and forensics
-- Compliance: Required for SOC 2, ISO 27001, GDPR Article 30 (Records of Processing)
--
-- References:
-- - OWASP Logging Cheat Sheet: Log all security-relevant events
-- - NIST SP 800-53: AU-2 (Audit Events), AU-3 (Content of Audit Records)
-- - GDPR Article 30: Records of processing activities

CREATE TABLE IF NOT EXISTS audit_logs (
  -- Primary key
  id BIGSERIAL PRIMARY KEY,

  -- Who performed the action (admin user)
  admin_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  admin_username VARCHAR(50) NOT NULL, -- Denormalized for historical record (in case user deleted)

  -- What action was performed
  action VARCHAR(100) NOT NULL, -- e.g., 'user.delete', 'user.password_reset', 'user.unlock'

  -- What was the target of the action
  target_type VARCHAR(50) NOT NULL, -- e.g., 'user', 'post', 'setting'
  target_id INTEGER, -- ID of the affected resource (nullable for non-resource actions)
  target_identifier VARCHAR(255), -- Denormalized identifier (username, email, etc.) for historical record

  -- Context and details
  details JSONB, -- Additional structured data (what fields changed, etc.)
  ip_address INET, -- IP address of the admin performing the action
  user_agent TEXT, -- Browser/client information

  -- When it happened
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

  -- Indexes for common queries
  -- Query by admin user
  -- Query by action type
  -- Query by target
  -- Query by date range
  CONSTRAINT valid_action CHECK (action ~ '^[a-z_\.]+$') -- Only lowercase, underscore, dot
);

-- Indexes for performance
CREATE INDEX idx_audit_logs_admin_user_id ON audit_logs(admin_user_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_target ON audit_logs(target_type, target_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at DESC); -- Recent logs first
CREATE INDEX idx_audit_logs_target_identifier ON audit_logs(target_identifier);

-- Composite index for common query pattern: "what did this admin do recently?"
CREATE INDEX idx_audit_logs_admin_created ON audit_logs(admin_user_id, created_at DESC);

-- Composite index for "what happened to this user?"
CREATE INDEX idx_audit_logs_target_created ON audit_logs(target_type, target_id, created_at DESC);

-- Add comment for documentation
COMMENT ON TABLE audit_logs IS 'Audit trail for all administrative actions. Required for security compliance and forensic analysis.';
COMMENT ON COLUMN audit_logs.admin_user_id IS 'User ID of admin who performed the action';
COMMENT ON COLUMN audit_logs.action IS 'Action type in format: resource.action (e.g., user.delete, user.password_reset)';
COMMENT ON COLUMN audit_logs.target_type IS 'Type of resource affected (user, post, setting, etc.)';
COMMENT ON COLUMN audit_logs.target_id IS 'ID of affected resource (NULL for non-resource actions)';
COMMENT ON COLUMN audit_logs.details IS 'Additional structured context (changed fields, old values, etc.)';
COMMENT ON COLUMN audit_logs.ip_address IS 'IP address of admin performing action (for geographic/security analysis)';

-- Security: Prevent modification of audit logs (immutable)
-- Only INSERT is allowed, no UPDATE or DELETE
CREATE OR REPLACE FUNCTION prevent_audit_log_modification()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'UPDATE' OR TG_OP = 'DELETE') THEN
    RAISE EXCEPTION 'Audit logs are immutable and cannot be modified or deleted';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_log_immutable
  BEFORE UPDATE OR DELETE ON audit_logs
  FOR EACH ROW
  EXECUTE FUNCTION prevent_audit_log_modification();
