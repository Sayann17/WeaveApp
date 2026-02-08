const { Driver, getCredentialsFromEnv, TypedValues } = require('ydb-sdk');
const TelegramBot = require('node-telegram-bot-api');

const YDB_ENDPOINT = process.env.YDB_ENDPOINT;
const YDB_DATABASE = process.env.YDB_DATABASE;
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

// Message content: Hardcoded to the Zen Announcement
const ANNOUNCEMENT_MESSAGE = `Привет! 🌌

В суете будней легко потерять себя. Мы добавили в Weave *Паузу дня* — особый момент тишины, доступный раз в 24 часа.

Зайди в приложение, чтобы получить свое послание и немного замедлиться.

Ждем тебя: [Weave App](https://t.me/WeaveAppBot/app)`;

// Initialize Bot
const bot = new TelegramBot(BOT_TOKEN, { polling: false });

module.exports.handler = async function (event, context) {
    console.log('Starting announcement broadcast...', new Date().toISOString());

    const driver = new Driver({
        endpoint: YDB_ENDPOINT,
        database: YDB_DATABASE,
        authService: getCredentialsFromEnv(),
    });

    try {
        if (!await driver.ready(10000)) {
            throw new Error('Driver not ready!');
        }
        console.log('Connected to YDB.');

        let users = [];
        await driver.tableClient.withSession(async (session) => {
            // Find all users who have a Telegram ID
            const query = `
                SELECT telegram_id, name FROM users WHERE telegram_id IS NOT NULL;
            `;
            const { resultSets } = await session.executeQuery(query);
            users = mapResult(resultSets[0]);
        });

        console.log(`Found ${users.length} users to notify.`);

        let successCount = 0;
        let failCount = 0;

        // Broadcast Loop
        for (const user of users) {
            try {
                // Formatting: Markdown
                const options = { parse_mode: 'Markdown' };

                await bot.sendMessage(user.telegram_id, ANNOUNCEMENT_MESSAGE, options);

                successCount++;
                console.log(`[OK] Sent to ${user.telegram_id}`);

                // Simple rate limiting (avoid hitting 30 msg/sec limit)
                await new Promise(r => setTimeout(r, 50));
            } catch (e) {
                console.error(`[ERR] Failed to send to ${user.telegram_id}:`, e.message);
                failCount++;
            }
        }

        console.log('Broadcast finished.');
        console.log(`Success: ${successCount}, Failed: ${failCount}`);

        return {
            statusCode: 200,
            body: JSON.stringify({
                status: 'completed',
                total: users.length,
                success: successCount,
                failed: failCount
            })
        };

    } catch (error) {
        console.error('Broadcast Error:', error);
        return { statusCode: 500, body: error.message };
    } finally {
        await driver.destroy();
    }
};

function mapResult(resultSet) {
    if (!resultSet || !resultSet.rows) return [];
    return resultSet.rows.map(row => {
        const obj = {};
        if (resultSet.columns) {
            resultSet.columns.forEach((col, i) => {
                const item = row.items[i];
                obj[col.name] = item.textValue || item.int64Value || item.uint64Value || item.boolValue;
            });
        }
        return obj;
    });
}
