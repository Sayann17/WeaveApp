-- Таблица для активных WebSocket соединений
CREATE TABLE socket_connections (
    user_id Utf8,
    connection_id Utf8,
    created_at Timestamp,
    PRIMARY KEY (user_id)
);

-- Таблица для лайков (кто кого лайкнул)
CREATE TABLE likes (
    from_user_id Utf8,
    to_user_id Utf8,
    created_at Timestamp,
    PRIMARY KEY (from_user_id, to_user_id)
);

-- Таблица для мэтчей (взаимных симпатий)
CREATE TABLE matches (
    user1_id Utf8,
    user2_id Utf8,
    created_at Timestamp,
    PRIMARY KEY (user1_id, user2_id)
);

-- Таблица чатов
CREATE TABLE chats (
    id Utf8, -- Составляется как user1Id_user2Id (отсортировано)
    last_message Utf8,
    last_message_time Timestamp,
    created_at Timestamp,
    is_match_chat Bool,
    PRIMARY KEY (id)
);

-- Таблица сообщений
CREATE TABLE messages (
    id Utf8,
    chat_id Utf8,
    sender_id Utf8,
    text Utf8,
    timestamp Timestamp,
    is_read Bool,
    type Utf8, -- 'text', 'system', 'image'
    PRIMARY KEY (chat_id, timestamp, id), -- Сортировка по времени внутри чата
    INDEX idx_messages_unread GLOBAL ON (chat_id, is_read)
);
