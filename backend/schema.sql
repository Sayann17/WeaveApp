CREATE TABLE users (
    id Utf8,
    email Utf8,
    password_hash Utf8,
    name Utf8,
    age Uint32,
    created_at Datetime,
    PRIMARY KEY (id),
    INDEX idx_users_email GLOBAL ON (email)
);
