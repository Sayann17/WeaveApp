const { getDriver } = require('./db');
const jwt = require('jsonwebtoken');
const { TypedValues, TypedData } = require('ydb-sdk');
const { v4: uuidv4 } = require('uuid');
// Using native fetch (Node.js 18+)
// const { notifyNewLike, notifyMatch, notifyNewMessage } = require('./telegram');
// const { sendLikeNotification, sendMatchNotifications, sendMessageNotification } = require('./telegram-helpers');

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
        } else if ((path === '/your-likes' || path === '/your-likes/') && httpMethod === 'GET') {
            return await getYourLikes(driver, headers, responseHeaders);
        } else if ((path === '/notifications/stats' || path === '/notifications/stats/') && httpMethod === 'GET') {
            return await getNotificationStats(driver, headers, responseHeaders);
        } else if ((path === '/mark-read' || path === '/mark-read/') && httpMethod === 'POST') {
            return await markAsRead(driver, headers, JSON.parse(body), responseHeaders);
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
        // DON'T DELETE connections on disconnect!
        // Yandex API Gateway closes WebSocket connections after each message,
        // but we need to keep the connection_id in the database to send messages.
        // Connections will be cleaned up by a periodic cleanup job (TODO).

        console.log('[WS] Disconnect event for:', connectionId, '(keeping connection in DB)');
        return { statusCode: 200 };

        /* DISABLED - This was causing 404 errors when sending messages
        await driver.tableClient.withSession(async (session) => {
            const query = `
                DECLARE $connectionId AS Utf8;
                DELETE FROM socket_connections WHERE connection_id = $connectionId;
            `;
            await session.executeQuery(query, {
                '$connectionId': TypedValues.utf8(connectionId)
            });
        });
        console.log('[WS] Disconnect successful for:', connectionId);
        */
    } catch (e) {
        console.error('[WS] Disconnect error:', e);
        return { statusCode: 200 }; // Return 200 even on error to not block gateway
    }
}

async function sendMessageNotification(driver, userId, recipientId, text) {
    // ... imported from helper
    try {
        const { sendMessageNotification } = require('./telegram-helpers');
        await sendMessageNotification(driver, userId, recipientId, text);
    } catch (e) {
        console.error('[WS] Error sending Telegram notification:', e);
    }
}

async function handleMessage(driver, event, connectionId) {
    console.log('[WS] handleMessage called from:', connectionId);
    let body;
    try {
        body = JSON.parse(event.body);
    } catch (e) {
        console.error('[WS] Failed to parse message body:', event.body);
        return { statusCode: 400 };
    }

    const { action, chatId, text, recipientId, replyToId, messageId } = body;

    if (action === 'sendMessage') {
        console.log(`[WS] Sending message: text="${text && text.substring(0, 20)}...", chatId=${chatId}, recipientId=${recipientId}`);
        const userId = await getUserIdByConnection(driver, connectionId);
        if (!userId) {
            console.error('[WS] Sender userId not found for connectionId:', connectionId);
            return { statusCode: 403 };
        }
        console.log('[WS] Sender identified:', userId);

        const newMessageId = uuidv4();
        const timestamp = new Date();

        // 1. Save to database
        try {
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
                    '$replyToId': TypedValues.utf8(replyToId || '')
                });
            });
            console.log('[WS] Message saved to YDB:', newMessageId);
        } catch (dbError) {
            console.error('[WS] Database save error:', dbError);
            return { statusCode: 500 };
        }

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
        console.log(`[WS] Recipient ${recipientId} connectionId:`, recipientConnectionId || 'OFFLINE');

        if (recipientConnectionId) {
            await sendToConnection(recipientConnectionId, messageEvent);
        }

        // Notify sender (echo back)
        console.log('[WS] Echoing back to sender:', connectionId);
        await sendToConnection(connectionId, messageEvent);

        // 🔔 Send Telegram notification if recipient is offline
        if (!recipientConnectionId) {
            console.log('[WS] Recipient offline, sending Telegram notification...');
            // Need to require helper if not in scope or just call if imported at top
            // try {
            //     const { sendMessageNotification } = require('./telegram-helpers');
            //     await sendMessageNotification(driver, userId, recipientId, text);
            // } catch (tnErr) {
            //     console.error('[WS] Telegram notification error:', tnErr);
            // }
        }
    } else if (action === 'editMessage') {
        return await handleEditMessage(driver, connectionId, chatId, messageId, text, recipientId);
    }
    return { statusCode: 200 };
}

