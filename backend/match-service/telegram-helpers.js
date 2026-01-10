const { TypedValues, TypedData } = require('ydb-sdk');
const { notifyNewLike, notifyMatch, notifyNewMessage } = require('./telegram');

// Helper functions for Telegram notifications

async function sendLikeNotification(driver, likedUserId) {
    try {
        // Check if user is online (has WebSocket connection)
        const isOnline = await isUserOnline(driver, likedUserId);
        if (isOnline) {
            console.log(`[Telegram] User ${likedUserId} is online, skipping like notification`);
            return; // User is online, will receive WebSocket notification
        }

        // User is offline, send Telegram notification
        const user = await getUserById(driver, likedUserId);
        if (user && user.telegram_id) {
            await notifyNewLike(user.telegram_id);
            console.log(`[Telegram] Sent like notification to offline user ${likedUserId}`);
        }
    } catch (error) {
        console.error('[Telegram] Error sending like notification:', error);
    }
}

async function sendMatchNotifications(driver, user1Id, user2Id) {
    try {
        const [user1, user2, user1Online, user2Online] = await Promise.all([
            getUserById(driver, user1Id),
            getUserById(driver, user2Id),
            isUserOnline(driver, user1Id),
            isUserOnline(driver, user2Id)
        ]);

        // Send to user1 if offline
        if (!user1Online && user1 && user1.telegram_id && user2 && user2.name) {
            await notifyMatch(user1.telegram_id, user2.name);
            console.log(`[Telegram] Sent match notification to offline user ${user1Id}`);
        } else if (user1Online) {
            console.log(`[Telegram] User ${user1Id} is online, skipping match notification`);
        }

        // Send to user2 if offline
        if (!user2Online && user2 && user2.telegram_id && user1 && user1.name) {
            await notifyMatch(user2.telegram_id, user1.name);
            console.log(`[Telegram] Sent match notification to offline user ${user2Id}`);
        } else if (user2Online) {
            console.log(`[Telegram] User ${user2Id} is online, skipping match notification`);
        }
    } catch (error) {
        console.error('[Telegram] Error sending match notifications:', error);
    }
}

async function sendMessageNotification(driver, senderId, recipientId, messageText) {
    try {
        const [sender, recipient] = await Promise.all([
            getUserById(driver, senderId),
            getUserById(driver, recipientId)
        ]);

        if (recipient && recipient.telegram_id && sender && sender.name) {
            await notifyNewMessage(recipient.telegram_id, sender.name, messageText);
            console.log(`[Telegram] Sent message notification to user ${recipientId}`);
        }
    } catch (error) {
        console.error('[Telegram] Error sending message notification:', error);
    }
}

async function getUserById(driver, userId) {
    let user = null;
    await driver.tableClient.withSession(async (session) => {
        const query = `
            DECLARE $userId AS Utf8;
            SELECT id, name, telegram_id FROM users WHERE id = $userId LIMIT 1;
        `;
        const { resultSets } = await session.executeQuery(query, {
            '$userId': TypedValues.utf8(userId)
        });
        const rows = TypedData.createNativeObjects(resultSets[0]);
        if (rows.length > 0) user = rows[0];
    });
    return user;
}

async function isUserOnline(driver, userId) {
    let isOnline = false;
    await driver.tableClient.withSession(async (session) => {
        const query = `
            DECLARE $userId AS Utf8;
            SELECT connection_id FROM socket_connections WHERE user_id = $userId LIMIT 1;
        `;
        const { resultSets } = await session.executeQuery(query, {
            '$userId': TypedValues.utf8(userId)
        });
        const rows = TypedData.createNativeObjects(resultSets[0]);
        isOnline = rows.length > 0;
    });
    return isOnline;
}

module.exports = {
    sendLikeNotification,
    sendMatchNotifications,
    sendMessageNotification,
    getUserById,
    isUserOnline
};
