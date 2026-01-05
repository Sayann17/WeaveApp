-- Migration 03: Add support for message editing and replies
ALTER TABLE messages ADD COLUMN reply_to_id Utf8;
ALTER TABLE messages ADD COLUMN is_edited Bool;
ALTER TABLE messages ADD COLUMN edited_at Timestamp;
