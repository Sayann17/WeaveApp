-- Migration to add ban system fields
ALTER TABLE users ADD COLUMN is_banned Bool;
ALTER TABLE users ADD COLUMN ban_reason Utf8;
