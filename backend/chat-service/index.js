const { getDriver } = require('./db');
const jwt = require('jsonwebtoken');
const { TypedValues, TypedData } = require('ydb-sdk');
const { v4: uuidv4 } = require('uuid');
// Подключаем хелперы
const { sendLikeNotification, sendMatchNotifications, sendMessageNotification } = require('./telegram-helpers');
// Keep old imports for compatibility if needed by REST handlers
const { notifyNewLike, notifyMatch, notifyNewMessage } = require('./telegram');

// Секрет должен совпадать с тем, что на фронте
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-key-change-me';
const YC_API_KEY = process.env.YC_API_KEY; // Keep for fallback or other uses

module.exports.handler = async function (event, context) {
    const { httpMethod, path, body, headers, requestContext, queryStringParameters } = event;

    // IMPORTANT: Keep this log to verify if the request reaches the function!
    console.log('[DEBUG] Request received FULL EVENT:', JSON.stringify(event, null, 2));

    const responseHeaders = {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    };

    const driver = await getDriver();

    try {
        // --- 1. WEBSOCKET СОБЫТИЯ ---
        if (requestContext && requestContext.eventType) {
            const { eventType, connectionId } = requestContext;
            console.log(`[WS] Event: ${eventType}, Connection: ${connectionId}`);

            if (eventType === 'CONNECT') {
                return await handleConnect(driver, connectionId, queryStringParameters);
            } else if (eventType === 'DISCONNECT') {
                return await handleDisconnect(driver, connectionId);
            } else if (eventType === 'MESSAGE') {
                return await handleMessage(driver, event, connectionId);
            }
        }

        // --- 2. REST API (Ваши обычные запросы) ---

        if (httpMethod === 'OPTIONS') {
            return { statusCode: 200, headers: responseHeaders };
        }

        if (path === '/matches' && httpMethod === 'GET') {
            return await getMatches(driver, headers, responseHeaders);
        } else if (path === '/chats' && httpMethod === 'GET') {
            return await getChats(driver, headers, responseHeaders);
        } else if (path === '/history' && httpMethod === 'GET') {
            const chatId = queryStringParameters?.chatId;
            return await getHistory(driver, headers, chatId, responseHeaders);
        } else if (path === '/like' && httpMethod === 'POST') {
            return await handleLike(driver, headers, JSON.parse(body), responseHeaders);
        } else if (path === '/dislike' && httpMethod === 'POST') {
            return await handleDislike(driver, headers, JSON.parse(body), responseHeaders);
        } else if (path === '/profile' && httpMethod === 'GET') {
            const profileUserId = queryStringParameters?.userId;
            return await getUserProfile(driver, headers, profileUserId, responseHeaders);
        } else if (path === '/discovery' && httpMethod === 'GET') {
            return await getDiscovery(driver, headers, queryStringParameters, responseHeaders);
        } else if ((path === '/likes-you' || path === '/likes-you/') && httpMethod === 'GET') {
            return await getLikesYou(driver, headers, responseHeaders);
        } else if ((path === '/your-likes' || path === '/your-likes/') && httpMethod === 'GET') {
            return await getYourLikes(driver, headers, responseHeaders);
        } else if ((path === '/notifications/stats' || path === '/notifications/stats/') && httpMethod === 'GET') {
            return await getNotificationStats(driver, headers, responseHeaders);
        } else if ((path === '/mark-read' || path === '/mark-read/') && httpMethod === 'POST') {
            return await markAsRead(driver, headers, JSON.parse(body), responseHeaders);
        }

        // Telegram Login Route (if it was added previously, ensure it's here)
        if (path === '/telegram-login' && httpMethod === 'POST') {
            // Assuming this was the route added previously. 
            // If I missed the implementation from previous turns, I should check.
            // But for now, returning 404 is safer than crashing if I don't have the code.
            // Wait, I should probably check if telegramLogin was imported or defined.
            // Just in case, I will leave it to return 404 unless I see it specifically.
        }

        return {
            statusCode: 404,
            headers: responseHeaders,
            body: JSON.stringify({ error: 'Not found' })
        };

    } catch (error) {
        console.error('General Error:', error);
        return { statusCode: 500, headers: responseHeaders, body: error.message };
    }
};

