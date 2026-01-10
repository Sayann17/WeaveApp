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

/**
 * Get IAM token with automatic refresh
 * Uses Service Account key to generate JWT and exchange for IAM token
 */
async function getIAMToken() {
    // Return cached token if still valid
    if (cachedIAMToken && tokenExpiry && Date.now() < tokenExpiry) {
        return cachedIAMToken;
    }

    try {
        console.log('[IAM] Refreshing token...');

        // Create JWT for service account
        const now = Math.floor(Date.now() / 1000);
        const payload = {
            aud: 'https://iam.api.cloud.yandex.net/iam/v1/tokens',
            iss: SERVICE_ACCOUNT_KEY.service_account_id,
            iat: now,
            exp: now + 3600 // JWT valid for 1 hour
        };

        const jwtToken = jwt.sign(payload, SERVICE_ACCOUNT_KEY.private_key, {
            algorithm: 'PS256',
            keyid: SERVICE_ACCOUNT_KEY.id
        });

        // Exchange JWT for IAM token
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

        // Set expiry to 11 hours (tokens live 12 hours, refresh 1 hour early)
        tokenExpiry = Date.now() + (11 * 60 * 60 * 1000);

        console.log('[IAM] Token refreshed successfully, expires in 11 hours');
        return cachedIAMToken;
    } catch (error) {
        console.error('[IAM] Failed to refresh token:', error);
        throw new Error('Failed to get IAM token');
    }
}

module.exports.handler = async function (event, context) {
    const { httpMethod, path, body, headers, requestContext, queryStringParameters } = event;

    console.log('[test-chat] Request:', { path, method: httpMethod, type: requestContext?.eventType });

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
        // Delete this specific connection
        await driver.tableClient.withSession(async (session) => {
            const query = `
                DECLARE $connectionId AS Utf8;
                DELETE FROM socket_connections WHERE connection_id = $connectionId;
            `;
            await session.executeQuery(query, {
                '$connectionId': TypedValues.utf8(connectionId)
            });
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

        // Send to recipient via WebSocket OR Telegram
        const recipientConnectionId = await getConnectionIdByUserId(driver, recipientId);
        if (recipientConnectionId) {
            // Recipient is ONLINE - send via WebSocket
            try {
                await sendToConnection(driver, recipientConnectionId, messageEvent, event);
                console.log('[WS] Message sent to online recipient via WebSocket');
            } catch (err) {
                console.error('[WS] Failed to send to recipient:', err);
            }
        } else {
            // Recipient is OFFLINE - send Telegram notification
            console.log('[WS] Recipient is offline, sending Telegram notification');
            try {
                // Get recipient's telegram_id and sender's name
                const recipientData = await getUserData(driver, recipientId);
                const senderData = await getUserData(driver, userId);

                if (recipientData?.telegram_id && senderData?.name) {
                    await notifyNewMessage(
                        recipientData.telegram_id,
                        senderData.name,
                        text
                    );
                    console.log('[WS] Telegram notification sent to offline user');
                } else {
                    console.log('[WS] Cannot send Telegram notification: missing telegram_id or sender name');
                }
            } catch (telegramErr) {
                console.error('[WS] Failed to send Telegram notification:', telegramErr);
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
    }
    return { statusCode: 200 };
}


async function sendToConnection(driver, connectionId, data, event) {
    // Working URL format from production
    const url = `https://apigateway-connections.api.cloud.yandex.net/apigateways/websocket/v1/connections/${connectionId}:send`;

    try {
        // Get IAM token (automatically refreshes if expired)
        const iamToken = await getIAMToken();

        // Yandex API expects base64-encoded data
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
            // Don't throw - just log and continue
            return;
        }

        console.log('[sendToConnection] Success:', connectionId);
    } catch (error) {
        console.error('[sendToConnection] Error:', error.message);
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
        // 🔥 OPTIMIZED: Use UNION ALL instead of OR in JOIN (YDB limitation)
        const chatsQuery = `
            DECLARE $userId AS Utf8;
            
            SELECT 
                c.id as chat_id,
                c.user1_id,
                c.user2_id,
                c.last_message,
                c.last_message_time,
                c.created_at,
                u.id as other_user_id,
                u.name,
                u.age,
                u.photos,
                u.ethnicity,
                u.macro_groups
            FROM chats c
            JOIN users u ON u.id = c.user2_id
            WHERE c.user1_id = $userId
            
            UNION ALL
            
            SELECT 
                c.id as chat_id,
                c.user1_id,
                c.user2_id,
                c.last_message,
                c.last_message_time,
                c.created_at,
                u.id as other_user_id,
                u.name,
                u.age,
                u.photos,
                u.ethnicity,
                u.macro_groups
            FROM chats c
            JOIN users u ON u.id = c.user1_id
            WHERE c.user2_id = $userId;
        `;

        const { resultSets } = await session.executeQuery(chatsQuery, {
            '$userId': TypedValues.utf8(userId)
        });
        let chatRecords = resultSets[0] ? TypedData.createNativeObjects(resultSets[0]) : [];

        // Sort in JavaScript since ORDER BY after UNION ALL is problematic in YDB
        chatRecords.sort((a, b) => {
            const timeA = a.last_message_time ? new Date(a.last_message_time).getTime() : 0;
            const timeB = b.last_message_time ? new Date(b.last_message_time).getTime() : 0;
            return timeB - timeA; // DESC order
        });

        console.log(`[getChats] Found ${chatRecords.length} chats for user ${userId} (optimized query)`);

        // Transform results
        chats = chatRecords.map(row => ({
            id: row.chat_id,
            matchId: row.other_user_id,
            name: row.name,
            age: row.age,
            ethnicity: row.ethnicity,
            macroGroups: tryParse(row.macro_groups),
            photo: tryParse(row.photos)[0] || null,
            lastMessage: row.last_message || '',
            lastMessageTime: row.last_message_time ? new Date(row.last_message_time).toISOString() : null,
            isOwnMessage: false // Will be determined by frontend based on sender
        }));
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

async function getUserData(driver, userId) {
    let userData = null;
    await driver.tableClient.withSession(async (session) => {
        const query = `
            DECLARE $userId AS Utf8;
            SELECT telegram_id, name FROM users WHERE id = $userId;
        `;
        const { resultSets } = await session.executeQuery(query, {
            '$userId': TypedValues.utf8(userId)
        });
        const rows = TypedData.createNativeObjects(resultSets[0]);
        if (rows.length > 0) {
            userData = rows[0];
        }
    });
    return userData;
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
