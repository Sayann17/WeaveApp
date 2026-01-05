const { getDriver } = require('./db');
const jwt = require('jsonwebtoken');
const { TypedValues, TypedData } = require('ydb-sdk');
const { v4: uuidv4 } = require('uuid');
// Using native fetch (Node.js 18+)
const { notifyNewLike, notifyMatch, notifyNewMessage } = require('./telegram');
const { sendLikeNotification, sendMatchNotifications, sendMessageNotification } = require('./telegram-helpers');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-key-change-me';

module.exports.handler = async function (event, context) {
    const { httpMethod, path, body, headers, requestContext, queryStringParameters } = event;

    // IMPORTANT: Keep this log to verify if the request reaches the function!
    console.log('[DEBUG] Request received FULL EVENT:', JSON.stringify(event, null, 2));

    console.log('[DEBUG] Request details:', {
        type: requestContext?.eventType || 'REST',
        path: path,
        method: httpMethod,
        connectionId: requestContext?.connectionId,
        queryParams: queryStringParameters
    });

    const responseHeaders = {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    };

    try {
        const driver = await getDriver();

        // Handle WebSocket events
        if (requestContext && requestContext.eventType) {
            const eventType = requestContext.eventType;
            const connectionId = requestContext.connectionId;

            if (eventType === 'CONNECT') {
                return await handleConnect(driver, event, connectionId);
            } else if (eventType === 'DISCONNECT') {
                return await handleDisconnect(driver, connectionId);
            } else if (eventType === 'MESSAGE') {
                return await handleMessage(driver, event, connectionId);
            }
        }

        // Handle REST API
        if (httpMethod === 'OPTIONS') {
            return { statusCode: 200, headers: responseHeaders };
        }

        if (path === '/matches' && httpMethod === 'GET') {
            return await getMatches(driver, headers, responseHeaders);
        } else if (path === '/chats' && httpMethod === 'GET') {
            return await getChats(driver, headers, responseHeaders);
        } else if (path === '/history' && httpMethod === 'GET') {
            const chatId = event.queryStringParameters?.chatId;
            return await getHistory(driver, headers, chatId, responseHeaders);
        } else if (path === '/like' && httpMethod === 'POST') {
            return await handleLike(driver, headers, JSON.parse(body), responseHeaders);
        } else if (path === '/profile' && httpMethod === 'GET') {
            const profileUserId = event.queryStringParameters?.userId;
            return await getUserProfile(driver, headers, profileUserId, responseHeaders);
        } else if (path === '/discovery' && httpMethod === 'GET') {
            return await getDiscovery(driver, headers, event.queryStringParameters, responseHeaders);
        } else if ((path === '/likes-you' || path === '/likes-you/') && httpMethod === 'GET') {
            return await getLikesYou(driver, headers, responseHeaders);
        }

        return {
            statusCode: 404,
            headers: responseHeaders,
            body: JSON.stringify({ error: 'Not found' })
        };
    } catch (e) {
        console.error('API Error:', e);
        return {
            statusCode: 500,
            headers: responseHeaders,
            body: JSON.stringify({ error: e.message })
        };
    }
};

async function handleConnect(driver, event, connectionId) {
    console.log('[WS] Connect attempt:', connectionId);

    // Diagnostic log: check if JWT_SECRET is actually loaded
    console.log('[DEBUG] JWT_SECRET loaded:', !!JWT_SECRET,
        JWT_SECRET ? `(${JWT_SECRET.charAt(0)}...${JWT_SECRET.slice(-1)})` : '(empty)');

    const token = event.queryStringParameters?.token;
    console.log('[DEBUG] Token received in params:', token ? token.substring(0, 20) + '...' : 'undefined');

    if (!token) {
        console.log('[WS] No token in query params');
        return { statusCode: 403 };
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        console.log('[DEBUG] Token decoded successfully. UserID:', decoded.uid);
        const userId = decoded.uid;

        await driver.tableClient.withSession(async (session) => {
            const query = `
                DECLARE $userId AS Utf8;
                DECLARE $connectionId AS Utf8;
                DECLARE $createdAt AS Timestamp;
                REPLACE INTO socket_connections (user_id, connection_id, created_at)
                VALUES ($userId, $connectionId, $createdAt);
            `;
            await session.executeQuery(query, {
                '$userId': TypedValues.utf8(userId),
                '$connectionId': TypedValues.utf8(connectionId),
                '$createdAt': TypedValues.timestamp(new Date())
            });
        });
        return { statusCode: 200 };
    } catch (e) {
        console.error('Connect error:', e);
        return { statusCode: 403 };
    }
}