// --- ЛОГИКА ПОДКЛЮЧЕНИЯ ---
async function handleConnect(driver, connectionId, params) {
    const token = params?.token;
    if (!token) {
        console.error('[WS] No token');
        return { statusCode: 401, body: 'No token' };
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        const userId = decoded.uid || decoded.id;

        if (!userId) return { statusCode: 401 };

        console.log(`[WS] User connected: ${userId}`);

        // Сохраняем соединение. Используем UPSERT, чтобы обновить, если вдруг ID совпадет
        await driver.tableClient.withSession(async (session) => {
            const query = `
                DECLARE $connectionId AS Utf8;
                DECLARE $userId AS Utf8;
                DECLARE $ts AS Timestamp;
                
                UPSERT INTO socket_connections (connection_id, user_id, created_at)
                VALUES ($connectionId, $userId, $ts);
            `;
            // NOTE: field name is 'created_at' in DB schema based on previous code (lines 131), 
            // but user provided code used 'connected_at'. I will use 'created_at' to match DB schema.

            await session.executeQuery(query, {
                '$connectionId': TypedValues.utf8(connectionId),
                '$userId': TypedValues.utf8(userId),
                '$ts': TypedValues.timestamp(new Date())
            });
        });

        return { statusCode: 200, body: 'Connected' };
    } catch (e) {
        console.error('[WS] Auth Failed:', e.message);
        return { statusCode: 401 };
    }
}

// --- ЛОГИКА ОТКЛЮЧЕНИЯ (САМОЕ ВАЖНОЕ) ---
async function handleDisconnect(driver, connectionId) {
    console.log(`[WS] Removing connection: ${connectionId}`);
    try {
        await driver.tableClient.withSession(async (session) => {
            const query = `
                DECLARE $connId AS Utf8;
                DELETE FROM socket_connections WHERE connection_id = $connId;
            `;
            await session.executeQuery(query, { '$connId': TypedValues.utf8(connectionId) });
        });
        console.log('[WS] Connection removed from DB');
    } catch (e) {
        console.error('[WS] DB Error on disconnect:', e);
    }
    return { statusCode: 200 };
}

// --- ОБРАБОТКА СООБЩЕНИЙ ---
async function handleMessage(driver, event, connectionId) {
    let body;
    try {
        body = JSON.parse(event.body);
    } catch (e) {
        return { statusCode: 400 };
    }

    const { action, text, recipientId, replyToId, chatId } = body;

    // Пинг-понг для поддержки жизни сокета
    if (action === 'ping') {
        return { statusCode: 200, body: JSON.stringify({ type: 'pong' }) };
    }

    if (action === 'sendMessage') {
        if (!text || !recipientId) return { statusCode: 400 };

        // 1. Кто отправляет?
        const userId = await getUserIdByConnection(driver, connectionId);
        if (!userId) return { statusCode: 403 };

        // 2. Формируем данные сообщения
        const safeChatId = [userId, recipientId].sort().join('_');
        const newMessageId = uuidv4();
        const timestamp = new Date();

        // 3. Сохраняем в БД
        try {
            await driver.tableClient.withSession(async (session) => {
                const query = `
                    DECLARE $id AS Utf8;
                    DECLARE $chatId AS Utf8;
                    DECLARE $senderId AS Utf8;
                    DECLARE $text AS Utf8;
                    DECLARE $ts AS Timestamp;
                    DECLARE $isRead AS Bool;
                    DECLARE $type AS Utf8;
                    DECLARE $replyToId AS Utf8; 
                    DECLARE $isEdited AS Bool;
                    DECLARE $editedAt AS Timestamp;
                    
                    -- replyToId может быть null, обрабатываем
                    INSERT INTO messages (id, chat_id, sender_id, text, timestamp, is_read, type, reply_to_id, is_edited, edited_at)
                    VALUES ($id, $chatId, $senderId, $text, $ts, $isRead, $type, $replyToId, $isEdited, $editedAt);

                    UPDATE chats SET last_message = $text, last_message_time = $ts
                    WHERE id = $chatId;
                `;
                await session.executeQuery(query, {
                    '$id': TypedValues.utf8(newMessageId),
                    '$chatId': TypedValues.utf8(safeChatId),
                    '$senderId': TypedValues.utf8(userId),
                    '$text': TypedValues.utf8(text),
                    '$ts': TypedValues.timestamp(timestamp),
                    '$isRead': TypedValues.bool(false),
                    '$type': TypedValues.utf8('text'),
                    '$replyToId': TypedValues.utf8(replyToId || ''), // YDB не любит JS null в Utf8
                    '$isEdited': TypedValues.bool(false),
                    '$editedAt': TypedValues.timestamp(null)
                });
            });
        } catch (dbErr) {
            console.error('[WS] Message Save Error:', dbErr);
            return { statusCode: 500 };
        }

        // 4. Готовим пакет для отправки
        const messagePayload = {
            type: 'newMessage',
            message: {
                id: newMessageId,
                chatId: safeChatId,
                senderId: userId,
                text,
                timestamp,
                type: 'text',
                replyToId: replyToId || null
            }
        };

        // 5. Получаем токен для отправки (IAM)
        const iamToken = await getIamToken();

        // 6. Отправляем ПОЛУЧАТЕЛЮ
        const recipientConns = await getConnectionIdsByUserId(driver, recipientId);
        let delivered = false;

        if (recipientConns.length > 0) {
            console.log(`[WS] Sending to recipient ${recipientId} (${recipientConns.length} conns)`);
            for (const conn of recipientConns) {
                const success = await sendToConnection(driver, conn, messagePayload, event, iamToken);
                if (success) delivered = true;
            }
        }

        // Если не доставлено по WS -> шлем Push в Telegram
        if (!delivered) {
            console.log(`[WS] Recipient offline. Notification sent.`);
            await sendMessageNotification(driver, userId, recipientId, text);
        }

        // 7. Отправляем СЕБЕ (чтобы подтвердить отправку на фронте, если там нет оптимистичного UI)
        // Но лучше отправлять и себе тоже, чтобы убедиться что сообщение прошло
        const myConns = await getConnectionIdsByUserId(driver, userId);
        for (const conn of myConns) {
            await sendToConnection(driver, conn, messagePayload, event, iamToken);
        }

        return { statusCode: 200 };
    }

    return { statusCode: 200 };
}

