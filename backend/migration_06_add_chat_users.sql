-- Migration 06: Add user columns to chats table
-- This migration adds user1_id and user2_id columns to track chat participants

ALTER TABLE chats ADD COLUMN user1_id Utf8;
ALTER TABLE chats ADD COLUMN user2_id Utf8;

-- Note: YDB doesn't support CREATE INDEX in this syntax
-- Indexes are defined in table creation or via YDB-specific syntax
