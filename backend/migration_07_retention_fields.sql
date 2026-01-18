-- Add last_login and last_notified_at columns to users table
ALTER TABLE users ADD COLUMN last_login Timestamp;
ALTER TABLE users ADD COLUMN last_notified_at Timestamp;