async function handleDisconnect(driver, connectionId) {
    try {
        await driver.tableClient.withSession(async (session) => {
            const query = `
                DECLARE $connectionId AS Utf8;
                DELETE FROM socket_connections WHERE connection_id = $connectionId;
            `;
            // Note: This might be slow if we don't have an index on connection_id.
            // In a real production app, we'd store connection_id as a primary key or index it.
            await session.executeQuery(query, {
                '$connectionId': TypedValues.utf8(connectionId)
            });
        });
        console.log('[WS] Disconnect successful for:', connectionId);
        return { statusCode: 200 };
    } catch (e) {
        console.error('[WS] Disconnect error:', e);
        return { statusCode: 200 }; // Return 200 even on error to not block gateway
    }
}

async function handleMessage(driver, event, connectionId) {
    const body = JSON.parse(event.body);
    const { action, chatId, text, recipientId, replyToId, messageId } = body;

    if (action === 'sendMessage') {
        console.log('[WS] Sending message from:', connectionId, 'to chatId:', chatId);
        const userId = await getUserIdByConnection(driver, connectionId);
        if (!userId) {
            console.error('[WS] Sender userId not found for connectionId:', connectionId);
            return { statusCode: 403 };
        }

        const newMessageId = uuidv4();
        const timestamp = new Date();

        // 1. Save to database
        await driver.tableClient.withSession(async (session) => {
            const query = `
                DECLARE $id AS Utf8;
                DECLARE $chatId AS Utf8;
                DECLARE $senderId AS Utf8;
                DECLARE $text AS Utf8;
                DECLARE $timestamp AS Timestamp;
                DECLARE $isRead AS Bool;
                DECLARE $type AS Utf8;
                DECLARE $replyToId AS Utf8;

                INSERT INTO messages (id, chat_id, sender_id, text, timestamp, is_read, type, reply_to_id)
                VALUES ($id, $chatId, $senderId, $text, $timestamp, $isRead, $type, $replyToId);

                UPDATE chats SET last_message = $text, last_message_time = $timestamp
                WHERE id = $chatId;
            `;
            await session.executeQuery(query, {
                '$id': TypedValues.utf8(newMessageId),
                '$chatId': TypedValues.utf8(chatId),
                '$senderId': TypedValues.utf8(userId),
                '$text': TypedValues.utf8(text),
                '$timestamp': TypedValues.timestamp(timestamp),
                '$isRead': TypedValues.bool(false),
                '$type': TypedValues.utf8('text'),
                '$replyToId': TypedValues.utf8(replyToId || '') // Handle null/undefined
            });
        });
        console.log('[WS] Message saved to YDB:', newMessageId);

        // 2. Broadcast to sender and recipient if online
        const messageEvent = {
            type: 'newMessage',
            message: {
                id: newMessageId,
                chatId,
                text,
                senderId: userId,
                timestamp,
                type: 'text',
                replyToId: replyToId || null
            }
        };

        // Notify recipient
        const recipientConnectionId = await getConnectionIdByUserId(driver, recipientId);
        if (recipientConnectionId) {
            await sendToConnection(recipientConnectionId, messageEvent);
        }

        // Notify sender (echo back for UI update)
        await sendToConnection(connectionId, messageEvent);

        // 🔔 Send Telegram notification if recipient is offline
        if (!recipientConnectionId) {
            await sendMessageNotification(driver, userId, recipientId, text);
        }
    } else if (action === 'editMessage') {
        return await handleEditMessage(driver, connectionId, chatId, messageId, text, recipientId);
    }
    return { statusCode: 200 };
}

