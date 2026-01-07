const { getDriver } = require('./db');
const jwt = require('jsonwebtoken');
const { TypedValues, TypedData } = require('ydb-sdk');
const { v4: uuidv4 } = require('uuid');
// Using native fetch (Node.js 18+)
const { notifyNewLike, notifyMatch, notifyNewMessage } = require('./telegram');
const { sendLikeNotification, sendMatchNotifications, sendMessageNotification } = require('./telegram-helpers');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-key-change-me';
const YC_API_KEY = process.env.YC_API_KEY; // Required for WebSocket message delivery

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
        } else if (path === '/dislike' && httpMethod === 'POST') {
            return await handleDislike(driver, headers, JSON.parse(body), responseHeaders);
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
            // First, delete any existing connections for this user
            const deleteQuery = `
                DECLARE $userId AS Utf8;
                DELETE FROM socket_connections WHERE user_id = $userId;
            `;
            await session.executeQuery(deleteQuery, {
                '$userId': TypedValues.utf8(userId)
            });

            // Then insert the new connection
            const query = `
                DECLARE $userId AS Utf8;
                DECLARE $connectionId AS Utf8;
                DECLARE $createdAt AS Timestamp;
                UPSERT INTO socket_connections (user_id, connection_id, created_at)
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

/**
 * Send message to WebSocket connection via Yandex API Gateway Management API
 * @param {object} driver - YDB Driver instance
 * @param {string} connectionId - WebSocket connection ID
 * @param {object} data - Data to send to the connection
 */
async function sendToConnection(driver, connectionId, data, event) {
    // Try to extract gateway ID from Host header, fallback to env var, then hardcoded
    let apiGatewayId = process.env.API_GATEWAY_ID;

    if (!apiGatewayId && event && event.headers && event.headers.Host) {
        const host = event.headers.Host;
        apiGatewayId = host.split('.')[0];
        console.log('[sendToConnection] Detected Gateway ID from Host:', apiGatewayId);
    }

    if (!apiGatewayId) apiGatewayId = 'd5dg37j92h7tg2f7sf87';

    const url = `https://apigateway-connections.api.cloud.yandex.net/apigateways/${apiGatewayId}/connections/${connectionId}`;

    console.log('[sendToConnection] Sending to connectionId:', connectionId);
    console.log('[sendToConnection] URL:', url);

    if (!YC_API_KEY) {
        console.error('[sendToConnection] YC_API_KEY not configured!');
        throw new Error('YC_API_KEY is required for WebSocket message delivery');
    }

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Api-Key ${YC_API_KEY}`
            },
            body: JSON.stringify(data)
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('[sendToConnection] Failed:', response.status, response.statusText, errorText);

            // If connection is gone (404 Not Found or 410 Gone), remove it from DB
            if (response.status === 404 || response.status === 410) {
                console.log(`[sendToConnection] Connection ${connectionId} is stale (Status ${response.status}). Removing from DB...`);
                try {
                    await driver.tableClient.withSession(async (session) => {
                        const query = `
                            DECLARE $connectionId AS Utf8;
                            DELETE FROM socket_connections WHERE connection_id = $connectionId;
                        `;
                        await session.executeQuery(query, {
                            '$connectionId': TypedValues.utf8(connectionId)
                        });
                    });
                    console.log(`[sendToConnection] Successfully removed stale connection ${connectionId}`);
                } catch (dbError) {
                    console.error('[sendToConnection] Failed to remove stale connection:', dbError);
                }
            }

            throw new Error(`Failed to send to connection: ${response.status} ${errorText}`);
        }

        console.log('[sendToConnection] Successfully sent to', connectionId);
    } catch (error) {
        console.error('[sendToConnection] Error:', error.message);
        throw error;
    }
}

// sendMessageNotification is now imported at the top
// Keeping this wrapper for compatibility if needed, or remove it and use the imported one directly
// But the imported one needs 'driver' as first arg, which matches.
// We can just use the imported one directly in handleMessage.

async function handleMessage(driver, event, connectionId) {
    console.log('[WS] handleMessage START. ConnectionId:', connectionId);
    let body;
    try {
        body = JSON.parse(event.body);
    } catch (e) {
        console.error('[WS] Failed to parse message body:', event.body);
        return { statusCode: 400 };
    }

    const { action, chatId, text, recipientId, replyToId, messageId } = body;

    if (action === 'sendMessage') {
        if (!text) {
            console.error('[WS] Message text is empty');
            return { statusCode: 400 };
        }

        console.log(`[WS] resolving userId for connection: ${connectionId}`);
        const userId = await getUserIdByConnection(driver, connectionId);
        if (!userId) {
            console.error('[WS] Sender userId not found for connectionId:', connectionId);
            // DEBUG: Check what IS in the DB for this connection
            await debugConnection(driver, connectionId);
            return { statusCode: 403 };
        }
        console.log(`[WS] Sender verified: ${userId}. Sending to ${recipientId}`);

        // FORCE SAFE CHAT ID: Ensure we always use the canonical ID format
        const safeChatId = [userId, recipientId].sort().join('_');
        console.log(`[WS] Computed safeChatId: ${safeChatId} (Input was: ${chatId})`);

        const newMessageId = uuidv4();
        const timestamp = new Date();

        // 1. Save to database using safeChatId
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
                    DECLARE $isEdited AS Bool;
                    DECLARE $editedAt AS Timestamp;

                    INSERT INTO messages (id, chat_id, sender_id, text, timestamp, is_read, type, reply_to_id, is_edited, edited_at)
                    VALUES ($id, $chatId, $senderId, $text, $timestamp, $isRead, $type, $replyToId, $isEdited, $editedAt);

                    UPDATE chats SET last_message = $text, last_message_time = $timestamp
                    WHERE id = $chatId;
                `;
                await session.executeQuery(query, {
                    '$id': TypedValues.utf8(newMessageId),
                    '$chatId': TypedValues.utf8(safeChatId), // Use safeChatId
                    '$senderId': TypedValues.utf8(userId),
                    '$text': TypedValues.utf8(text),
                    '$timestamp': TypedValues.timestamp(timestamp),
                    '$isRead': TypedValues.bool(false),
                    '$type': TypedValues.utf8('text'),
                    '$replyToId': TypedValues.utf8(replyToId || ''),
                    '$isEdited': TypedValues.bool(false),
                    '$editedAt': TypedValues.timestamp(null)
                });
            });
            console.log('[WS] Message saved to YDB:', newMessageId);
        } catch (dbError) {
            console.error('[WS] Database save error:', dbError);
            console.error('[WS] DB Error Details:', JSON.stringify(dbError, null, 2));
            return { statusCode: 500 };
        }

        // 2. Broadcast to sender and recipient if online
        const messageEvent = {
            type: 'newMessage',
            message: {
                id: newMessageId,
                chatId: safeChatId, // Use safeChatId
                text,
                senderId: userId,
                timestamp,
                type: 'text',
                replyToId: replyToId || null,
                editedAt: undefined
            }
        };

        // Notify recipient
        console.log(`[WS] Looking up connection for recipient ${recipientId}`);
        const recipientConnectionId = await getConnectionIdByUserId(driver, recipientId);
        console.log(`[WS] Recipient ${recipientId} connectionId:`, recipientConnectionId || 'OFFLINE');

        if (recipientConnectionId) {
            try {
                await sendToConnection(driver, recipientConnectionId, messageEvent, event);
            } catch (err) {
                console.error('[WS] Failed to send to recipient:', err);
                // Continue to send Telegram notification as fallback
                await sendMessageNotification(driver, userId, recipientId, text);
            }
        } else {
            // User is OFFLINE: Send Telegram Notification
            console.log('[WS] Recipient offline, sending Telegram notification');
            await sendMessageNotification(driver, userId, recipientId, text);
        }

        // Notify sender (echo) - ALWAYS send this
        try {
            await sendToConnection(driver, connectionId, messageEvent, event);
        } catch (err) {
            console.error('[WS] Failed to send echo to sender:', err);
        }

        return { statusCode: 200 };
    } else if (action === 'editMessage') {
        const { messageId, text, recipientId } = body;
        return await handleEditMessage(driver, connectionId, chatId, messageId, text, recipientId);
    } else if (action === 'deleteMessage') {
        const { messageIds, recipientId } = body;
        return await handleDeleteMessage(driver, connectionId, chatId, messageIds, recipientId);
    }
    return { statusCode: 200 };
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