async function sendToConnection(connectionId, message) {
    const gatewayUrl = process.env.WS_GATEWAY_URL;
    if (!gatewayUrl) {
        console.error('[WS] WS_GATEWAY_URL not set in environment variables!');
        return;
    }

    const fullUrl = `${gatewayUrl}${connectionId}`;
    console.log(`[WS] Sending to ${connectionId} via ${fullUrl}`);

    try {
        const response = await fetch(fullUrl, {
            method: 'POST',
            body: JSON.stringify(message),
            headers: { 'Content-Type': 'application/json' }
        });

        if (!response.ok) {
            console.error(`[WS] Send failed. Status: ${response.status} ${response.statusText}`);
            const errText = await response.text().catch(() => '');
            console.error(`[WS] Error body:`, errText);
        } else {
            console.log(`[WS] Send success: ${response.status}`);
        }
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

    const tryParse = (val) => {
        if (!val) return [];
        if (Array.isArray(val)) return val;
        try { return JSON.parse(val); } catch (e) { return []; }
    };

    let profiles = [];
    await driver.tableClient.withSession(async (session) => {
        // 1. Get current user's location & excluded IDs
        const currentUserQuery = `
            DECLARE $userId AS Utf8;
            SELECT to_user_id FROM likes WHERE from_user_id = $userId;
            SELECT latitude, longitude, city FROM users WHERE id = $userId;
        `;
        const { resultSets: resData } = await session.executeQuery(currentUserQuery, { '$userId': TypedValues.utf8(userId) });

        const excludedIds = TypedData.createNativeObjects(resData[0]).map(r => r.to_user_id);
        excludedIds.push(userId); // Exclude self

        const currentUserData = TypedData.createNativeObjects(resData[1])[0] || {};
        const myLat = currentUserData.latitude;
        const myLon = currentUserData.longitude;
        const myCity = currentUserData.city ? currentUserData.city.toLowerCase().trim() : null;

        console.log('[getDiscovery] My Location:', { myCity, myLat, myLon });

        // 2. Fetch users with filters
        let usersQuery = `SELECT * FROM users WHERE profile_completed = 1`;
        const params = {};

        console.log('[getDiscovery] Filters:', JSON.stringify(filters)); // DEBUG

        if (filters) {
            if (filters.gender && filters.gender !== 'all') {
                usersQuery += ` AND gender = $gender`;
                params['$gender'] = TypedValues.utf8(filters.gender);
            }
            if (filters.minAge) {
                usersQuery += ` AND age >= $minAge`;
                const val = parseInt(filters.minAge);
                params['$minAge'] = TypedValues.uint32(isNaN(val) ? 18 : val);
            }
            if (filters.maxAge) {
                usersQuery += ` AND age <= $maxAge`;
                const val = parseInt(filters.maxAge);
                params['$maxAge'] = TypedValues.uint32(isNaN(val) ? 100 : val);
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

        console.log('[getDiscovery] Query:', usersQuery); // DEBUG

        const { resultSets: resUsers } = await session.executeQuery(usersQuery, params);
        const allUsers = TypedData.createNativeObjects(resUsers[0]);
        console.log(`[getDiscovery] DB returned ${allUsers.length} potential matches`);

        // Helper for Haversine Distance (in km)
        const getDistance = (lat1, lon1, lat2, lon2) => {
            if (!lat1 || !lon1 || !lat2 || !lon2) return Infinity;
            const R = 6371; // Radius of the earth in km
            const dLat = (lat2 - lat1) * (Math.PI / 180);
            const dLon = (lon2 - lon1) * (Math.PI / 180);
            const a =
                Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
                Math.sin(dLon / 2) * Math.sin(dLon / 2);
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
            return R * c;
        };

        // Filter and Map
        profiles = allUsers
            .filter(u => !excludedIds.includes(u.id))
            .map(u => {
                const uCity = u.city ? u.city.toLowerCase().trim() : null;
                const distance = getDistance(myLat, myLon, u.latitude, u.longitude);
                const isCityMatch = myCity && uCity && myCity === uCity;

                return {
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
                    profileCompleted: true,
                    // Sorting helpers (not sent to client usually, but useful for debugging)
                    _distance: distance,
                    _isCityMatch: isCityMatch,
                    city: u.city // Send city to frontend to show it
                };
            });

        // Sort: 
        // 1. City Match (Top)
        // 2. Distance (Ascending)
        profiles.sort((a, b) => {
            if (a._isCityMatch && !b._isCityMatch) return -1;
            if (!a._isCityMatch && b._isCityMatch) return 1;

            const distA = a._distance === Infinity ? 99999999 : a._distance;
            const distB = b._distance === Infinity ? 99999999 : b._distance;
            return distA - distB;
        });
    });

    console.log('[getDiscovery] Returning profiles:', profiles.length);

    return {
        statusCode: 200,
        headers: responseHeaders,
        body: JSON.stringify({ profiles })
    };
}

async function getNotificationStats(driver, requestHeaders, responseHeaders) {
    const userId = checkAuth(requestHeaders);
    if (!userId) return { statusCode: 401, headers: responseHeaders, body: JSON.stringify({ error: 'Unauthorized' }) };

    let unreadMessages = 0;
    let newLikes = 0;

    await driver.tableClient.withSession(async (session) => {
        const msgQuery = `
            DECLARE $userId AS Utf8;
            SELECT COUNT(*) as count 
            FROM messages 
            WHERE (chat_id LIKE $userId || '_%' OR chat_id LIKE '%_' || $userId)
            AND sender_id != $userId 
            AND is_read = false;
        `;
        const { resultSets: msgRes } = await session.executeQuery(msgQuery, { '$userId': TypedValues.utf8(userId) });

        // Handle YDB count result safely
        if (msgRes[0] && msgRes[0].rows && msgRes[0].rows.length > 0) {
            const countVal = msgRes[0].rows[0].items[0].uint64Value || msgRes[0].rows[0].items[0].int64Value;
            unreadMessages = Number(countVal);
        }

        const likeQuery = `
            DECLARE $userId AS Utf8;
            $my_likes = (SELECT to_user_id FROM likes WHERE from_user_id = $userId);
            
            SELECT COUNT(*) as count
            FROM likes l
            LEFT JOIN $my_likes m ON m.to_user_id = l.from_user_id
            WHERE l.to_user_id = $userId
            AND m.to_user_id IS NULL; 
        `;
        const { resultSets: likeRes } = await session.executeQuery(likeQuery, { '$userId': TypedValues.utf8(userId) });

        if (likeRes[0] && likeRes[0].rows && likeRes[0].rows.length > 0) {
            const countVal = likeRes[0].rows[0].items[0].uint64Value || likeRes[0].rows[0].items[0].int64Value;
            newLikes = Number(countVal);
        }
    });

    return {
        statusCode: 200,
        headers: responseHeaders,
        body: JSON.stringify({ unreadMessages, newLikes })
    };
}

async function markAsRead(driver, requestHeaders, body, responseHeaders) {
    const userId = checkAuth(requestHeaders);
    if (!userId) return { statusCode: 401, headers: responseHeaders, body: JSON.stringify({ error: 'Unauthorized' }) };

    const { chatId } = body;
    if (!chatId) return { statusCode: 400, headers: responseHeaders, body: JSON.stringify({ error: 'Missing chatId' }) };

    await driver.tableClient.withSession(async (session) => {
        const query = `
            DECLARE $chatId AS Utf8;
            DECLARE $userId AS Utf8;
            
            UPDATE messages 
            SET is_read = true 
            WHERE chat_id = $chatId 
            AND sender_id != $userId;
        `;
        await session.executeQuery(query, {
            '$chatId': TypedValues.utf8(chatId),
            '$userId': TypedValues.utf8(userId)
        });
    });

    return { statusCode: 200, headers: responseHeaders, body: JSON.stringify({ success: true }) };
}

// ============= MISSING FUNCTIONS =============

function checkAuth(headers) {
    try {
        const authHeader = headers.Authorization || headers.authorization;
        if (!authHeader) return null;

        const token = authHeader.replace('Bearer ', '');
        const decoded = jwt.verify(token, JWT_SECRET);
        return decoded.uid;
    } catch (e) {
        console.error('[Auth] JWT verification failed:', e.message);
        return null;
    }
}

async function getUserIdByConnection(driver, connectionId) {
    let userId = null;
    await driver.tableClient.withSession(async (session) => {
        const query = `
            DECLARE $connectionId AS Utf8;
            SELECT user_id FROM socket_connections WHERE connection_id = $connectionId;
        `;
        const { resultSets } = await session.executeQuery(query, {
            '$connectionId': TypedValues.utf8(connectionId)
        });
        const rows = TypedData.createNativeObjects(resultSets[0]);
        if (rows.length > 0) {
            userId = rows[0].user_id;
        }
    });
    return userId;
}

async function getMatches(driver, requestHeaders, responseHeaders) {
    const userId = checkAuth(requestHeaders);
    if (!userId) return { statusCode: 401, headers: responseHeaders, body: JSON.stringify({ error: 'Unauthorized' }) };

    const tryParse = (val) => {
        if (!val) return [];
        if (Array.isArray(val)) return val;
        try { return JSON.parse(val); } catch (e) { return []; }
    };

    let matches = [];
    await driver.tableClient.withSession(async (session) => {
        // Find mutual likes (matches)
        const query = `
            DECLARE $userId AS Utf8;
            
            SELECT u.id, u.name, u.age, u.photos, u.about, u.gender, u.ethnicity
            FROM users AS u
            INNER JOIN likes AS l1 ON l1.to_user_id = u.id
            INNER JOIN likes AS l2 ON l2.from_user_id = u.id
            WHERE l1.from_user_id = $userId
            AND l2.to_user_id = $userId;
        `;

        const { resultSets } = await session.executeQuery(query, { '$userId': TypedValues.utf8(userId) });
        const users = TypedData.createNativeObjects(resultSets[0]);

        matches = users.map(u => ({
            id: u.id,
            name: u.name,
            age: u.age,
            photos: tryParse(u.photos),
            bio: u.about,
            gender: u.gender,
            ethnicity: u.ethnicity
        }));
    });

    return { statusCode: 200, headers: responseHeaders, body: JSON.stringify({ matches }) };
}

async function getLikesYou(driver, requestHeaders, responseHeaders) {
    const userId = checkAuth(requestHeaders);
    if (!userId) return { statusCode: 401, headers: responseHeaders, body: JSON.stringify({ error: 'Unauthorized' }) };

    const tryParse = (val) => {
        if (!val) return [];
        if (Array.isArray(val)) return val;
        try { return JSON.parse(val); } catch (e) { return []; }
    };

    let profiles = [];
    await driver.tableClient.withSession(async (session) => {
        // Get users who liked me, but I haven't liked back
        const query = `
            DECLARE $userId AS Utf8;
            
            SELECT u.id, u.name, u.age, u.photos, u.about, u.gender, u.ethnicity
            FROM users AS u
            INNER JOIN likes AS l ON l.from_user_id = u.id
            LEFT JOIN likes AS l2 ON l2.from_user_id = $userId AND l2.to_user_id = u.id
            WHERE l.to_user_id = $userId
            AND l2.from_user_id IS NULL;
        `;

        const { resultSets } = await session.executeQuery(query, { '$userId': TypedValues.utf8(userId) });
        const users = TypedData.createNativeObjects(resultSets[0]);

        profiles = users.map(u => ({
            id: u.id,
            name: u.name,
            age: u.age,
            photos: tryParse(u.photos),
            bio: u.about,
            gender: u.gender,
            ethnicity: u.ethnicity
        }));
    });

    return { statusCode: 200, headers: responseHeaders, body: JSON.stringify({ profiles }) };
}

async function getYourLikes(driver, requestHeaders, responseHeaders) {
    const userId = checkAuth(requestHeaders);
    if (!userId) return { statusCode: 401, headers: responseHeaders, body: JSON.stringify({ error: 'Unauthorized' }) };

    const tryParse = (val) => {
        if (!val) return [];
        if (Array.isArray(val)) return val;
        try { return JSON.parse(val); } catch (e) { return []; }
    };

    let profiles = [];
    await driver.tableClient.withSession(async (session) => {
        // Get users I liked, but they haven't liked me back
        const query = `
            DECLARE $userId AS Utf8;
            
            SELECT u.id, u.name, u.age, u.photos, u.about, u.gender, u.ethnicity
            FROM users AS u
            INNER JOIN likes AS l ON l.to_user_id = u.id
            LEFT JOIN likes AS l2 ON l2.from_user_id = u.id AND l2.to_user_id = $userId
            WHERE l.from_user_id = $userId
            AND l2.from_user_id IS NULL;
        `;

        const { resultSets } = await session.executeQuery(query, { '$userId': TypedValues.utf8(userId) });
        const users = TypedData.createNativeObjects(resultSets[0]);

        profiles = users.map(u => ({
            id: u.id,
            name: u.name,
            age: u.age,
            photos: tryParse(u.photos),
            bio: u.about,
            gender: u.gender,
            ethnicity: u.ethnicity
        }));
    });

    return { statusCode: 200, headers: responseHeaders, body: JSON.stringify({ profiles }) };
}

async function getChats(driver, requestHeaders, responseHeaders) {
    const userId = checkAuth(requestHeaders);
    if (!userId) return { statusCode: 401, headers: responseHeaders, body: JSON.stringify({ error: 'Unauthorized' }) };

    const tryParse = (val) => {
        if (!val) return [];
        if (Array.isArray(val)) return val;
        try { return JSON.parse(val); } catch (e) { return []; }
    };

    let chats = [];
    await driver.tableClient.withSession(async (session) => {
        // Get all matches (mutual likes) with last message info
        const query = `
            DECLARE $userId AS Utf8;
            
            SELECT 
                u.id AS match_id,
                u.name,
                u.photos,
                m.text AS last_message,
                m.timestamp AS last_message_time,
                m.sender_id AS last_sender_id
            FROM users AS u
            INNER JOIN likes AS l1 ON l1.to_user_id = u.id
            INNER JOIN likes AS l2 ON l2.from_user_id = u.id
            LEFT JOIN (
                SELECT chat_id, text, timestamp, sender_id
                FROM messages
                WHERE chat_id LIKE $userId || '_%' OR chat_id LIKE '%_' || $userId
                ORDER BY timestamp DESC
                LIMIT 1
            ) AS m ON (m.chat_id = $userId || '_' || u.id OR m.chat_id = u.id || '_' || $userId)
            WHERE l1.from_user_id = $userId
            AND l2.to_user_id = $userId
            ORDER BY m.timestamp DESC;
        `;

        const { resultSets } = await session.executeQuery(query, { '$userId': TypedValues.utf8(userId) });
        const rows = TypedData.createNativeObjects(resultSets[0]);

        chats = rows.map(row => {
            const chatId = [userId, row.match_id].sort().join('_');
            return {
                chatId,
                matchId: row.match_id,
                name: row.name,
                photo: tryParse(row.photos)[0] || null,
                lastMessage: row.last_message || '',
                lastMessageTime: row.last_message_time ? new Date(row.last_message_time).toISOString() : null,
                isOwnMessage: row.last_sender_id === userId
            };
        });
    });

    return { statusCode: 200, headers: responseHeaders, body: JSON.stringify({ chats }) };
}

async function getHistory(driver, requestHeaders, chatId, responseHeaders) {
    const userId = checkAuth(requestHeaders);
    if (!userId) return { statusCode: 401, headers: responseHeaders, body: JSON.stringify({ error: 'Unauthorized' }) };
    if (!chatId) return { statusCode: 400, headers: responseHeaders, body: JSON.stringify({ error: 'Missing chatId' }) };

    const tryParse = (val) => {
        if (!val) return [];
        if (Array.isArray(val)) return val;
        try { return JSON.parse(val); } catch (e) { return []; }
    };

    let messages = [];
    await driver.tableClient.withSession(async (session) => {
        const query = `
            DECLARE $chatId AS Utf8;
            SELECT id, sender_id, text, timestamp, is_read, type, reply_to_id, media
            FROM messages
            WHERE chat_id = $chatId
            ORDER BY timestamp ASC;
        `;

        const { resultSets } = await session.executeQuery(query, { '$chatId': TypedValues.utf8(chatId) });
        const rows = TypedData.createNativeObjects(resultSets[0]);

        messages = rows.map(row => ({
            id: row.id,
            senderId: row.sender_id,
            text: row.text,
            timestamp: new Date(row.timestamp).toISOString(),
            isRead: row.is_read,
            type: row.type || 'text',
            replyToId: row.reply_to_id || null,
            media: tryParse(row.media)
        }));
    });

    return { statusCode: 200, headers: responseHeaders, body: JSON.stringify({ messages }) };
}

async function handleLike(driver, requestHeaders, body, responseHeaders) {
    const userId = checkAuth(requestHeaders);
    if (!userId) return { statusCode: 401, headers: responseHeaders, body: JSON.stringify({ error: 'Unauthorized' }) };

    const { targetUserId } = body;
    if (!targetUserId) return { statusCode: 400, headers: responseHeaders, body: JSON.stringify({ error: 'Missing targetUserId' }) };

    let isMatch = false;
    await driver.tableClient.withSession(async (session) => {
        // Insert the like
        const insertQuery = `
            DECLARE $fromUserId AS Utf8;
            DECLARE $toUserId AS Utf8;
            DECLARE $timestamp AS Timestamp;
            
            UPSERT INTO likes (from_user_id, to_user_id, timestamp)
            VALUES ($fromUserId, $toUserId, $timestamp);
        `;

        await session.executeQuery(insertQuery, {
            '$fromUserId': TypedValues.utf8(userId),
            '$toUserId': TypedValues.utf8(targetUserId),
            '$timestamp': TypedValues.timestamp(new Date())
        });

        // Check if it's a match (mutual like)
        const checkQuery = `
            DECLARE $userId AS Utf8;
            DECLARE $targetUserId AS Utf8;
            
            SELECT COUNT(*) AS count
            FROM likes
            WHERE from_user_id = $targetUserId
            AND to_user_id = $userId;
        `;

        const { resultSets } = await session.executeQuery(checkQuery, {
            '$userId': TypedValues.utf8(userId),
            '$targetUserId': TypedValues.utf8(targetUserId)
        });

        if (resultSets[0] && resultSets[0].rows && resultSets[0].rows.length > 0) {
            const countVal = resultSets[0].rows[0].items[0].uint64Value || resultSets[0].rows[0].items[0].int64Value;
            isMatch = Number(countVal) > 0;
        }
    });

    // Send WebSocket notifications
    try {
        // Get the recipient's connection ID
        let recipientConnectionId = null;
        await driver.tableClient.withSession(async (session) => {
            const query = `
                DECLARE $userId AS Utf8;
                SELECT connection_id FROM socket_connections WHERE user_id = $userId;
            `;
            const { resultSets } = await session.executeQuery(query, {
                '$userId': TypedValues.utf8(targetUserId)
            });
            const rows = TypedData.createNativeObjects(resultSets[0]);
            if (rows.length > 0) {
                recipientConnectionId = rows[0].connection_id;
            }
        });

        if (recipientConnectionId) {
            if (isMatch) {
                // Send match notification to recipient
                await sendToConnection(recipientConnectionId, {
                    type: 'newMatch',
                    fromUserId: userId
                });

                // Also send match notification to the current user
                let senderConnectionId = null;
                await driver.tableClient.withSession(async (session) => {
                    const query = `
                        DECLARE $userId AS Utf8;
                        SELECT connection_id FROM socket_connections WHERE user_id = $userId;
                    `;
                    const { resultSets } = await session.executeQuery(query, {
                        '$userId': TypedValues.utf8(userId)
                    });
                    const rows = TypedData.createNativeObjects(resultSets[0]);
                    if (rows.length > 0) {
                        senderConnectionId = rows[0].connection_id;
                    }
                });

                if (senderConnectionId) {
                    await sendToConnection(senderConnectionId, {
                        type: 'newMatch',
                        fromUserId: targetUserId
                    });
                }
            } else {
                // Send like notification to recipient
                await sendToConnection(recipientConnectionId, {
                    type: 'newLike',
                    fromUserId: userId
                });
            }
        }
    } catch (e) {
        console.error('[handleLike] Error sending WebSocket notification:', e);
        // Don't fail the request if notification fails
    }

    return {
        statusCode: 200,
        headers: responseHeaders,
        body: JSON.stringify({ success: true, isMatch })
    };
}