async function handleEditMessage(driver, connectionId, chatId, messageId, newText, recipientId) {
    console.log('[WS] Editing message:', messageId, 'from:', connectionId);
    const userId = await getUserIdByConnection(driver, connectionId);
    if (!userId) return { statusCode: 403 };

    const timestamp = new Date();

    // Verify ownership and update
    await driver.tableClient.withSession(async (session) => {
        // We do this in one transaction ideally, or check then update. 
        // For YDB simple query: check sender_id match
        const query = `
            DECLARE $id AS Utf8;
            DECLARE $chatId AS Utf8;
            DECLARE $senderId AS Utf8;
            DECLARE $text AS Utf8;
            DECLARE $editedAt AS Timestamp;

            -- Only update if sender matches (security)
            UPDATE messages 
            SET text = $text, is_edited = true, edited_at = $editedAt
            WHERE id = $id AND chat_id = $chatId AND sender_id = $senderId;
        `;
        await session.executeQuery(query, {
            '$id': TypedValues.utf8(messageId),
            '$chatId': TypedValues.utf8(chatId),
            '$senderId': TypedValues.utf8(userId),
            '$text': TypedValues.utf8(newText),
            '$editedAt': TypedValues.timestamp(timestamp)
        });
    });

    const editEvent = {
        type: 'messageEdited',
        message: {
            id: messageId,
            chatId,
            text: newText,
            senderId: userId, // needed?
            editedAt: timestamp
        }
    };

    // Broadcast update
    await sendToConnection(connectionId, editEvent);
    const recipientConn = await getConnectionIdByUserId(driver, recipientId);
    if (recipientConn) {
        await sendToConnection(recipientConn, editEvent);
    }

    return { statusCode: 200 };
}

async function getMatches(driver, requestHeaders, responseHeaders) {
    const userId = checkAuth(requestHeaders);
    if (!userId) return { statusCode: 401, headers: responseHeaders, body: JSON.stringify({ error: 'Unauthorized' }) };

    let matches = [];
    await driver.tableClient.withSession(async (session) => {
        // Query to get matches with partner details
        const query = `
            DECLARE $userId AS Utf8;
            
            -- Matches where current user is user1
            SELECT 
                m.user2_id as id, 
                u.name as name, 
                u.age as age, 
                u.photos as photos, 
                u.ethnicity as ethnicity,
                m.created_at as created_at
            FROM matches m
            JOIN users u ON m.user2_id = u.id
            WHERE m.user1_id = $userId
            
            UNION ALL
            
            -- Matches where current user is user2
            SELECT 
                m.user1_id as id, 
                u.name as name, 
                u.age as age, 
                u.photos as photos, 
                u.ethnicity as ethnicity,
                m.created_at as created_at
            FROM matches m
            JOIN users u ON m.user1_id = u.id
            WHERE m.user2_id = $userId;
        `;
        const { resultSets } = await session.executeQuery(query, {
            '$userId': TypedValues.utf8(userId)
        });

        const getVal = (obj, key) => obj[key.toLowerCase()] || obj[key.charAt(0).toUpperCase() + key.slice(1)] || obj[key];

        matches = TypedData.createNativeObjects(resultSets[0]).map(m => {
            const mId = getVal(m, 'id');
            const mPhotos = getVal(m, 'photos');
            return {
                id: mId,
                name: getVal(m, 'name'),
                age: getVal(m, 'age'),
                ethnicity: getVal(m, 'ethnicity'),
                photos: typeof mPhotos === 'string' ? (mPhotos.startsWith('[') ? JSON.parse(mPhotos) : [mPhotos]) : mPhotos,
                chatId: [userId, mId].sort().join('_'),
                created_at: getVal(m, 'created_at')
            };
        });
    });
    return { statusCode: 200, headers: responseHeaders, body: JSON.stringify({ matches }) };
}

