-- Add last_seen column to users table for online status tracking
ALTER TABLE users ADD COLUMN last_seen Timestamp;
