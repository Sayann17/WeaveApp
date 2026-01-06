-- Migration 05: Add Social Links to users table

ALTER TABLE users ADD COLUMN social_telegram Utf8;
ALTER TABLE users ADD COLUMN social_vk Utf8;
ALTER TABLE users ADD COLUMN social_instagram Utf8;