async function getLikesYou(driver, requestHeaders, responseHeaders) {
    const userId = checkAuth(requestHeaders);
    if (!userId) return { statusCode: 401, headers: responseHeaders, body: JSON.stringify({ error: 'Unauthorized' }) };

    let likes = [];
    await driver.tableClient.withSession(async (session) => {
        // Get users who liked me, but we haven't liked them back (otherwise they'd be matches)
        const query = `
            DECLARE $userId AS Utf8;
            $my_likes = (SELECT to_user_id FROM likes WHERE from_user_id = $userId);
            
            SELECT 
                u.id as id, 
                u.name as name, 
                u.age as age, 
                u.photos as photos, 
                u.ethnicity as ethnicity,
                l.created_at as created_at
            FROM likes l
            JOIN users u ON l.from_user_id = u.id
            LEFT JOIN $my_likes m ON m.to_user_id = l.from_user_id
            WHERE l.to_user_id = $userId
            AND m.to_user_id IS NULL;
        `;
        const { resultSets } = await session.executeQuery(query, {
            '$userId': TypedValues.utf8(userId)
        });

        const getVal = (obj, key) => obj[key.toLowerCase()] || obj[key.charAt(0).toUpperCase() + key.slice(1)] || obj[key];

        if (resultSets && resultSets.length > 0) {
            likes = TypedData.createNativeObjects(resultSets[0]).map(l => {
                const lPhotos = getVal(l, 'photos');
                return {
                    id: getVal(l, 'id'),
                    name: getVal(l, 'name'),
                    age: getVal(l, 'age'),
                    ethnicity: getVal(l, 'ethnicity'),
                    photos: typeof lPhotos === 'string' ? (lPhotos.startsWith('[') ? JSON.parse(lPhotos) : [lPhotos]) : lPhotos,
                    created_at: getVal(l, 'created_at')
                };
            });
        }
    });
    return { statusCode: 200, headers: responseHeaders, body: JSON.stringify({ profiles: likes }) };
}

async function getChats(driver, requestHeaders, responseHeaders) {
    const userId = checkAuth(requestHeaders);
    if (!userId) return { statusCode: 401, headers: responseHeaders, body: JSON.stringify({ error: 'Unauthorized' }) };

    let chats = [];
    await driver.tableClient.withSession(async (session) => {
        const query = `
            DECLARE $userId AS Utf8;
            SELECT * FROM chats WHERE id LIKE $userId || '_%' OR id LIKE '%_' || $userId;
        `;
        const { resultSets } = await session.executeQuery(query, {
            '$userId': TypedValues.utf8(userId)
        });
        chats = TypedData.createNativeObjects(resultSets[0]);
    });
    return { statusCode: 200, headers: responseHeaders, body: JSON.stringify({ chats }) };
}

