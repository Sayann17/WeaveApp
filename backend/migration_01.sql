-- Add profile fields to Users table
ALTER TABLE users ADD COLUMN gender Utf8;
ALTER TABLE users ADD COLUMN ethnicity Utf8;
ALTER TABLE users ADD COLUMN religion Utf8;
ALTER TABLE users ADD COLUMN zodiac Utf8;
ALTER TABLE users ADD COLUMN about Utf8;
ALTER TABLE users ADD COLUMN job Utf8;
ALTER TABLE users ADD COLUMN interests Utf8; -- Will store as JSON string or comma separated
ALTER TABLE users ADD COLUMN photos Utf8;    -- Will store as JSON string
ALTER TABLE users ADD COLUMN macro_groups Utf8; -- JSON string for macrogroups
ALTER TABLE users ADD COLUMN profile_completed Uint32; -- 0 or 1
ALTER TABLE users ADD COLUMN updated_at Datetime;

-- Add personality hook fields
ALTER TABLE users ADD COLUMN culture_pride Utf8;
ALTER TABLE users ADD COLUMN love_language Utf8;
ALTER TABLE users ADD COLUMN family_memory Utf8;
ALTER TABLE users ADD COLUMN stereotype_true Utf8;
ALTER TABLE users ADD COLUMN stereotype_false Utf8;
