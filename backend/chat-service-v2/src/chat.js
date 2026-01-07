const { TypedValues, TypedData } = require('ydb-sdk');
const { checkAuth } = require('./auth');
const { success, error } = require('../utils/response');

async function getChats(driver, requestHeaders, responseHeaders) {
    const userId = checkAuth(requestHeaders);
    if (!userId) return error(401, 'Unauthorized', responseHeaders);

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
            return;
        }

        // Step 2: Find mutual likes
        const mutualQuery = `
            DECLARE $userId AS Utf8;
            SELECT to_user_id FROM likes WHERE from_user_id = $userId;
        `;
        const { resultSets: mutualResults } = await session.executeQuery(mutualQuery, {
            '$userId': TypedValues.utf8(userId)
        });
        const userLiked = mutualResults[0] ? TypedData.createNativeObjects(mutualResults[0]).map(r => r.to_user_id) : [];

        const matchIds = likedByUsers.filter(id => userLiked.includes(id));

        if (matchIds.length === 0) {
            return;
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

            // Step 4: Get last message
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

        chats.sort((a, b) => {
            if (!a.lastMessageTime) return 1;
            if (!b.lastMessageTime) return -1;
            return new Date(b.lastMessageTime) - new Date(a.lastMessageTime);
        });
    });

    return success({ chats }, responseHeaders);
}

async function getHistory(driver, requestHeaders, chatId, responseHeaders) {
    const userId = checkAuth(requestHeaders);
    if (!userId) return error(401, 'Unauthorized', responseHeaders);
    if (!chatId) return error(400, 'Missing chatId', responseHeaders);

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

    return success({ messages }, responseHeaders);
}

async function markAsRead(driver, requestHeaders, body, responseHeaders) {
    const userId = checkAuth(requestHeaders);
    if (!userId) return error(401, 'Unauthorized', responseHeaders);

    const { chatId } = body;
    if (!chatId) return error(400, 'Missing chatId', responseHeaders);

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

    return success({ success: true }, responseHeaders);
}

module.exports = { getChats, getHistory, markAsRead };
