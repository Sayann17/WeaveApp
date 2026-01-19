const { getDriver } = require('./db');
const { TypedValues, TypedData } = require('ydb-sdk');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-key-change-me';

// Admin IDs - comma separated in env var, or hardcoded fallback
const ADMIN_IDS = (process.env.ADMIN_IDS || 'bf7ed056-a8e2-4f5f-9ed8-b9cbccfadc7c').split(',');

async function handler(event, context) {
    const { httpMethod, headers, body, path } = event;
    const responseHeaders = {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'OPTIONS, POST, GET',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    };

    if (httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers: responseHeaders, body: '' };
    }

    try {
        const driver = await getDriver();

        // 1. Auth (Optional for getting events, but required for attendance)
        const authHeader = headers.Authorization || headers.authorization;
        let userId = null;

        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.split(' ')[1];
            try {
                const decoded = jwt.verify(token, JWT_SECRET);
                userId = decoded.uid || decoded.userId || decoded.id;
            } catch (e) {
                // Invalid token - treat as guest
            }
        }

        // 2. Route
        if (httpMethod === 'POST' && (path === '/block' || path.endsWith('/block'))) {
            if (!userId) return { statusCode: 401, headers: responseHeaders, body: JSON.stringify({ error: 'Unauthorized' }) };
            const data = JSON.parse(body);
            return await blockUser(driver, userId, data, responseHeaders);
        }

        if (httpMethod === 'GET' && (path === '/events' || path.endsWith('/events'))) {
            return await getEvents(driver, userId, responseHeaders);
        }

        if (httpMethod === 'POST' && (path === '/events/attend' || path.endsWith('/events/attend'))) {
            if (!userId) return { statusCode: 401, headers: responseHeaders, body: JSON.stringify({ error: 'Unauthorized' }) };
            const data = JSON.parse(body);
            return await attendEvent(driver, userId, data, responseHeaders);
        }

        if (httpMethod === 'POST' && (path === '/admin/ban' || path.endsWith('/admin/ban'))) {
            if (!userId) return { statusCode: 401, headers: responseHeaders, body: JSON.stringify({ error: 'Unauthorized' }) };
            if (!ADMIN_IDS.includes(userId)) return { statusCode: 403, headers: responseHeaders, body: JSON.stringify({ error: 'Forbidden: Admin only' }) };

            const data = JSON.parse(body);
            return await banUser(driver, userId, data, responseHeaders);
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
                '$blockerId': TypedValues.utf8(blockerId),
                '$blockedId': TypedValues.utf8(targetUserId),
                '$reason': TypedValues.utf8(reason || 'No reason provided'),
                '$chatId': TypedValues.utf8(chatId),
                '$now': TypedValues.timestamp(now)
            }, { commitTx: true, beginTx: { serializableReadWrite: {} } });
        });

        console.log(`[blockUser] User ${blockerId} blocked ${targetUserId}`);
        return { statusCode: 200, headers, body: JSON.stringify({ success: true, message: 'User blocked' }) };
    } catch (e) {
        console.error('Block DB Error:', e);
        return { statusCode: 500, headers, body: JSON.stringify({ error: 'Database error' }) };
    }
}

async function getEvents(driver, userId, responseHeaders) {
    let events = [];

    await driver.tableClient.withSession(async (session) => {
        const query = `
            SELECT id, title, description, event_date, image_key, sort_order FROM events;
        `;
        const { resultSets } = await session.executeQuery(query);
        const allEvents = TypedData.createNativeObjects(resultSets[0]);

        // Check participation
        let myEventIds = [];
        if (userId) {
            const userQuery = `
                DECLARE $userId AS Utf8;
                SELECT events FROM users WHERE id = $userId;
            `;
            const { resultSets: userRes } = await session.executeQuery(userQuery, { '$userId': TypedValues.utf8(userId) });
            if (userRes[0]) {
                const rows = TypedData.createNativeObjects(userRes[0]);
                if (rows.length > 0 && rows[0].events) {
                    try {
                        const myEvents = JSON.parse(rows[0].events);
                        if (Array.isArray(myEvents)) {
                            myEventIds = myEvents.map(e => e.id);
                        }
                    } catch (e) {
                        // ignore parse error
                    }
                }
            }
        }

        events = allEvents.map(e => ({
            id: e.id,
            title: e.title,
            description: e.description,
            date: e.event_date,
            imageKey: e.image_key,
            sortOrder: e.sort_order,
            isGoing: myEventIds.includes(e.id)
        }));
    });

    return {
        statusCode: 200,
        headers: responseHeaders,
        body: JSON.stringify({ events })
    };
}

