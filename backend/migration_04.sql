-- Migration 04: Add Geolocation fields to users table

ALTER TABLE users
ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS city TEXT,
ADD COLUMN IF NOT EXISTS last_location_updated_at TIMESTAMP WITH TIME ZONE;

-- Create index for faster location queries (optional but good for performance)
CREATE INDEX IF NOT EXISTS idx_users_location ON users (latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_users_city ON users (city);
