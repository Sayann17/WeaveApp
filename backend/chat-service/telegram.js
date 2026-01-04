// Telegram Bot API helper module
const fetch = require('node-fetch');

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

/**
 * Send a notification to a user via Telegram Bot
 * @param {string} telegramId - User's Telegram ID (chat_id)
 * @param {string} text - Message text (supports HTML formatting)
 * @param {object} options - Additional options (reply_markup, etc.)
 * @returns {Promise<object|null>} - Response from Telegram API or null on error
 */
async function sendTelegramNotification(telegramId, text, options = {}) {
    if (!BOT_TOKEN) {
        console.error('TELEGRAM_BOT_TOKEN is not set');
        return null;
    }

    if (!telegramId) {
        console.log('No telegram_id provided, skipping notification');
        return null;
    }

    const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;

    const payload = {
        chat_id: telegramId,
        text: text,
        parse_mode: 'HTML',
        ...options
    };

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const error = await response.json();

            // Ignore 403 error (user blocked the bot)
            if (error.error_code === 403) {
                console.log(`User ${telegramId} blocked the bot`);
                return null;
            }

            throw new Error(`Telegram API error: ${error.description}`);
        }

        return await response.json();
    } catch (error) {
        console.error('Telegram notification error:', error);
        return null;
    }
}

/**
 * Send a new message notification
 */
async function notifyNewMessage(receiverTelegramId, senderName, messagePreview) {
    const text = `💬 <b>Новое сообщение от ${senderName}</b>\n\n${messagePreview.substring(0, 100)}${messagePreview.length > 100 ? '...' : ''}`;

    return await sendTelegramNotification(receiverTelegramId, text, {
        reply_markup: {
            inline_keyboard: [[
                { text: '📱 Открыть чат', web_app: { url: 'https://t.me/WeaveMe_bot/app' } }
            ]]
        }
    });
}

/**
 * Send a new like notification
 */
async function notifyNewLike(likedUserTelegramId) {
    const text = `❤️ <b>Вами заинтересовались!</b>\n\nКто-то поставил вам лайк. Проверьте, кто это!`;

    return await sendTelegramNotification(likedUserTelegramId, text, {
        reply_markup: {
            inline_keyboard: [[
                { text: '👀 Посмотреть', web_app: { url: 'https://t.me/WeaveMe_bot/app' } }
            ]]
        }
    });
}

/**
 * Send a match notification
 */
async function notifyMatch(userTelegramId, matchedUserName) {
    const text = `🎉 <b>У вас новый мэтч!</b>\n\nВы понравились друг другу с ${matchedUserName}. Начните общение!`;

    return await sendTelegramNotification(userTelegramId, text, {
        reply_markup: {
            inline_keyboard: [[
                { text: '💬 Написать сообщение', web_app: { url: 'https://t.me/WeaveMe_bot/app' } }
            ]]
        }
    });
}

module.exports = {
    sendTelegramNotification,
    notifyNewMessage,
    notifyNewLike,
    notifyMatch
};
