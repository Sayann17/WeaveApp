const { getDriver } = require('./db');
const jwt = require('jsonwebtoken');
const { TypedValues, TypedData } = require('ydb-sdk');
const { v4: uuidv4 } = require('uuid');
const { notifyNewMessage } = require('./telegram');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-key-change-me';

// Service Account Key from separate environment variables
const SERVICE_ACCOUNT_KEY = {
    id: process.env.SA_ID,
    service_account_id: process.env.SA_SERVICE_ACCOUNT_ID,
    private_key: process.env.SA_PRIVATE_KEY
};

// IAM token cache
let cachedIAMToken = null;
let tokenExpiry = null;

async function getIAMToken() {
    if (cachedIAMToken && tokenExpiry && Date.now() < tokenExpiry) {
        return cachedIAMToken;
    }

    try {
        console.log('[IAM] Refreshing token...');
        const now = Math.floor(Date.now() / 1000);
        const privateKey = SERVICE_ACCOUNT_KEY.private_key.replace(/\\n/g, '\n');

        const payload = {
            aud: 'https://iam.api.cloud.yandex.net/iam/v1/tokens',
            iss: SERVICE_ACCOUNT_KEY.service_account_id,
            iat: now,
            exp: now + 3600
        };

        const jwtToken = jwt.sign(payload, privateKey, {
            algorithm: 'PS256',
            keyid: SERVICE_ACCOUNT_KEY.id
        });

        const response = await fetch('https://iam.api.cloud.yandex.net/iam/v1/tokens', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ jwt: jwtToken })
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`IAM API error: ${error}`);
        }

        const data = await response.json();
        cachedIAMToken = data.iamToken;
        tokenExpiry = Date.now() + (11 * 60 * 60 * 1000); // 11 hours

        console.log('[IAM] Token refreshed successfully');
        return cachedIAMToken;
    } catch (error) {
        console.error('[IAM] Failed to refresh token:', error);
        throw new Error('Failed to get IAM token');
    }
}

module.exports.handler = async function (event, context) {
    const { httpMethod, path, body, headers, requestContext, queryStringParameters } = event;

    console.log('[test-chat] Request:', { path, method: httpMethod, type: requestContext?.eventType });

    // CORS Headers - Whitelist for Telegram Mini Apps
    const allowedOrigins = [
        'https://web.telegram.org',
        'https://webk.telegram.org',
        'https://webz.telegram.org'
    ];
    const requestOrigin = headers.Origin || headers.origin || '';
    const corsOrigin = allowedOrigins.includes(requestOrigin) ? requestOrigin : (requestOrigin === '' ? '*' : '');

    const responseHeaders = {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': corsOrigin || 'https://web.telegram.org',
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

        if (path === '/chats' && httpMethod === 'GET') {
            return await getChats(driver, headers, responseHeaders);
        } else if (path === '/history' && httpMethod === 'GET') {
            const chatId = queryStringParameters?.chatId;
            return await getHistory(driver, headers, chatId, responseHeaders);
        } else if (path === '/messages/new' && httpMethod === 'GET') {
            const chatId = queryStringParameters?.chatId;
            const after = queryStringParameters?.after;
            return await getNewMessages(driver, headers, chatId, after, responseHeaders);
        } else if ((path === '/mark-read' || path === '/mark-read/') && httpMethod === 'POST') {
            return await markAsRead(driver, headers, JSON.parse(body), responseHeaders);
        } else if ((path === '/notifications/messages' || path === '/notifications/messages/') && httpMethod === 'GET') {
            return await getUnreadMessages(driver, headers, responseHeaders);
        } else if ((path === '/user-status' || path === '/user-status/') && httpMethod === 'GET') {
            const targetUserId = queryStringParameters?.userId;
            return await getUserStatus(driver, headers, targetUserId, responseHeaders);
        }

        return {
            statusCode: 404,
            headers: responseHeaders,
            body: JSON.stringify({ error: 'Not found' })
        };
    } catch (e) {
        console.error('[test-chat] Error:', e);
        return {
            statusCode: 500,
            headers: responseHeaders,
            body: JSON.stringify({ error: e.message })
        };
    }
};