async function attendEvent(driver, userId, body, responseHeaders) {
    const { eventId } = body;
    if (!eventId) return { statusCode: 400, headers: responseHeaders, body: JSON.stringify({ error: 'Missing eventId' }) };

    let isGoing = false;
    await driver.tableClient.withSession(async (session) => {
        // Get event details
        const eventQuery = `
            DECLARE $eventId AS Utf8;
            SELECT id, title, image_key, event_date FROM events WHERE id = $eventId LIMIT 1;
        `;
        const { resultSets: eventRes } = await session.executeQuery(eventQuery, {
            '$eventId': TypedValues.utf8(eventId)
        });
        const events = TypedData.createNativeObjects(eventRes[0]);
        if (events.length === 0) return;
        const event = events[0];

        // Get current user events
        const userQuery = `
            DECLARE $userId AS Utf8;
            SELECT events FROM users WHERE id = $userId LIMIT 1;
        `;
        const { resultSets: userRes } = await session.executeQuery(userQuery, {
            '$userId': TypedValues.utf8(userId)
        });
        const users = TypedData.createNativeObjects(userRes[0]);
        let currentEvents = [];
        if (users.length > 0 && users[0].events) {
            try {
                currentEvents = JSON.parse(users[0].events);
            } catch (e) {
                currentEvents = [];
            }
        }

        // Toggle: if already going, remove; if not going, add
        const existingIndex = currentEvents.findIndex(e => e.id === eventId);
        if (existingIndex !== -1) {
            // Already going - remove (unsubscribe)
            currentEvents.splice(existingIndex, 1);
            isGoing = false;
        } else {
            // Not going - add (subscribe)
            currentEvents.push({
                id: event.id,
                title: event.title,
                imageKey: event.image_key,
                date: event.event_date
            });
            isGoing = true;
        }

        // Update user
        const updateQuery = `
            DECLARE $userId AS Utf8;
            DECLARE $events AS Utf8;
            UPDATE users SET events = $events WHERE id = $userId;
        `;

        await session.executeQuery(updateQuery, {
            '$userId': TypedValues.utf8(userId),
            '$events': TypedValues.utf8(JSON.stringify(currentEvents))
        }, { commitTx: true, beginTx: { serializableReadWrite: {} } });

        console.log(`[attendEvent] User ${userId} ${isGoing ? 'subscribed to' : 'unsubscribed from'} event ${eventId}`);
    });

    return {
        statusCode: 200,
        headers: responseHeaders,
        body: JSON.stringify({ success: true, isGoing })
    };
}

async function banUser(driver, adminId, data, headers) {
    const { userId, reason } = data;
    if (!userId) return { statusCode: 400, headers, body: JSON.stringify({ error: 'userId is required' }) };

    console.log(`[Admin] User ${adminId} is banning ${userId} for: ${reason}`);

    await driver.tableClient.withSession(async (session) => {
        const query = `
            DECLARE $id AS Utf8;
            DECLARE $is_banned AS Bool;
            DECLARE $ban_reason AS Utf8;
            
            UPDATE users 
            SET is_banned = $is_banned, ban_reason = $ban_reason 
            WHERE id = $id;
        `;

        await session.executeQuery(query, {
            '$id': TypedValues.utf8(userId),
            '$is_banned': TypedValues.bool(true),
            '$ban_reason': TypedValues.utf8(reason || 'Violation of terms')
        }, { commitTx: true, beginTx: { serializableReadWrite: {} } });
    });

    return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true, message: 'User banned' })
    };
}

module.exports = { handler };