async function getHistory(driver, requestHeaders, chatId, responseHeaders) {
    const userId = checkAuth(requestHeaders);
    if (!userId) return { statusCode: 401, headers: responseHeaders, body: JSON.stringify({ error: 'Unauthorized' }) };

    let messages = [];
    await driver.tableClient.withSession(async (session) => {
        const query = `
            DECLARE $chatId AS Utf8;
            SELECT * FROM messages WHERE chat_id = $chatId ORDER BY timestamp ASC;
        `;
        const { resultSets } = await session.executeQuery(query, {
            '$chatId': TypedValues.utf8(chatId)
        });
        const getVal = (obj, key) => obj[key.toLowerCase()] || obj[key.charAt(0).toUpperCase() + key.slice(1)] || obj[key];

        messages = TypedData.createNativeObjects(resultSets[0]).map(m => ({
            id: getVal(m, 'id'),
            chat_id: getVal(m, 'chat_id'),
            sender_id: getVal(m, 'sender_id'),
            text: getVal(m, 'text'),
            timestamp: getVal(m, 'timestamp'),
            is_read: getVal(m, 'is_read'),
            type: getVal(m, 'type'),
            replyToId: getVal(m, 'reply_to_id') || null, // Map new field
            isEdited: !!getVal(m, 'is_edited'),           // Map new field
            editedAt: getVal(m, 'edited_at') || null      // Map new field
        }));
    });
    return { statusCode: 200, headers: responseHeaders, body: JSON.stringify({ messages }) };
}

async function handleLike(driver, requestHeaders, body, responseHeaders) {
    const userId = checkAuth(requestHeaders);
    if (!userId) return { statusCode: 401, headers: responseHeaders, body: JSON.stringify({ error: 'Unauthorized' }) };

    const { targetUserId } = body;
    const timestamp = new Date();

    const result = await driver.tableClient.withSession(async (session) => {
        // 1. Check if recipient already liked us
        const checkQuery = `
            DECLARE $userId AS Utf8;
            DECLARE $targetId AS Utf8;
            SELECT * FROM likes WHERE from_user_id = $targetId AND to_user_id = $userId;
        `;
        const { resultSets } = await session.executeQuery(checkQuery, {
            '$userId': TypedValues.utf8(userId),
            '$targetId': TypedValues.utf8(targetUserId)
        });
        const rows = TypedData.createNativeObjects(resultSets[0]);
        const isMutual = rows.length > 0;

        // 2. Save our like
        const saveLikeQuery = `
            DECLARE $fromId AS Utf8;
            DECLARE $toId AS Utf8;
            DECLARE $createdAt AS Timestamp;
            REPLACE INTO likes (from_user_id, to_user_id, created_at)
            VALUES ($fromId, $toId, $createdAt);
        `;
        await session.executeQuery(saveLikeQuery, {
            '$fromId': TypedValues.utf8(userId),
            '$toId': TypedValues.utf8(targetUserId),
            '$createdAt': TypedValues.timestamp(timestamp)
        });

        if (isMutual) {
            const chatId = [userId, targetUserId].sort().join('_');
            const matchQuery = `
                DECLARE $u1 AS Utf8;
                DECLARE $u2 AS Utf8;
                DECLARE $chatId AS Utf8;
                DECLARE $createdAt AS Timestamp;
                
                REPLACE INTO matches (user1_id, user2_id, created_at)
                VALUES ($u1, $u2, $createdAt);

                REPLACE INTO chats (id, last_message, last_message_time, created_at, is_match_chat)
                VALUES ($chatId, 'Вы понравились друг другу!', $createdAt, $createdAt, true);
            `;
            const sorted = [userId, targetUserId].sort();
            await session.executeQuery(matchQuery, {
                '$u1': TypedValues.utf8(sorted[0]),
                '$u2': TypedValues.utf8(sorted[1]),
                '$chatId': TypedValues.utf8(chatId),
                '$createdAt': TypedValues.timestamp(timestamp)
            });

            // Notify both users via WebSocket
            await notifyMatchViaWebSocket(driver, userId, targetUserId, chatId);

            // 🔔 Send Telegram notifications for match
            await sendMatchNotifications(driver, userId, targetUserId);

            return { type: 'match', chatId };
        }

        // 🔔 Send Telegram notification for like (not a match)
        await sendLikeNotification(driver, targetUserId);

        return { type: 'like' };
    });

    return { statusCode: 200, headers: responseHeaders, body: JSON.stringify(result) };
}

function checkAuth(headers) {
    const authHeader = headers['Authorization'] || headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
    const token = authHeader.split(' ')[1];
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        return decoded.uid;
    } catch (e) {
        return null;
    }
}