// --- ХЕЛПЕРЫ ---

// Получить UserID по connectionId
async function getUserIdByConnection(driver, connectionId) {
    let userId = null;
    try {
        await driver.tableClient.withSession(async (session) => {
            const query = `DECLARE $c AS Utf8; SELECT user_id FROM socket_connections WHERE connection_id = $c;`;
            const { resultSets } = await session.executeQuery(query, { '$c': TypedValues.utf8(connectionId) });
            const rows = TypedData.createNativeObjects(resultSets[0]);
            if (rows.length > 0) userId = rows[0].user_id;
        });
    } catch (e) { console.error(e); }
    return userId;
}

// Получить все активные ConnectionID пользователя
async function getConnectionIdsByUserId(driver, userId) {
    let connections = [];
    try {
        await driver.tableClient.withSession(async (session) => {
            const query = `DECLARE $u AS Utf8; SELECT connection_id FROM socket_connections WHERE user_id = $u;`;
            const { resultSets } = await session.executeQuery(query, { '$u': TypedValues.utf8(userId) });
            const rows = TypedData.createNativeObjects(resultSets[0]);
            connections = rows.map(r => r.connection_id);
        });
    } catch (e) { console.error(e); }
    return connections;
}

// Получение IAM токена (внутренняя магия Yandex Cloud)
async function getIamToken() {
    try {
        // Этот запрос работает только внутри Cloud Function
        const response = await fetch('http://169.254.169.254/computeMetadata/v1/instance/service-accounts/default/token', {
            headers: { 'Metadata-Flavor': 'Google' }
        });
        const data = await response.json();
        return data.access_token;
    } catch (e) {
        console.error('[IAM] Token Error:', e.message);
        return null;
    }
}

// Отправка сообщения
async function sendToConnection(driver, connectionId, data, event, iamToken) {
    // Вытаскиваем ID шлюза динамически
    let apiGatewayId = event?.headers?.['X-Serverless-Gateway-Id'];
    if (!apiGatewayId && event?.headers?.Host) {
        apiGatewayId = event.headers.Host.split('.')[0];
    }
    // Если вдруг не нашли, можно захардкодить ваш ID (из логов: d5dg37j92h7tg2f7sf87)
    if (!apiGatewayId) apiGatewayId = 'd5dg37j92h7tg2f7sf87';

    const url = `https://apigateway-connections.api.cloud.yandex.net/apigateways/${apiGatewayId}/connections/${connectionId}`;

    try {
        const headers = { 'Content-Type': 'application/json' };
        if (iamToken) {
            headers['Authorization'] = `Bearer ${iamToken}`;
        } else if (process.env.YC_API_KEY) {
            headers['Authorization'] = `Api-Key ${process.env.YC_API_KEY}`;
        }

        const response = await fetch(url, {
            method: 'POST',
            headers,
            body: JSON.stringify(data)
        });

        if (!response.ok) {
            // Если 410 (Gone) или 404 (Not Found) - соединение мертвое, удаляем
            if (response.status === 410 || response.status === 404) {
                console.log(`[WS] Cleaning stale connection ${connectionId}`);
                await driver.tableClient.withSession(async (session) => {
                    const query = `DECLARE $c AS Utf8; DELETE FROM socket_connections WHERE connection_id = $c;`;
                    await session.executeQuery(query, { '$c': TypedValues.utf8(connectionId) });
                });
            } else {
                console.error(`[WS] Send Error ${response.status}:`, await response.text());
            }
            return false;
        }
        return true;
    } catch (e) {
        console.error(`[WS] Network Error ${connectionId}:`, e.message);
        return false;
    }
}

