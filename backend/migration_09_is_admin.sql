-- Migration to add admin flag
ALTER TABLE users ADD COLUMN is_admin Bool;
