-- Migration: Add sort_order to events
-- Run this in your YDB console

ALTER TABLE events ADD COLUMN sort_order Int32;

-- Update existing events
-- Club of Tuvan Culture -> 2 (show second)
-- We need to know the IDs.
-- 'tuva-culture-1' -> 2

UPDATE events SET sort_order = 2 WHERE id = "tuva-culture-1";

-- Assuming the other event (Jazz) has some ID, but wait, the user said "Jazz" was the "second event" in previous context (mock), but now "Tuva" is the one they added to DB.
-- Actually the user said "Why is the second event showing first?". If they added "Tuva" recently, maybe they want it 2nd.
-- Let's just set "tuva-culture-1" to 2 for now as requested ("нужно чтобы оно показывалось вторым").
-- You (the user) will need to update other events to have sort_order 1, 3 etc.
