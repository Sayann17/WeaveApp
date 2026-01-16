const { getDriver } = require('./db');
const { TypedData, Types } = require('ydb-sdk');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-key-change-me';

async function handler(event, context) {
    const { httpMethod, headers, body, path } = event;
    const responseHeaders = {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'OPTIONS, POST',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    };

    if (httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers: responseHeaders, body: '' };
    }

    try {
        const driver = await getDriver();

        // 1. Auth
        const authHeader = headers.Authorization || headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return { statusCode: 401, headers: responseHeaders, body: JSON.stringify({ error: 'Unauthorized' }) };
        }
        const token = authHeader.split(' ')[1];
        let userId;
        try {
            const decoded = jwt.verify(token, JWT_SECRET);
            userId = decoded.uid || decoded.userId || decoded.id; // Check all possible fields
        } catch (e) {
            return { statusCode: 401, headers: responseHeaders, body: JSON.stringify({ error: 'Invalid token' }) };
        }

        // 2. Route
        if (httpMethod === 'POST' && (path === '/block' || path.endsWith('/block'))) {
            const data = JSON.parse(body);
            return await blockUser(driver, userId, data, responseHeaders);
        }

        return { statusCode: 404, headers: responseHeaders, body: JSON.stringify({ error: 'Not found' }) };

    } catch (error) {
        console.error('Handler Error:', error);
        return { statusCode: 500, headers: responseHeaders, body: JSON.stringify({ error: 'Internal Server Error' }) };
    }
}

async function blockUser(driver, blockerId, data, headers) {
    const { targetUserId, reason } = data;
    if (!targetUserId) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'targetUserId is required' }) };
    }

    // Chat ID Logic: Consistent with MatchService -> [id1, id2].sort().join('_')
    const chatId = [blockerId, targetUserId].sort().join('_');
    const now = new Date();

    const query = `
        DECLARE $blockerId AS Utf8;
        DECLARE $blockedId AS Utf8;
        DECLARE $reason AS Utf8;
        DECLARE $chatId AS Utf8;
        DECLARE $now AS Timestamp;

        -- 1. Insert Block
        UPSERT INTO blocked_users (blocker_id, blocked_id, reason, created_at)
        VALUES ($blockerId, $blockedId, $reason, $now);

        -- 2. Delete Matches (Check both directions)
        DELETE FROM matches WHERE user1_id = $blockerId AND user2_id = $blockedId;
        DELETE FROM matches WHERE user1_id = $blockedId AND user2_id = $blockerId;

        -- 3. Delete Likes (Check both directions)
        DELETE FROM likes WHERE from_user_id = $blockerId AND to_user_id = $blockedId;
        DELETE FROM likes WHERE from_user_id = $blockedId AND to_user_id = $blockerId;

        -- 4. Delete Chat
        DELETE FROM chats WHERE id = $chatId;

        -- 5. Delete Messages
        DELETE FROM messages WHERE chat_id = $chatId;
    `;

    try {
        await driver.tableClient.withSession(async (session) => {
            const preparedQuery = await session.prepareQuery(query);
            await session.executeQuery(preparedQuery, {
                '$blockerId': TypedData.createNative(Types.UTF8, blockerId),
                '$blockedId': TypedData.createNative(Types.UTF8, targetUserId),
                '$reason': TypedData.createNative(Types.UTF8, reason || 'No reason provided'),
                '$chatId': TypedData.createNative(Types.UTF8, chatId),
                '$now': TypedData.createNative(Types.TIMESTAMP, now)
            });
        });

        console.log(`[blockUser] User ${blockerId} blocked ${targetUserId}`);
        return { statusCode: 200, headers, body: JSON.stringify({ success: true, message: 'User blocked' }) };
    } catch (e) {
        console.error('Block DB Error:', e);
        return { statusCode: 500, headers, body: JSON.stringify({ error: 'Database error' }) };
    }
}

module.exports = { handler };
