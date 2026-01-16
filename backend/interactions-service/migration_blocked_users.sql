CREATE TABLE blocked_users (
    blocker_id Utf8,
    blocked_id Utf8,
    reason Utf8,
    created_at Timestamp,
    PRIMARY KEY (blocker_id, blocked_id)
);
