const { TypedValues, TypedData } = require('ydb-sdk');
const { checkAuth } = require('./auth');
const { success, error } = require('../utils/response');
const { sendLikeNotification, sendMatchNotifications } = require('../telegram-helpers');

async function getMatches(driver, requestHeaders, responseHeaders) {
    const userId = checkAuth(requestHeaders);
    if (!userId) return error(401, 'Unauthorized', responseHeaders);

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

        // Find intersection
        const matchIds = likedByUsers.filter(id => userLiked.includes(id));

        if (matchIds.length === 0) {
            return;
        }

        // Step 3: Get user data
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

    return success({ matches }, responseHeaders);
}

async function getLikesYou(driver, requestHeaders, responseHeaders) {
    const userId = checkAuth(requestHeaders);
    if (!userId) return error(401, 'Unauthorized', responseHeaders);

    const tryParse = (val) => {
        if (!val) return [];
        if (Array.isArray(val)) return val;
        try { return JSON.parse(val); } catch (e) { return []; }
    };

    let profiles = [];
    await driver.tableClient.withSession(async (session) => {
        const likedByQuery = `
            DECLARE $userId AS Utf8;
            SELECT from_user_id FROM likes WHERE to_user_id = $userId;
        `;
        const { resultSets: likedByResults } = await session.executeQuery(likedByQuery, {
            '$userId': TypedValues.utf8(userId)
        });
        const likedByMeIds = likedByResults[0] ? TypedData.createNativeObjects(likedByResults[0]).map(r => r.from_user_id) : [];

        if (likedByMeIds.length === 0) return;

        const myLikesQuery = `
            DECLARE $userId AS Utf8;
            SELECT to_user_id FROM likes WHERE from_user_id = $userId;
        `;
        const { resultSets: myLikesResults } = await session.executeQuery(myLikesQuery, {
            '$userId': TypedValues.utf8(userId)
        });
        const myLikesIds = myLikesResults[0] ? TypedData.createNativeObjects(myLikesResults[0]).map(r => r.to_user_id) : [];

        const targetIds = likedByMeIds.filter(id => !myLikesIds.includes(id));

        if (targetIds.length === 0) return;

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

    return success({ profiles }, responseHeaders);
}

async function getYourLikes(driver, requestHeaders, responseHeaders) {
    const userId = checkAuth(requestHeaders);
    if (!userId) return error(401, 'Unauthorized', responseHeaders);

    const tryParse = (val) => {
        if (!val) return [];
        if (Array.isArray(val)) return val;
        try { return JSON.parse(val); } catch (e) { return []; }
    };

    let profiles = [];
    await driver.tableClient.withSession(async (session) => {
        const myLikesQuery = `
            DECLARE $userId AS Utf8;
            SELECT to_user_id FROM likes WHERE from_user_id = $userId;
        `;
        const { resultSets: myLikesResults } = await session.executeQuery(myLikesQuery, {
            '$userId': TypedValues.utf8(userId)
        });
        const myLikesIds = myLikesResults[0] ? TypedData.createNativeObjects(myLikesResults[0]).map(r => r.to_user_id) : [];

        if (myLikesIds.length === 0) return;

        const likedByQuery = `
            DECLARE $userId AS Utf8;
            SELECT from_user_id FROM likes WHERE to_user_id = $userId;
        `;
        const { resultSets: likedByResults } = await session.executeQuery(likedByQuery, {
            '$userId': TypedValues.utf8(userId)
        });
        const likedByMeIds = likedByResults[0] ? TypedData.createNativeObjects(likedByResults[0]).map(r => r.from_user_id) : [];

        const targetIds = myLikesIds.filter(id => !likedByMeIds.includes(id));

        if (targetIds.length === 0) return;

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

    return success({ profiles }, responseHeaders);
}

async function handleLike(driver, requestHeaders, body, responseHeaders) {
    const userId = checkAuth(requestHeaders);
    if (!userId) return error(401, 'Unauthorized', responseHeaders);

    const { targetUserId } = body;
    if (!targetUserId) return error(400, 'Missing targetUserId', responseHeaders);

    let isMatch = false;

    await driver.tableClient.withSession(async (session) => {
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

        if (isMatch) {
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

    let chatId = null;
    if (isMatch) {
        chatId = [userId, targetUserId].sort().join('_');
    }

    // Send Telegram notifications
    try {
        console.log('[handleLike] Sending Telegram notification');
        if (isMatch) {
            await sendMatchNotifications(driver, userId, targetUserId);
        } else {
            await sendLikeNotification(driver, targetUserId);
        }
    } catch (e) {
        console.error('[handleLike] Error sending Telegram notification:', e);
    }

    return success({ success: true, isMatch, chatId }, responseHeaders);
}

async function handleDislike(driver, requestHeaders, body, responseHeaders) {
    const userId = checkAuth(requestHeaders);
    if (!userId) return error(401, 'Unauthorized', responseHeaders);

    const { targetUserId } = body;
    if (!targetUserId) return error(400, 'Missing targetUserId', responseHeaders);

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

    return success({ success: true }, responseHeaders);
}

module.exports = {
    getMatches,
    getLikesYou,
    getYourLikes,
    handleLike,
    handleDislike
};