async function getConnectionIdByUserId(driver, userId) {
    let connectionId = null;
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
            connectionId = rows[0].connection_id;
        }
    });
    return connectionId;
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
        // Step 1: Find all users who liked current user
        const likesQuery = `
            DECLARE $userId AS Utf8;
            SELECT from_user_id FROM likes WHERE to_user_id = $userId;
        `;
        const { resultSets: likesResults } = await session.executeQuery(likesQuery, {
            '$userId': TypedValues.utf8(userId)
        });
        const likedByUsers = likesResults[0] ? TypedData.createNativeObjects(likesResults[0]).map(r => r.from_user_id) : [];

        if (likedByUsers.length === 0) {
            return; // No one liked the user
        }

        // Step 2: Find mutual likes (users current user also liked)
        const mutualQuery = `
            DECLARE $userId AS Utf8;
            SELECT to_user_id FROM likes WHERE from_user_id = $userId;
        `;
        const { resultSets: mutualResults } = await session.executeQuery(mutualQuery, {
            '$userId': TypedValues.utf8(userId)
        });
        const userLiked = mutualResults[0] ? TypedData.createNativeObjects(mutualResults[0]).map(r => r.to_user_id) : [];

        // Find intersection (mutual likes)
        const matchIds = likedByUsers.filter(id => userLiked.includes(id));

        if (matchIds.length === 0) {
            return; // No matches
        }

        // Step 3: Get user data for each match
        for (const matchId of matchIds) {
            const userQuery = `
                DECLARE $matchId AS Utf8;
                SELECT id, name, age, photos, about, gender, ethnicity, macro_groups
                FROM users
                WHERE id = $matchId;
            `;
            const { resultSets: userResults } = await session.executeQuery(userQuery, {
                '$matchId': TypedValues.utf8(matchId)
            });
            const users = userResults[0] ? TypedData.createNativeObjects(userResults[0]) : [];
            if (users.length === 0) continue;

            const u = users[0];
            matches.push({
                id: u.id,
                chatId: [userId, matchId].sort().join('_'),
                name: u.name,
                age: u.age,
                photos: tryParse(u.photos),
                bio: u.about,
                gender: u.gender,
                ethnicity: u.ethnicity,
                macroGroups: tryParse(u.macro_groups)
            });
        }
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
        // Step 1: Find users who liked me
        const likedByQuery = `
            DECLARE $userId AS Utf8;
            SELECT from_user_id FROM likes WHERE to_user_id = $userId;
        `;
        const { resultSets: likedByResults } = await session.executeQuery(likedByQuery, {
            '$userId': TypedValues.utf8(userId)
        });
        const likedByMeIds = likedByResults[0] ? TypedData.createNativeObjects(likedByResults[0]).map(r => r.from_user_id) : [];

        if (likedByMeIds.length === 0) return;

        // Step 2: Find users I already liked (to exclude them - because those are matches)
        const myLikesQuery = `
            DECLARE $userId AS Utf8;
            SELECT to_user_id FROM likes WHERE from_user_id = $userId;
        `;
        const { resultSets: myLikesResults } = await session.executeQuery(myLikesQuery, {
            '$userId': TypedValues.utf8(userId)
        });
        const myLikesIds = myLikesResults[0] ? TypedData.createNativeObjects(myLikesResults[0]).map(r => r.to_user_id) : [];

        // Filter: Users who liked me AND I haven't liked them back
        const targetIds = likedByMeIds.filter(id => !myLikesIds.includes(id));

        if (targetIds.length === 0) return;

        // Step 3: Fetch user details
        for (const targetId of targetIds) {
            const userQuery = `
                DECLARE $id AS Utf8;
                SELECT id, name, age, photos, about, gender, ethnicity, macro_groups FROM users WHERE id = $id;
            `;
            const { resultSets: userResults } = await session.executeQuery(userQuery, {
                '$id': TypedValues.utf8(targetId)
            });
            const users = userResults[0] ? TypedData.createNativeObjects(userResults[0]) : [];

            if (users.length > 0) {
                const u = users[0];
                profiles.push({
                    id: u.id,
                    name: u.name,
                    age: u.age,
                    photos: tryParse(u.photos),
                    bio: u.about,
                    gender: u.gender,
                    ethnicity: u.ethnicity,
                    macroGroups: tryParse(u.macro_groups)
                });
            }
        }
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
        // Step 1: Find users I liked
        const myLikesQuery = `
            DECLARE $userId AS Utf8;
            SELECT to_user_id FROM likes WHERE from_user_id = $userId;
        `;
        const { resultSets: myLikesResults } = await session.executeQuery(myLikesQuery, {
            '$userId': TypedValues.utf8(userId)
        });
        const myLikesIds = myLikesResults[0] ? TypedData.createNativeObjects(myLikesResults[0]).map(r => r.to_user_id) : [];

        if (myLikesIds.length === 0) return;

        // Step 2: Find users who liked me (to exclude matches)
        const likedByQuery = `
            DECLARE $userId AS Utf8;
            SELECT from_user_id FROM likes WHERE to_user_id = $userId;
        `;
        const { resultSets: likedByResults } = await session.executeQuery(likedByQuery, {
            '$userId': TypedValues.utf8(userId)
        });
        const likedByMeIds = likedByResults[0] ? TypedData.createNativeObjects(likedByResults[0]).map(r => r.from_user_id) : [];

        // Filter: Users I liked AND who haven't liked me back
        const targetIds = myLikesIds.filter(id => !likedByMeIds.includes(id));

        if (targetIds.length === 0) return;

        // Step 3: Fetch user details
        for (const targetId of targetIds) {
            const userQuery = `
                DECLARE $id AS Utf8;
                SELECT id, name, age, photos, about, gender, ethnicity, macro_groups FROM users WHERE id = $id;
            `;
            const { resultSets: userResults } = await session.executeQuery(userQuery, {
                '$id': TypedValues.utf8(targetId)
            });
            const users = userResults[0] ? TypedData.createNativeObjects(userResults[0]) : [];

            if (users.length > 0) {
                const u = users[0];
                profiles.push({
                    id: u.id,
                    name: u.name,
                    age: u.age,
                    photos: tryParse(u.photos),
                    bio: u.about,
                    gender: u.gender,
                    ethnicity: u.ethnicity,
                    macroGroups: tryParse(u.macro_groups)
                });
            }
        }
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
        // Step 1: Find all users who liked current user
        const likesQuery = `
            DECLARE $userId AS Utf8;
            SELECT from_user_id FROM likes WHERE to_user_id = $userId;
        `;
        const { resultSets: likesResults } = await session.executeQuery(likesQuery, {
            '$userId': TypedValues.utf8(userId)
        });
        const likedByUsers = likesResults[0] ? TypedData.createNativeObjects(likesResults[0]).map(r => r.from_user_id) : [];

        if (likedByUsers.length === 0) {
            return; // No one liked the user
        }

        // Step 2: Find mutual likes (users current user also liked)
        const mutualQuery = `
            DECLARE $userId AS Utf8;
            SELECT to_user_id FROM likes WHERE from_user_id = $userId;
        `;
        const { resultSets: mutualResults } = await session.executeQuery(mutualQuery, {
            '$userId': TypedValues.utf8(userId)
        });
        const userLiked = mutualResults[0] ? TypedData.createNativeObjects(mutualResults[0]).map(r => r.to_user_id) : [];

        // Find intersection (mutual likes)
        const matchIds = likedByUsers.filter(id => userLiked.includes(id));

        if (matchIds.length === 0) {
            return; // No matches
        }

        // Step 3: Get user data for each match
        for (const matchId of matchIds) {
            const userQuery = `
                DECLARE $matchId AS Utf8;
                SELECT id, name, age, photos, ethnicity, macro_groups FROM users WHERE id = $matchId;
            `;
            const { resultSets: userResults } = await session.executeQuery(userQuery, {
                '$matchId': TypedValues.utf8(matchId)
            });
            const users = userResults[0] ? TypedData.createNativeObjects(userResults[0]) : [];
            if (users.length === 0) continue;

            const match = users[0];
            const chatId = [userId, matchId].sort().join('_');

            // Step 4: Get last message for this chat
            const msgQuery = `
                DECLARE $chatId AS Utf8;
                SELECT text, timestamp, sender_id
                FROM messages
                WHERE chat_id = $chatId
                ORDER BY timestamp DESC
                LIMIT 1;
            `;
            const { resultSets: msgResults } = await session.executeQuery(msgQuery, {
                '$chatId': TypedValues.utf8(chatId)
            });
            const msgRows = msgResults[0] ? TypedData.createNativeObjects(msgResults[0]) : [];
            const lastMsg = msgRows[0] || null;

            chats.push({
                id: chatId,
                matchId: match.id,
                name: match.name,
                age: match.age,
                ethnicity: match.ethnicity,
                macroGroups: tryParse(match.macro_groups),
                photo: tryParse(match.photos)[0] || null,
                lastMessage: lastMsg ? lastMsg.text : '',
                lastMessageTime: lastMsg ? new Date(lastMsg.timestamp).toISOString() : null,
                isOwnMessage: lastMsg ? lastMsg.sender_id === userId : false
            });
        }

        // Sort by last message time
        chats.sort((a, b) => {
            if (!a.lastMessageTime) return 1;
            if (!b.lastMessageTime) return -1;
            return new Date(b.lastMessageTime) - new Date(a.lastMessageTime);
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
            SELECT id, sender_id, text, timestamp, is_read, type, reply_to_id, is_edited, edited_at
            FROM messages
            WHERE chat_id = $chatId
            ORDER BY timestamp ASC;
        `;

        const { resultSets } = await session.executeQuery(query, { '$chatId': TypedValues.utf8(chatId) });
        const rows = resultSets[0] ? TypedData.createNativeObjects(resultSets[0]) : [];

        messages = rows.map(row => ({
            id: row.id,
            senderId: row.sender_id,
            text: row.text,
            timestamp: new Date(row.timestamp).toISOString(),
            isRead: row.is_read,
            type: row.type || 'text',
            replyToId: row.reply_to_id || null, // Now exists!
            isEdited: row.is_edited || false,   // Now exists!
            editedAt: row.edited_at ? new Date(row.edited_at).toISOString() : null // Now exists!
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
    let recipientConnectionId = null;
    let senderConnectionId = null;

    // OPTIMIZED: All database operations in ONE session
    await driver.tableClient.withSession(async (session) => {
        // Step 1: Insert the like
        const insertQuery = `
            DECLARE $fromUserId AS Utf8;
            DECLARE $toUserId AS Utf8;
            DECLARE $createdAt AS Timestamp;
            
            UPSERT INTO likes (from_user_id, to_user_id, created_at)
            VALUES ($fromUserId, $toUserId, $createdAt);
        `;

        await session.executeQuery(insertQuery, {
            '$fromUserId': TypedValues.utf8(userId),
            '$toUserId': TypedValues.utf8(targetUserId),
            '$createdAt': TypedValues.timestamp(new Date())
        });

        // Step 2: Check if it's a match (mutual like)
        const checkQuery = `
            DECLARE $userId AS Utf8;
            DECLARE $targetUserId AS Utf8;
            
            SELECT COUNT(*) AS count
            FROM likes
            WHERE from_user_id = $targetUserId
            AND to_user_id = $userId;
        `;

        const { resultSets: matchResults } = await session.executeQuery(checkQuery, {
            '$userId': TypedValues.utf8(userId),
            '$targetUserId': TypedValues.utf8(targetUserId)
        });

        if (matchResults[0] && matchResults[0].rows && matchResults[0].rows.length > 0) {
            const countVal = matchResults[0].rows[0].items[0].uint64Value || matchResults[0].rows[0].items[0].int64Value;
            isMatch = Number(countVal) > 0;
        }

        // Step 3: Get connection IDs for both users (in same session)
        const connectionsQuery = `
            DECLARE $userId AS Utf8;
            DECLARE $targetUserId AS Utf8;
            
            SELECT user_id, connection_id FROM socket_connections 
            WHERE user_id = $userId OR user_id = $targetUserId;
        `;

        const { resultSets: connResults } = await session.executeQuery(connectionsQuery, {
            '$userId': TypedValues.utf8(userId),
            '$targetUserId': TypedValues.utf8(targetUserId)
        });

        const connections = TypedData.createNativeObjects(connResults[0]);
        for (const conn of connections) {
            if (conn.user_id === targetUserId) {
                recipientConnectionId = conn.connection_id;
            } else if (conn.user_id === userId) {
                senderConnectionId = conn.connection_id;
            }
        }
    });



    // Send WebSocket notifications (outside session)
    let chatId = null;
    if (isMatch) {
        chatId = [userId, targetUserId].sort().join('_');
    }

    try {
        if (recipientConnectionId) {
            if (isMatch) {
                // Send match notification to recipient
                await sendToConnection(recipientConnectionId, {
                    type: 'newMatch',
                    fromUserId: userId,
                    chatId: chatId
                });

                // Also send match notification to the current user
                if (senderConnectionId) {
                    await sendToConnection(senderConnectionId, {
                        type: 'newMatch',
                        fromUserId: targetUserId,
                        chatId: chatId
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

    // Send Telegram notifications if user is offline or just as a backup? 
    // Usually we want real-time if online, push if offline.
    // The previous logic for messages was: if (!recipientConnectionId) sendTelegram.
    // We should follow the same pattern here.

    if (!recipientConnectionId) {
        try {
            console.log('[handleLike] Recipient offline, sending Telegram notification');
            const { sendLikeNotification, sendMatchNotifications } = require('./telegram-helpers');

            if (isMatch) {
                // For matches, we notify BOTH if possible, but sendMatchNotifications handles that.
                await sendMatchNotifications(driver, userId, targetUserId);
            } else {
                // Just a like
                await sendLikeNotification(driver, targetUserId);
            }
        } catch (e) {
            console.error('[handleLike] Error sending Telegram notification:', e);
        }
    }

    return {
        statusCode: 200,
        headers: responseHeaders,
        body: JSON.stringify({ success: true, isMatch, chatId })
    };
}

async function handleDislike(driver, requestHeaders, body, responseHeaders) {
    const userId = checkAuth(requestHeaders);
    if (!userId) return { statusCode: 401, headers: responseHeaders, body: JSON.stringify({ error: 'Unauthorized' }) };

    const { targetUserId } = body;
    if (!targetUserId) return { statusCode: 400, headers: responseHeaders, body: JSON.stringify({ error: 'Missing targetUserId' }) };

    await driver.tableClient.withSession(async (session) => {
        const deleteQuery = `
            DECLARE $fromUserId AS Utf8;
            DECLARE $toUserId AS Utf8;
            
            DELETE FROM likes 
            WHERE from_user_id = $fromUserId 
            AND to_user_id = $toUserId;
        `;

        await session.executeQuery(deleteQuery, {
            '$fromUserId': TypedValues.utf8(userId),
            '$toUserId': TypedValues.utf8(targetUserId)
        });
    });

    return {
        statusCode: 200,
        headers: responseHeaders,
        body: JSON.stringify({ success: true })
    };
}

async function handleEditMessage(driver, connectionId, chatId, messageId, text, recipientId) {
    const userId = await getUserIdByConnection(driver, connectionId);
    if (!userId) return { statusCode: 403 };

    await driver.tableClient.withSession(async (session) => {
        const query = `
            DECLARE $messageId AS Utf8;
            DECLARE $userId AS Utf8;
            DECLARE $text AS Utf8;
            DECLARE $editedAt AS Timestamp;

            UPDATE messages
            SET text = $text, is_edited = true, edited_at = $editedAt
            WHERE id = $messageId AND sender_id = $userId;
        `;
        await session.executeQuery(query, {
            '$messageId': TypedValues.utf8(messageId),
            '$userId': TypedValues.utf8(userId),
            '$text': TypedValues.utf8(text),
            '$editedAt': TypedValues.timestamp(new Date())
        });
    });

    const editEvent = {
        type: 'messageEdited',
        message: {
            id: messageId,
            chatId,
            text,
            isEdited: true,
            editedAt: new Date()
        }
    };

    const recipientConnectionId = await getConnectionIdByUserId(driver, recipientId);
    if (recipientConnectionId) {
        await sendToConnection(recipientConnectionId, editEvent);
    }
    await sendToConnection(connectionId, editEvent);

    return { statusCode: 200 };
}

async function handleDeleteMessage(driver, connectionId, chatId, messageIds, recipientId) {
    const userId = await getUserIdByConnection(driver, connectionId);
    if (!userId) return { statusCode: 403 };

    await driver.tableClient.withSession(async (session) => {
        for (const msgId of messageIds) {
            const query = `
                DECLARE $messageId AS Utf8;
                DECLARE $userId AS Utf8;
                DELETE FROM messages WHERE id = $messageId AND sender_id = $userId;
             `;
            await session.executeQuery(query, {
                '$messageId': TypedValues.utf8(msgId),
                '$userId': TypedValues.utf8(userId)
            });
        }
    });

    const deleteEvent = {
        type: 'messageDeleted',
        chatId,
        messageIds
    };

    const recipientConnectionId = await getConnectionIdByUserId(driver, recipientId);
    if (recipientConnectionId) {
        await sendToConnection(recipientConnectionId, deleteEvent);
    }
    await sendToConnection(connectionId, deleteEvent);

    return { statusCode: 200 };
}



async function debugConnection(driver, connectionId) {
    try {
        await driver.tableClient.withSession(async (session) => {
            const query = `SELECT * FROM socket_connections WHERE connection_id = '${connectionId}';`;
            const { resultSets } = await session.executeQuery(query);
            const rows = TypedData.createNativeObjects(resultSets[0]);
            console.log('[DEBUG] Connection DB Record:', rows);
        });
    } catch (e) { console.error('[DEBUG] Failed to debug connection', e); }
}
