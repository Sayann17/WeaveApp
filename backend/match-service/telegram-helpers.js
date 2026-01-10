const { TypedValues, TypedData } = require('ydb-sdk');
const { notifyNewLike, notifyMatch, notifyNewMessage } = require('./telegram');
const jwt = require('jsonwebtoken');

// Service Account Key from environment variables (must be set in match-service)
const SERVICE_ACCOUNT_KEY = {
    id: process.env.SA_ID,
    service_account_id: process.env.SA_SERVICE_ACCOUNT_ID,
    private_key: process.env.SA_PRIVATE_KEY
};

let cachedIAMToken = null;
let tokenExpiry = null;

// --- IAM Token Logic (Copied from test-chat) ---
async function getIAMToken() {
    if (cachedIAMToken && tokenExpiry && Date.now() < tokenExpiry) {
        return cachedIAMToken;
    }

    try {
        console.log('[IAM] Refreshing token...');
        const now = Math.floor(Date.now() / 1000);
        // Handle escaped newlines if present
        const privateKey = SERVICE_ACCOUNT_KEY.private_key ? SERVICE_ACCOUNT_KEY.private_key.replace(/\\n/g, '\n') : '';

        if (!privateKey) {
            console.error('[IAM] Private key is missing');
            return null;
        }

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
        return null;
    }
}

// --- WebSocket Sending Logic ---
async function sendToConnection(driver, connectionId, data) {
    // Correct URL for Yandex API Gateway
    const url = `https://apigateway-connections.api.cloud.yandex.net/apigateways/websocket/v1/connections/${connectionId}:send`;

    try {
        const iamToken = await getIAMToken();
        if (!iamToken) return false;

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
            console.log(`  Status: ${response.status}`);
            return false;
        }

        return true;
    } catch (error) {
        console.error('[sendToConnection] Error:', error.message);
        return false;
    }
}


// --- Notification Logic ---

async function sendLikeNotification(driver, likedUserId) {
    try {
        let wsSent = false;

        // 1. Try to send via WebSocket (if online)
        const connectionIds = await getConnectionIds(driver, likedUserId);
        if (connectionIds.length > 0) {
            console.log(`[Notification] User ${likedUserId} has ${connectionIds.length} connections. Sending WS event.`);
            const event = { type: 'newLike' };

            // Send to all connections
            const results = await Promise.all(connectionIds.map(connId => sendToConnection(driver, connId, event)));
            if (results.some(r => r === true)) {
                wsSent = true;
            }
        }

        // 2. If not sent via WS, send via Telegram
        if (!wsSent) {
            console.log(`[Notification] Sending Telegram like notification to ${likedUserId}`);
            const user = await getUserById(driver, likedUserId);
            if (user && user.telegram_id) {
                await notifyNewLike(user.telegram_id);
            }
        } else {
            console.log(`[Notification] WS Like sent to ${likedUserId}, skipping Telegram.`);
        }
    } catch (error) {
        console.error('[Telegram] Error sending like notification:', error);
    }
}

async function sendMatchNotifications(driver, user1Id, user2Id) {
    try {
        const [user1, user2] = await Promise.all([
            getUserById(driver, user1Id),
            getUserById(driver, user2Id)
        ]);

        // Helper to notify one user
        const notifyOne = async (recipient, partner) => {
            if (!recipient) return;

            let wsSent = false;
            // 1. Try WS
            const connectionIds = await getConnectionIds(driver, recipient.id);
            if (connectionIds.length > 0) {
                const event = {
                    type: 'newMatch',
                    partner: { name: partner ? partner.name : 'Someone' }
                };
                const results = await Promise.all(connectionIds.map(connId => sendToConnection(driver, connId, event)));
                if (results.some(r => r === true)) wsSent = true;
            }

            // 2. Fallback to Telegram
            if (!wsSent && recipient.telegram_id && partner) {
                console.log(`[Notification] Sending Telegram match notification to ${recipient.id}`);
                await notifyMatch(recipient.telegram_id, partner.name);
            } else if (wsSent) {
                console.log(`[Notification] WS Match sent to ${recipient.id}`);
            }
        };

        await Promise.all([
            notifyOne(user1, user2),
            notifyOne(user2, user1)
        ]);

    } catch (error) {
        console.error('[Telegram] Error sending match notifications:', error);
    }
}

async function sendMessageNotification(driver, senderId, recipientId, messageText) {
    // This is mostly handled in 'test-chat' service now via WebSocket Check.
    // But if called from here, we can replicate the logic.
    try {
        let wsSent = false;
        const connectionIds = await getConnectionIds(driver, recipientId);

        // Note: For messages, we typically want to send the actual message data via WS, 
        // which is handled by the Chat Service.
        // This function seems to be a fallback or for cross-service calls? 
        // If match-service calls this, it probably just wants to ensure ANY notification.
        // But match-service usually doesn't handle messages. 
        // Leaving logic as pure Telegram fallback for now or similar to above.

        // ... (Skipping WS check here to avoid conflict with Chat Service logic, 
        // or assuming this is only called if Chat Service failed? 
        // Actually, this function is NOT used in match-service/index.js currently.
        // match-service only calls sendLikeNotification and sendMatchNotifications.
        // So we can leave it or update it similarly.)

        const [sender, recipient] = await Promise.all([
            getUserById(driver, senderId),
            getUserById(driver, recipientId)
        ]);

        if (recipient && recipient.telegram_id && sender) {
            await notifyNewMessage(recipient.telegram_id, sender.name, messageText);
        }
    } catch (error) {
        console.error('[Telegram] Error sending message notification:', error);
    }
}

// --- DB Helpers ---

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

async function getConnectionIds(driver, userId) {
    let connectionIds = [];
    await driver.tableClient.withSession(async (session) => {
        const query = `
            DECLARE $userId AS Utf8;
            SELECT connection_id FROM socket_connections WHERE user_id = $userId;
        `;
        const { resultSets } = await session.executeQuery(query, {
            '$userId': TypedValues.utf8(userId)
        });
        const rows = TypedData.createNativeObjects(resultSets[0]);
        connectionIds = rows.map(r => r.connection_id);
    });
    return connectionIds;
}

// Deprecated: used single check, now we get all IDs
async function isUserOnline(driver, userId) {
    const ids = await getConnectionIds(driver, userId);
    return ids.length > 0;
}

module.exports = {
    sendLikeNotification,
    sendMatchNotifications,
    sendMessageNotification,
    getUserById,
    isUserOnline
};
