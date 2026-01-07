const { TypedValues, TypedData } = require('ydb-sdk');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { JWT_SECRET } = require('./auth');
const { sendMessageNotification } = require('../telegram-helpers');

const YC_API_KEY = process.env.YC_API_KEY;

async function handleConnect(driver, event, connectionId) {
    console.log('[WS] Connect attempt:', connectionId);

    const token = event.queryStringParameters?.token;

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
        console.log('[WS] Disconnect event for:', connectionId, '(keeping connection in DB)');
        return { statusCode: 200 };
    } catch (e) {
        console.error('[WS] Disconnect error:', e);
        return { statusCode: 200 };
    }
}

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
            await debugConnection(driver, connectionId);
            return { statusCode: 403 };
        }
        console.log(`[WS] Sender verified: ${userId}. Sending to ${recipientId}`);

        const safeChatId = [userId, recipientId].sort().join('_');
        console.log(`[WS] Computed safeChatId: ${safeChatId} (Input was: ${chatId})`);

        const newMessageId = uuidv4();
        const timestamp = new Date();

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
                    '$chatId': TypedValues.utf8(safeChatId),
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

        console.log(`[WS] Looking up connection for recipient ${recipientId}`);
        const recipientConnectionId = await getConnectionIdByUserId(driver, recipientId);
        console.log(`[WS] Recipient ${recipientId} connectionId:`, recipientConnectionId || 'OFFLINE');

        if (recipientConnectionId) {
            try {
                await sendToConnection(driver, recipientConnectionId, messageEvent, event);
            } catch (err) {
                console.error('[WS] Failed to send to recipient:', err);
                await sendMessageNotification(driver, userId, recipientId, text);
            }
        } else {
            console.log('[WS] Recipient offline, sending Telegram notification');
            await sendMessageNotification(driver, userId, recipientId, text);
        }

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

async function sendToConnection(driver, connectionId, data, event) {
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
        await sendToConnection(driver, recipientConnectionId, editEvent);
    }
    await sendToConnection(driver, connectionId, editEvent, null);

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
        await sendToConnection(driver, recipientConnectionId, deleteEvent);
    }
    await sendToConnection(driver, connectionId, deleteEvent, null);

    return { statusCode: 200 };
}

module.exports = {
    handleConnect,
    handleDisconnect,
    handleMessage,
    sendToConnection,
    getUserIdByConnection,
    getConnectionIdByUserId
};
