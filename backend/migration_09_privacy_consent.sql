-- Migration 09: Add privacy_accepted_at column

ALTER TABLE users ADD COLUMN privacy_accepted_at Timestamp;
