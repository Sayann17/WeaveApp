const { getDriver } = require('./db');
const jwt = require('jsonwebtoken');
const { TypedValues, TypedData } = require('ydb-sdk');
const { v4: uuidv4 } = require('uuid');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-key-change-me';

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
    console.log('[WS] Disconnect:', connectionId, '(keeping in DB)');
    return { statusCode: 200 };
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

        // Send to recipient
        const recipientConnectionId = await getConnectionIdByUserId(driver, recipientId);
        if (recipientConnectionId) {
            try {
                await sendToConnection(driver, recipientConnectionId, messageEvent, event);
            } catch (err) {
                console.error('[WS] Failed to send to recipient:', err);
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
    // Correct URL from Yandex Support: 
    //POST https://apigateway-connections.api.cloud.yandex.net/apigateways/websocket/v1/connections/{connectionId}:send
    const url = `https://apigateway-connections.api.cloud.yandex.net/apigateways/websocket/v1/connections/${connectionId}:send`;

    const iamToken = process.env.IAM_TOKEN;
    if (!iamToken) {
        console.error('[sendToConnection] IAM_TOKEN not configured!');
        throw new Error('IAM_TOKEN environment variable is required');
    }

    try {
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