async function notifyMatchViaWebSocket(driver, user1Id, user2Id, chatId) {
    const conn1 = await getConnectionIdByUserId(driver, user1Id);
    const conn2 = await getConnectionIdByUserId(driver, user2Id);

    const matchEvent = { type: 'match', chatId };

    if (conn1) await sendToConnection(conn1, matchEvent);
    if (conn2) await sendToConnection(conn2, matchEvent);
}

async function getUserIdByConnection(driver, connectionId) {
    let userId = null;
    await driver.tableClient.withSession(async (session) => {
        const query = `
            DECLARE $connectionId AS Utf8;
            SELECT user_id FROM socket_connections WHERE connection_id = $connectionId LIMIT 1;
        `;
        const { resultSets } = await session.executeQuery(query, {
            '$connectionId': TypedValues.utf8(connectionId)
        });
        const rows = TypedData.createNativeObjects(resultSets[0]);
        if (rows.length > 0) userId = rows[0].user_id;
    });
    return userId;
}

async function getConnectionIdByUserId(driver, userId) {
    let connectionId = null;
    await driver.tableClient.withSession(async (session) => {
        const query = `
            DECLARE $userId AS Utf8;
            SELECT connection_id FROM socket_connections WHERE user_id = $userId LIMIT 1;
        `;
        const { resultSets } = await session.executeQuery(query, {
            '$userId': TypedValues.utf8(userId)
        });
        const rows = TypedData.createNativeObjects(resultSets[0]);
        if (rows.length > 0) connectionId = rows[0].connection_id;
    });
    return connectionId;
}

async function sendToConnection(connectionId, message) {
    const gatewayUrl = process.env.WS_GATEWAY_URL;
    if (!gatewayUrl) {
        console.error('[WS] WS_GATEWAY_URL not set in environment variables!');
        return;
    }

    console.log(`[WS] Sending to ${connectionId} via ${gatewayUrl}`);

    try {
        const response = await fetch(`${gatewayUrl}${connectionId}`, {
            method: 'POST',
            body: JSON.stringify(message),
            headers: { 'Content-Type': 'application/json' }
        });
        console.log(`[WS] Send to ${connectionId} result: ${response.status} ${response.statusText}`);
    } catch (e) {
        console.error('[WS] Broadcast error details:', e);
    }
}

async function getUserProfile(driver, requestHeaders, userId, responseHeaders) {
    const requesterId = checkAuth(requestHeaders);
    if (!requesterId) return { statusCode: 401, headers: responseHeaders, body: JSON.stringify({ error: 'Unauthorized' }) };

    let user = null;
    await driver.tableClient.withSession(async (session) => {
        const query = `
            DECLARE $userId AS Utf8;
            SELECT * FROM users WHERE id = $userId LIMIT 1;
        `;
        const { resultSets } = await session.executeQuery(query, {
            '$userId': TypedValues.utf8(userId)
        });
        const rows = TypedData.createNativeObjects(resultSets[0]);
        if (rows.length > 0) user = rows[0];
    });

    if (!user) return { statusCode: 404, headers: responseHeaders, body: JSON.stringify({ error: 'User not found' }) };

    const tryParse = (val) => {
        if (!val) return [];
        if (Array.isArray(val)) return val;
        try { return JSON.parse(val); } catch (e) { return []; }
    };

    return {
        statusCode: 200,
        headers: responseHeaders,
        body: JSON.stringify({
            id: user.id,
            name: user.name,
            photos: tryParse(user.photos),
            age: user.age,
            gender: user.gender,
            bio: user.about,
            about: user.about,
            ethnicity: user.ethnicity,
            religions: tryParse(user.religion),
            zodiac: user.zodiac,
            interests: tryParse(user.interests),
            macroGroups: tryParse(user.macro_groups),
            culture_pride: user.culture_pride,
            love_language: user.love_language,
            family_memory: user.family_memory,
            stereotype_true: user.stereotype_true,
            stereotype_false: user.stereotype_false,
            job: user.job
        })
    };
}