// ========== WebSocket Handlers ==========

async function handleConnect(driver, event, connectionId) {
    console.log('[WS] Connect:', connectionId);

    const token = event.queryStringParameters?.token;
    if (!token) {
        console.log('[WS] No token');
        return { statusCode: 403 };
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        const userId = decoded.uid;

        await driver.tableClient.withSession(async (session) => {
            // Insert new connection (allow multiple connections per user)
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

            // Update last_seen when user connects
            const updateLastSeen = `
                DECLARE $userId AS Utf8;
                DECLARE $lastSeen AS Timestamp;
                UPDATE users SET last_seen = $lastSeen WHERE id = $userId;
            `;
            await session.executeQuery(updateLastSeen, {
                '$userId': TypedValues.utf8(userId),
                '$lastSeen': TypedValues.timestamp(new Date())
            });
        });
        console.log('[WS] Connected user:', userId, 'connection:', connectionId);
        return { statusCode: 200 };
    } catch (e) {
        console.error('[WS] Connect error:', e);
        return { statusCode: 403 };
    }
}

async function handleDisconnect(driver, connectionId) {
    console.log('[WS] Disconnect:', connectionId);

    try {
        // Get userId before deleting connection (for last_seen update)
        const userId = await getUserIdByConnection(driver, connectionId);

        // Delete this specific connection
        await driver.tableClient.withSession(async (session) => {
            const query = `
                DECLARE $connectionId AS Utf8;
                DELETE FROM socket_connections WHERE connection_id = $connectionId;
            `;
            await session.executeQuery(query, {
                '$connectionId': TypedValues.utf8(connectionId)
            });

            // Update last_seen when user disconnects
            if (userId) {
                const updateLastSeen = `
                    DECLARE $userId AS Utf8;
                    DECLARE $lastSeen AS Timestamp;
                    UPDATE users SET last_seen = $lastSeen WHERE id = $userId;
                `;
                await session.executeQuery(updateLastSeen, {
                    '$userId': TypedValues.utf8(userId),
                    '$lastSeen': TypedValues.timestamp(new Date())
                });
                console.log('[WS] Updated last_seen for user:', userId);
            }
        });
        console.log('[WS] Connection removed from database');

        // Also cleanup stale connections (older than 1 hour)
        await cleanupStaleConnections(driver);
    } catch (error) {
        console.error('[WS] Error during disconnect cleanup:', error);
    }

    return { statusCode: 200 };
}

async function cleanupStaleConnections(driver) {
    try {
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

        await driver.tableClient.withSession(async (session) => {
            const query = `
                DECLARE $cutoffTime AS Timestamp;
                DELETE FROM socket_connections WHERE created_at < $cutoffTime;
            `;
            await session.executeQuery(query, {
                '$cutoffTime': TypedValues.timestamp(oneHourAgo)
            });
        });

        console.log('[Cleanup] Removed stale connections older than 1 hour');
    } catch (error) {
        console.error('[Cleanup] Error removing stale connections:', error);
    }
}

