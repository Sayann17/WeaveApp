-- Migration 10: Zen (Day Pause) System

-- 1. Add last_zen_at to users to track 24h interval efficiently
ALTER TABLE users ADD COLUMN last_zen_at Timestamp;

-- 2. Create table for Quotes
CREATE TABLE zen_quotes (
    id Utf8,
    text Utf8,
    theme Utf8, -- 'patience', 'action', etc.
    PRIMARY KEY (id)
);

-- 3. Create table for History (to avoid repeating quotes)
CREATE TABLE zen_history (
    user_id Utf8,
    quote_id Utf8,
    viewed_at Timestamp,
    PRIMARY KEY (user_id, quote_id)
);

-- 4. Seed initial quotes
UPSERT INTO zen_quotes (id, text, theme) VALUES 
("quote_1", "Цветок не торопится распускаться, даже если ты очень ждешь. Позволь вашему диалогу расти в своем ритме.", "Терпение");

UPSERT INTO zen_quotes (id, text, theme) VALUES 
("quote_2", "Чтобы наполнить чашу, её нужно сначала подставить под струю. Чтобы получить ответ, нужно сначала задать вопрос.", "Действие");

UPSERT INTO zen_quotes (id, text, theme) VALUES 
("quote_3", "Ветер дует, но гора остается неподвижной. Чужое 'нет' не меняет твоей истинной ценности.", "Уверенность");

UPSERT INTO zen_quotes (id, text, theme) VALUES 
("quote_4", "Не ищи того, с кем проживешь жизнь. Ищи того, с кем захочешь выпить этот чай здесь и сейчас.", "Момент");