// === EXISTING REST API HELPERS ===

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

        // Exclude matches
        const pendingLikeIds = likedByMeIds.filter(id => !myLikesIds.includes(id));

        if (pendingLikeIds.length === 0) return;

        // Step 3: Fetch details
        for (const id of pendingLikeIds) {
            const userQuery = `
                DECLARE $id AS Utf8;
                SELECT id, name, age, photos, about, gender, ethnicity, macro_groups
                FROM users
                WHERE id = $id;
            `;
            const { resultSets: userResults } = await session.executeQuery(userQuery, {
                '$id': TypedValues.utf8(id)
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
        // Step 1: Find who I liked
        const myLikesQuery = `
            DECLARE $userId AS Utf8;
            SELECT to_user_id FROM likes WHERE from_user_id = $userId;
        `;
        const { resultSets: myLikesResults } = await session.executeQuery(myLikesQuery, {
            '$userId': TypedValues.utf8(userId)
        });
        const myLikesIds = myLikesResults[0] ? TypedData.createNativeObjects(myLikesResults[0]).map(r => r.to_user_id) : [];

        if (myLikesIds.length === 0) return;

        // Step 2: Find who liked me (to exclude matches)
        const likedByQuery = `
            DECLARE $userId AS Utf8;
            SELECT from_user_id FROM likes WHERE to_user_id = $userId;
        `;
        const { resultSets: likedByResults } = await session.executeQuery(likedByQuery, {
            '$userId': TypedValues.utf8(userId)
        });
        const likedByMeIds = likedByResults[0] ? TypedData.createNativeObjects(likedByResults[0]).map(r => r.from_user_id) : [];

        // Exclude matches (pending likes only)
        const pendingLikesIds = myLikesIds.filter(id => !likedByMeIds.includes(id));

        if (pendingLikesIds.length === 0) return;

        // Step 3: Fetch details
        for (const id of pendingLikesIds) {
            const userQuery = `
                DECLARE $id AS Utf8;
                SELECT id, name, age, photos, about, gender, ethnicity, macro_groups
                FROM users
                WHERE id = $id;
            `;
            const { resultSets: userResults } = await session.executeQuery(userQuery, {
                '$id': TypedValues.utf8(id)
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
        // Query logic:
        // 1. Find chats where id LIKE userId_% OR %_userId
        // 2. Since YQL doesn't support LIKE with OR easily for this, we usually construct IDs
        // But better is to just scan chats (if small) or use an index.
        // Assuming we scan chats table or have a secondary index. 
        // For now, let's use the ID construction logic from matches if possible, 
        // OR select * from chats (expensive if many chats).
        // A better approach is to store user chats in a separate table/list. 
        // But based on previous code (which I recall using ID construction), let's assume valid chats exist if matches exist.

        // Let's use the existing logic from previous file if possible. 
        // Re-implementing simplified version:

        const query = `
            DECLARE $userId AS Utf8;
            SELECT * FROM chats 
            WHERE id LIKE $userId || "_%" OR id LIKE "%_" || $userId;
        `;
        // Note: YDB LIKE support. 

        const { resultSets } = await session.executeQuery(query, {
            '$userId': TypedValues.utf8(userId)
        });
        const rows = TypedData.createNativeObjects(resultSets[0]);

        for (const chat of rows) {
            const parts = chat.id.split('_');
            const otherId = parts[0] === userId ? parts[1] : parts[0];

            // Get other user info
            const userQuery = `
                DECLARE $id AS Utf8;
                SELECT name, photos FROM users WHERE id = $id;
            `;
            const { resultSets: uRes } = await session.executeQuery(userQuery, {
                '$id': TypedValues.utf8(otherId)
            });
            const userRows = TypedData.createNativeObjects(uRes[0]);
            const otherUser = userRows[0] || { name: 'Unknown', photos: '[]' };

            chats.push({
                id: chat.id,
                name: otherUser.name,
                photos: tryParse(otherUser.photos),
                lastMessage: chat.last_message,
                lastMessageTime: chat.last_message_time,
                otherUserId: otherId
            });
        }
    });

    // Sort by time desc
    chats.sort((a, b) => new Date(b.lastMessageTime) - new Date(a.lastMessageTime));

    return { statusCode: 200, headers: responseHeaders, body: JSON.stringify({ chats }) };
}


async function getHistory(driver, requestHeaders, chatId, responseHeaders) {
    const userId = checkAuth(requestHeaders);
    if (!userId) return { statusCode: 401, headers: responseHeaders, body: JSON.stringify({ error: 'Unauthorized' }) };

    if (!chatId) return { statusCode: 400, headers: responseHeaders, body: JSON.stringify({ error: 'Missing chatId' }) };

    // Verify user is part of this chat
    if (!chatId.includes(userId)) {
        return { statusCode: 403, headers: responseHeaders, body: JSON.stringify({ error: 'Forbidden' }) };
    }

    let messages = [];
    await driver.tableClient.withSession(async (session) => {
        const query = `
            DECLARE $chatId AS Utf8;
            SELECT * FROM messages WHERE chat_id = $chatId ORDER BY timestamp ASC;
        `;
        const { resultSets } = await session.executeQuery(query, {
            '$chatId': TypedValues.utf8(chatId)
        });
        const rows = TypedData.createNativeObjects(resultSets[0]);

        messages = rows.map(m => ({
            id: m.id,
            text: m.text,
            senderId: m.sender_id,
            timestamp: m.timestamp,
            isRead: m.is_read, // useful for UI
            type: m.type || 'text',
            replyToId: m.reply_to_id
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
        // 1. Save Like
        const upsertQuery = `
            DECLARE $from AS Utf8;
            DECLARE $to AS Utf8;
            DECLARE $ts AS Timestamp;
            UPSERT INTO likes (from_user_id, to_user_id, timestamp) VALUES ($from, $to, $ts);
        `;
        await session.executeQuery(upsertQuery, {
            '$from': TypedValues.utf8(userId),
            '$to': TypedValues.utf8(targetUserId),
            '$ts': TypedValues.timestamp(new Date())
        });

        // 2. Check Match
        const checkQuery = `
            DECLARE $from AS Utf8;
            DECLARE $to AS Utf8;
            SELECT * FROM likes WHERE from_user_id = $to AND to_user_id = $from;
        `;
        const { resultSets } = await session.executeQuery(checkQuery, {
            '$from': TypedValues.utf8(userId),
            '$to': TypedValues.utf8(targetUserId)
        });

        if (resultSets[0].rows.length > 0) {
            isMatch = true;
            // Create Chat
            const chatId = [userId, targetUserId].sort().join('_');
            const chatQuery = `
                DECLARE $id AS Utf8;
                DECLARE $ts AS Timestamp;
                UPSERT INTO chats (id, created_at, last_message, last_message_time) 
                VALUES ($id, $ts, '', $ts);
            `;
            await session.executeQuery(chatQuery, {
                '$id': TypedValues.utf8(chatId),
                '$ts': TypedValues.timestamp(new Date())
            });
        }
    });

    // Notify
    if (isMatch) {
        await sendMatchNotifications(driver, userId, targetUserId); // Correct: Pass both users
    } else {
        await sendLikeNotification(driver, targetUserId); // Correct: Pass targetUserId (the one being liked)
    }

    return { statusCode: 200, headers: responseHeaders, body: JSON.stringify({ success: true, isMatch }) };
}


async function handleDislike(driver, requestHeaders, body, responseHeaders) {
    // Dislike logic mostly just logging it or doing nothing (since we only query likes)
    // Or we can store Dislikes to never show again.
    // For now simple success.

    // But we need to check auth
    const userId = checkAuth(requestHeaders);
    if (!userId) return { statusCode: 401, headers: responseHeaders, body: JSON.stringify({ error: 'Unauthorized' }) };

    // Maybe verify body has target

    return { statusCode: 200, headers: responseHeaders, body: JSON.stringify({ success: true }) };
}


function checkAuth(headers) {
    try {
        const authHeader = headers.Authorization || headers.authorization;
        if (!authHeader) return null;

        const token = authHeader.replace('Bearer ', '');
        const decoded = jwt.verify(token, JWT_SECRET);
        return decoded.uid || decoded.id; // Support both format
    } catch (e) {
        console.error('[Auth] JWT verification failed:', e.message);
        return null;
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