async function handleMessage(driver, event, connectionId) {
    console.log('[WS] handleMessage:', connectionId);
    let body;
    try {
        body = JSON.parse(event.body);
    } catch (e) {
        console.error('[WS] Failed to parse body');
        return { statusCode: 400 };
    }

    const { action, chatId, text, recipientId, replyToId, messageId } = body;
    console.log('[WS] Message action:', action);

    if (action === 'sendMessage') {
        if (!text) return { statusCode: 400 };

        const userId = await getUserIdByConnection(driver, connectionId);
        if (!userId) {
            console.error('[WS] No userId for connection:', connectionId);
            return { statusCode: 403 };
        }

        const safeChatId = [userId, recipientId].sort().join('_');
        const newMessageId = uuidv4();
        const timestamp = new Date();

        // Save to database
        try {
            await driver.tableClient.withSession(async (session) => {
                const [user1, user2] = [userId, recipientId].sort();

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
                    DECLARE $user1 AS Utf8;
                    DECLARE $user2 AS Utf8;

                    INSERT INTO messages (id, chat_id, sender_id, text, timestamp, is_read, type, reply_to_id, is_edited, edited_at)
                    VALUES ($id, $chatId, $senderId, $text, $timestamp, $isRead, $type, $replyToId, $isEdited, $editedAt);

                    UPSERT INTO chats (id, user1_id, user2_id, last_message, last_message_time, is_match_chat)
                    VALUES ($chatId, $user1, $user2, $text, $timestamp, true);
                `;
                await session.executeQuery(query, {
                    '$id': TypedValues.utf8(newMessageId),
                    '$chatId': TypedValues.utf8(safeChatId),
                    '$senderId': TypedValues.utf8(userId),
                    '$text': TypedValues.utf8(text),
                    '$timestamp': TypedValues.timestamp(timestamp),
                    '$isRead': TypedValues.bool(false),
                    '$type': TypedValues.utf8('text'),
                    '$replyToId': TypedValues.utf8(replyToId || ''),
                    '$isEdited': TypedValues.bool(false),
                    '$editedAt': TypedValues.timestamp(null),
                    '$user1': TypedValues.utf8(user1),
                    '$user2': TypedValues.utf8(user2)
                });
            });
            console.log('[WS] Message saved:', newMessageId);
        } catch (dbError) {
            console.error('[WS] DB error:', dbError);
            return { statusCode: 500 };
        }

        // Broadcast message
        // Note: Don't include 'type' at root level - Yandex WebSocket API rejects it
        const messageEvent = {
            type: 'newMessage',
            message: {
                id: newMessageId,
                chatId: safeChatId,
                text,
                senderId: userId,
                timestamp,
                type: 'text',
                replyToId: replyToId || null,
                editedAt: undefined
            }
        };

        // Send to recipient
        const recipientConnectionId = await getConnectionIdByUserId(driver, recipientId);
        let wsSent = false;

        if (recipientConnectionId) {
            try {
                wsSent = await sendToConnection(driver, recipientConnectionId, messageEvent, event);
            } catch (err) {
                console.error('[WS] Failed to send to recipient:', err);
            }
        }

        // Broad fallback: if not sent via WS (offline or failed), send Telegram notification
        if (!wsSent) {
            console.log(`[WS] Recipient ${recipientId} offline or failed. Sending Telegram notification.`);
            try {
                // Get sender name for the notification
                const senderName = await getUserName(driver, userId);
                await notifyNewMessage(driver, recipientId, senderName, text);
            } catch (notifyErr) {
                console.error('[WS] Failed to send notification:', notifyErr);
            }
        }

        // Echo to sender
        try {
            await sendToConnection(driver, connectionId, messageEvent, event);
        } catch (err) {
            console.error('[WS] Failed to echo:', err);
        }

        return { statusCode: 200 };
    } else if (action === 'editMessage') {
        return await handleEditMessage(driver, connectionId, chatId, messageId, text, recipientId, event);
    } else if (action === 'deleteMessage') {
        const { messageIds } = body;
        return await handleDeleteMessage(driver, connectionId, chatId, messageIds, recipientId, event);
    } else if (action === 'typing') {
        // Handle typing indicator
        const userId = await getUserIdByConnection(driver, connectionId);
        if (!userId) return { statusCode: 403 };

        // Forward typing event to recipient
        const recipientConnectionId = await getConnectionIdByUserId(driver, recipientId);
        if (recipientConnectionId) {
            await sendToConnection(driver, recipientConnectionId, {
                type: 'typing',
                userId: userId,
                chatId: chatId
            }, event);
        }
        return { statusCode: 200 };
    }
    return { statusCode: 200 };
}


async function sendToConnection(driver, connectionId, data, event) {
    // Correct URL from Yandex Support: 
    //POST https://apigateway-connections.api.cloud.yandex.net/apigateways/websocket/v1/connections/{connectionId}:send
    const url = `https://apigateway-connections.api.cloud.yandex.net/apigateways/websocket/v1/connections/${connectionId}:send`;

    try {
        // Use automated IAM token
        const iamToken = await getIAMToken();

        // Yandex API expects base64-encoded data for TYPE_BYTES
        const messageString = JSON.stringify(data);
        const base64Data = Buffer.from(messageString, 'utf-8').toString('base64');

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${iamToken}`
            },
            body: JSON.stringify({
                data: base64Data
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.log(`[sendToConnection] Failed to send to ${connectionId}:`);
            console.log(`  Status: ${response.status} ${response.statusText}`);
            console.log(`  Error: ${errorText}`);
            return false;
        }

        console.log('[sendToConnection] Success:', connectionId);
        return true;
    } catch (error) {
        console.error('[sendToConnection] Error:', error.message);
        return false;
    }
}

// ========== REST API Handlers ==========

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
        // Read from chats table where user is participant
        const chatsQuery = `
            DECLARE $userId AS Utf8;
            SELECT id, user1_id, user2_id, last_message, last_message_time, created_at
            FROM chats
            WHERE user1_id = $userId OR user2_id = $userId;
        `;

        const { resultSets } = await session.executeQuery(chatsQuery, {
            '$userId': TypedValues.utf8(userId)
        });
        const chatRecords = resultSets[0] ? TypedData.createNativeObjects(resultSets[0]) : [];

        console.log(`[getChats] Found ${chatRecords.length} chats for user ${userId}`);

        // For each chat, get other participant's data
        for (const chat of chatRecords) {
            const otherUserId = chat.user1_id === userId ? chat.user2_id : chat.user1_id;

            const userQuery = `
                DECLARE $userId AS Utf8;
                SELECT id, name, age, photos, ethnicity, macro_groups FROM users WHERE id = $userId;
            `;
            const { resultSets: userResults } = await session.executeQuery(userQuery, {
                '$userId': TypedValues.utf8(otherUserId)
            });
            const users = userResults[0] ? TypedData.createNativeObjects(userResults[0]) : [];
            if (users.length === 0) {
                console.log(`[getChats] User ${otherUserId} not found, skipping chat ${chat.id}`);
                continue;
            }

            const user = users[0];

            // Determine if last message was sent by current user
            let isOwnMessage = false;
            if (chat.last_message) {
                // Get the sender of last message
                const lastMsgQuery = `
                    DECLARE $chatId AS Utf8;
                    SELECT sender_id FROM messages
                    WHERE chat_id = $chatId
                    ORDER BY timestamp DESC
                    LIMIT 1;
                `;
                const { resultSets: msgResults } = await session.executeQuery(lastMsgQuery, {
                    '$chatId': TypedValues.utf8(chat.id)
                });
                const msgRows = msgResults[0] ? TypedData.createNativeObjects(msgResults[0]) : [];
                if (msgRows.length > 0) {
                    isOwnMessage = msgRows[0].sender_id === userId;
                }
            }

            chats.push({
                id: chat.id,
                matchId: user.id,
                name: user.name,
                age: user.age,
                ethnicity: user.ethnicity,
                macroGroups: tryParse(user.macro_groups),
                photo: tryParse(user.photos)[0] || null,
                lastMessage: chat.last_message || '',
                lastMessageTime: chat.last_message_time ? new Date(chat.last_message_time).toISOString() : null,
                isOwnMessage: isOwnMessage
            });
        }

        // Sort by last message time or created_at
        chats.sort((a, b) => {
            const timeA = a.lastMessageTime ? new Date(a.lastMessageTime).getTime() : (chatRecords.find(c => c.id === a.id)?.created_at?.getTime() || 0);
            const timeB = b.lastMessageTime ? new Date(b.lastMessageTime).getTime() : (chatRecords.find(c => c.id === b.id)?.created_at?.getTime() || 0);
            return timeB - timeA;
        });
    });

    console.log(`[getChats] Returning ${chats.length} chats`);
    return { statusCode: 200, headers: responseHeaders, body: JSON.stringify({ chats }) };
}

async function getHistory(driver, requestHeaders, chatId, responseHeaders) {
    const userId = checkAuth(requestHeaders);
    if (!userId) return { statusCode: 401, headers: responseHeaders, body: JSON.stringify({ error: 'Unauthorized' }) };
    if (!chatId) return { statusCode: 400, headers: responseHeaders, body: JSON.stringify({ error: 'Missing chatId' }) };

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
            replyToId: row.reply_to_id || null,
            isEdited: row.is_edited || false,
            editedAt: row.edited_at ? new Date(row.edited_at).toISOString() : null
        }));
    });

    return { statusCode: 200, headers: responseHeaders, body: JSON.stringify({ messages }) };
}

async function getNewMessages(driver, requestHeaders, chatId, after, responseHeaders) {
    const userId = checkAuth(requestHeaders);
    if (!userId) return { statusCode: 401, headers: responseHeaders, body: JSON.stringify({ error: 'Unauthorized' }) };
    if (!chatId) return { statusCode: 400, headers: responseHeaders, body: JSON.stringify({ error: 'Missing chatId' }) };

    const afterTimestamp = after ? new Date(parseInt(after)) : new Date(0);

    let messages = [];
    await driver.tableClient.withSession(async (session) => {
        const query = `
            DECLARE $chatId AS Utf8;
            DECLARE $afterTimestamp AS Timestamp;
            SELECT id, sender_id, text, timestamp, is_read, type, reply_to_id, is_edited, edited_at
            FROM messages
            WHERE chat_id = $chatId AND timestamp > $afterTimestamp
            ORDER BY timestamp ASC;
        `;

        const { resultSets } = await session.executeQuery(query, {
            '$chatId': TypedValues.utf8(chatId),
            '$afterTimestamp': TypedValues.timestamp(afterTimestamp)
        });
        const rows = resultSets[0] ? TypedData.createNativeObjects(resultSets[0]) : [];

        messages = rows.map(row => ({
            id: row.id,
            senderId: row.sender_id,
            text: row.text,
            timestamp: new Date(row.timestamp).toISOString(),
            isRead: row.is_read,
            type: row.type || 'text',
            replyToId: row.reply_to_id || null,
            isEdited: row.is_edited || false,
            editedAt: row.edited_at ? new Date(row.edited_at).toISOString() : null
        }));
    });

    return { statusCode: 200, headers: responseHeaders, body: JSON.stringify({ messages }) };
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

    // Notify users about read status via WebSocket
    try {
        // Determine the "other" user (who sent the messages that are now read)
        // ChatID is usually "id1_id2" (sorted)
        const parts = chatId.split('_');
        const otherUserId = parts.find(p => p !== userId);

        if (otherUserId) {
            const readEvent = {
                type: 'messagesRead',
                chatId,
                readerId: userId,
                timeframe: new Date()
            };

            // 1. Notify the OTHER user (so they see blue ticks)
            const otherConnectionId = await getConnectionIdByUserId(driver, otherUserId);
            if (otherConnectionId) {
                await sendToConnection(driver, otherConnectionId, readEvent);
            }

            // 2. Notify MY connections (so my other devices/tabs see it's read)
            // We need to find ALL my connections, not just one. 
            // For now, let's just find "a" connection or assume we treat this as a broadcast if we had a list.
            // Our getConnectionIdByUserId only returns ONE (last?) connection. 
            // Ideally we'd broadcast to all, but let's stick to simple "last active" for now as per existing helpers.
            const myConnectionId = await getConnectionIdByUserId(driver, userId);
            if (myConnectionId) {
                await sendToConnection(driver, myConnectionId, readEvent);
            }
        }
    } catch (e) {
        console.error('[markAsRead] Failed to broadcast read event:', e);
        // Don't fail the request, just log error
    }

    return { statusCode: 200, headers: responseHeaders, body: JSON.stringify({ success: true }) };
}

async function handleEditMessage(driver, connectionId, chatId, messageId, text, recipientId, event) {
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
        await sendToConnection(driver, recipientConnectionId, editEvent, event);
    }
    await sendToConnection(driver, connectionId, editEvent, event);

    return { statusCode: 200 };
}

async function handleDeleteMessage(driver, connectionId, chatId, messageIds, recipientId, event) {
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
        await sendToConnection(driver, recipientConnectionId, deleteEvent, event);
    }
    await sendToConnection(driver, connectionId, deleteEvent, event);

    return { statusCode: 200 };
}

// ========== Helper Functions ==========

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
    console.log('[getUserIdByConnection] Looking up:', connectionId);
    let userId = null;
    let allConnections = [];
    await driver.tableClient.withSession(async (session) => {
        // Get the specific connection
        const query = `
            DECLARE $connectionId AS Utf8;
            SELECT user_id FROM socket_connections WHERE connection_id = $connectionId;
        `;
        const { resultSets } = await session.executeQuery(query, {
            '$connectionId': TypedValues.utf8(connectionId)
        });
        const rows = TypedData.createNativeObjects(resultSets[0]);

        // Also get all connections for debugging
        const allQuery = `SELECT connection_id, user_id FROM socket_connections;`;
        const { resultSets: allResults } = await session.executeQuery(allQuery);
        allConnections = TypedData.createNativeObjects(allResults[0]);

        if (rows.length > 0) {
            userId = rows[0].user_id;
            console.log('[getUserIdByConnection] Found userId:', userId);
        } else {
            console.log('[getUserIdByConnection] Connection NOT FOUND');
            console.log('[getUserIdByConnection] All connections in DB:', allConnections.map(c => c.connection_id));
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

async function getUserName(driver, userId) {
    let name = "Someone";
    await driver.tableClient.withSession(async (session) => {
        const query = `
            DECLARE $userId AS Utf8;
            SELECT name FROM users WHERE id = $userId;
        `;
        const { resultSets } = await session.executeQuery(query, {
            '$userId': TypedValues.utf8(userId)
        });
        const rows = TypedData.createNativeObjects(resultSets[0]);
        if (rows.length > 0) {
            name = rows[0].name;
        }
    });
    return name;
}

async function getUnreadMessages(driver, requestHeaders, responseHeaders) {
    const userId = checkAuth(requestHeaders);
    if (!userId) return { statusCode: 401, headers: responseHeaders, body: JSON.stringify({ error: 'Unauthorized' }) };

    let unreadMessages = 0;

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

        if (msgRes[0] && msgRes[0].rows && msgRes[0].rows.length > 0) {
            const countVal = msgRes[0].rows[0].items[0].uint64Value || msgRes[0].rows[0].items[0].int64Value;
            unreadMessages = Number(countVal);
        }
    });

    return {
        statusCode: 200,
        headers: responseHeaders,
        body: JSON.stringify({ unreadMessages })
    };
}

async function getUserStatus(driver, requestHeaders, targetUserId, responseHeaders) {
    const userId = checkAuth(requestHeaders);
    if (!userId) return { statusCode: 401, headers: responseHeaders, body: JSON.stringify({ error: 'Unauthorized' }) };
    if (!targetUserId) return { statusCode: 400, headers: responseHeaders, body: JSON.stringify({ error: 'Missing userId parameter' }) };

    // Check if user has active WebSocket connection (is online)
    const connectionId = await getConnectionIdByUserId(driver, targetUserId);
    const isOnline = !!connectionId;

    // Get last_seen from users table
    let lastSeen = null;
    await driver.tableClient.withSession(async (session) => {
        const query = `
            DECLARE $userId AS Utf8;
            SELECT last_seen FROM users WHERE id = $userId;
        `;
        const { resultSets } = await session.executeQuery(query, {
            '$userId': TypedValues.utf8(targetUserId)
        });
        const rows = TypedData.createNativeObjects(resultSets[0]);
        if (rows.length > 0 && rows[0].last_seen) {
            lastSeen = new Date(rows[0].last_seen).toISOString();
        }
    });

    console.log(`[getUserStatus] User ${targetUserId}: online=${isOnline}, lastSeen=${lastSeen}`);

    return {
        statusCode: 200,
        headers: responseHeaders,
        body: JSON.stringify({ isOnline, lastSeen })
    };
}