async function getDiscovery(driver, requestHeaders, filters, responseHeaders) {
    const userId = checkAuth(requestHeaders);
    if (!userId) return { statusCode: 401, headers: responseHeaders, body: JSON.stringify({ error: 'Unauthorized' }) };

    console.log('[getDiscovery] User ID:', userId);
    console.log('[getDiscovery] Filters:', filters);

    const tryParse = (val) => {
        if (!val) return [];
        if (Array.isArray(val)) return val;
        try {
            return JSON.parse(val);
        } catch (e) {
            console.error('[getDiscovery] JSON parse error for value:', val, e);
            return [];
        }
    };

    let profiles = [];
    await driver.tableClient.withSession(async (session) => {
        // 1. Get IDs already liked/disliked to exclude
        const excludeQuery = `
            DECLARE $userId AS Utf8;
            SELECT to_user_id FROM likes WHERE from_user_id = $userId;
        `;
        const { resultSets: resLikes } = await session.executeQuery(excludeQuery, { '$userId': TypedValues.utf8(userId) });
        const excludedIds = TypedData.createNativeObjects(resLikes[0]).map(r => r.to_user_id);
        excludedIds.push(userId); // Exclude self

        console.log('[getDiscovery] Excluded IDs count:', excludedIds.length);

        // 2. Fetch users with filters
        let usersQuery = `SELECT * FROM users WHERE profile_completed = 1`;
        const params = {};

        if (filters) {
            if (filters.gender && filters.gender !== 'all') {
                usersQuery += ` AND gender = $gender`;
                params['$gender'] = TypedValues.utf8(filters.gender);
            }
            if (filters.minAge) {
                usersQuery += ` AND age >= $minAge`;
                params['$minAge'] = TypedValues.uint32(parseInt(filters.minAge));
            }
            if (filters.maxAge) {
                usersQuery += ` AND age <= $maxAge`;
                params['$maxAge'] = TypedValues.uint32(parseInt(filters.maxAge));
            }
            if (filters.ethnicity) {
                usersQuery += ` AND ethnicity = $ethnicity`;
                params['$ethnicity'] = TypedValues.utf8(filters.ethnicity);
            }
            if (filters.religion) {
                usersQuery += ` AND religion = $religion`;
                params['$religion'] = TypedValues.utf8(filters.religion);
            }
        }

        console.log('[getDiscovery] Query:', usersQuery);
        console.log('[getDiscovery] Params:', Object.keys(params));

        const { resultSets: resUsers } = await session.executeQuery(usersQuery, params);
        const allUsers = TypedData.createNativeObjects(resUsers[0]);

        console.log('[getDiscovery] Total users from DB:', allUsers.length);
        if (allUsers.length > 0) {
            console.log('[getDiscovery] Sample user:', {
                id: allUsers[0].id,
                name: allUsers[0].name,
                profile_completed: allUsers[0].profile_completed
            });
        }

        // Filter out excluded IDs and map
        profiles = allUsers
            .filter(u => !excludedIds.includes(u.id))
            .map(u => ({
                id: u.id,
                name: u.name,
                age: u.age,
                photos: tryParse(u.photos),
                bio: u.about,
                gender: u.gender,
                ethnicity: u.ethnicity,
                religion: u.religion,
                macroGroups: tryParse(u.macro_groups),
                zodiac: u.zodiac,
                religions: tryParse(u.religion),
                profileCompleted: true
            }));

        console.log('[getDiscovery] Profiles after filtering:', profiles.length);
    });

    console.log('[getDiscovery] Returning profiles:', profiles.length);

    return {
        statusCode: 200,
        headers: responseHeaders,
        body: JSON.stringify({ profiles })
    };
}
