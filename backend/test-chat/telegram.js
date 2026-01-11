const { TypedValues, TypedData } = require('ydb-sdk');

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

async function notifyNewMessage(driver, recipientId, senderName, text) {
    if (!BOT_TOKEN) {
        console.log('[Telegram] No BOT_TOKEN provided, skipping notification');
        return;
    }

    try {
        console.log(`[Telegram] Preparing notification for user ${recipientId}`);

        // 1. Get telegram_id from users table
        let telegramId = null;
        await driver.tableClient.withSession(async (session) => {
            const query = `
                DECLARE $userId AS Utf8;
                SELECT telegram_id FROM users WHERE id = $userId;
            `;
            const { resultSets } = await session.executeQuery(query, {
                '$userId': TypedValues.utf8(recipientId)
            });
            const rows = TypedData.createNativeObjects(resultSets[0]);
            if (rows.length > 0) {
                telegramId = rows[0].telegram_id;
            }
        });

        if (!telegramId) {
            console.log(`[Telegram] No telegram_id found for user ${recipientId}`);
            return;
        }

        // 2. Send message via Bot API
        const messageText = `💬 <b>Новое сообщение от ${senderName}</b>\n\n${text.substring(0, 100)}${text.length > 100 ? '...' : ''}`;

        // Use a button to open the Mini App
        const keyboard = {
            inline_keyboard: [[
                { text: '📱 Открыть чат', url: 'https://t.me/WeaveMe_bot/app' }
            ]]
        };

        const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: telegramId,
                text: messageText,
                parse_mode: 'HTML',
                reply_markup: keyboard
            })
        });

        const data = await response.json();
        if (!data.ok) {
            console.error('[Telegram] Failed to send notification:', data.description);
        } else {
            console.log('[Telegram] Notification sent successfully');
        }

    } catch (error) {
        console.error('[Telegram] Error sending notification:', error);
    }
}

module.exports = { notifyNewMessage };
