const { Driver, getCredentialsFromEnv, TypedValues, TypedData } = require('ydb-sdk');
const TelegramBot = require('node-telegram-bot-api');

const YDB_ENDPOINT = process.env.YDB_ENDPOINT;
const YDB_DATABASE = process.env.YDB_DATABASE;
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

const bot = new TelegramBot(BOT_TOKEN, { polling: false });

async function handler(event, context) {
    console.log('Starting retention check at', new Date().toISOString());

    const driver = new Driver({
        endpoint: YDB_ENDPOINT,
        database: YDB_DATABASE,
        authService: getCredentialsFromEnv(),
    });

    try {
        if (!await driver.ready(10000)) {
            throw new Error('Driver not ready!');
        }
        console.log('Driver connected.');

        await driver.tableClient.withSession(async (session) => {
            const now = new Date();
            const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            const twentyFourHoursAgo = new Date(now.getTime() - 60 * 60 * 1000); // Changed to 1 hour for testing

            // 1. Inactive Users (Last login > 7 days ago)
            // Assuming last_login is Timestamp
            const queryInactive = `
                DECLARE $seven_days_ago AS Timestamp;
                
                SELECT id, telegram_id, name 
                FROM users 
                WHERE last_login < $seven_days_ago 
                AND (last_notified_at IS NULL OR last_notified_at < $seven_days_ago)
                AND telegram_id IS NOT NULL;
            `;

            console.log('Executing inactive query...');
            const { resultSets: inactiveSets } = await session.executeQuery(queryInactive, {
                '$seven_days_ago': TypedValues.timestamp(sevenDaysAgo)
            });

            const inactiveUsers = mapResult(inactiveSets[0]);
            console.log(`Found ${inactiveUsers.length} inactive users.`);

            for (const user of inactiveUsers) {
                if (user.telegram_id) {
                    try {
                        await bot.sendMessage(user.telegram_id, `Привет, ${user.name || 'друг'}! 👋\nМы соскучились! Загляни в Weave, там появилось много новых людей, с которыми у тебя может сложиться Узор.`);
                        await updateLastNotified(session, user.id);
                        console.log(`Sent inactive notification to user ${user.id}`);
                    } catch (e) {
                        console.error(`Failed to notify inactive user ${user.id}:`, e.message);
                    }
                }
            }

            // 2. Incomplete Onboarding (Created > 1 hour ago, profile_completed = 0/false)
            // Fix: created_at is Timestamp, so we must compare with Timestamp
            const queryIncomplete = `
                DECLARE $twenty_four_hours_ago AS Timestamp; 
                
                SELECT id, telegram_id, name 
                FROM users 
                WHERE created_at < $twenty_four_hours_ago 
                AND (profile_completed = 0 OR profile_completed IS NULL)
                AND (last_notified_at IS NULL)
                AND telegram_id IS NOT NULL;
            `;

            console.log('Executing incomplete profile query (1h test)...');

            const { resultSets: incompleteSets } = await session.executeQuery(queryIncomplete, {
                '$twenty_four_hours_ago': TypedValues.timestamp(twentyFourHoursAgo)
            });

            const incompleteUsers = mapResult(incompleteSets[0]);
            console.log(`Found ${incompleteUsers.length} users with incomplete profile.`);

            for (const user of incompleteUsers) {
                if (user.telegram_id) {
                    try {
                        await bot.sendMessage(user.telegram_id, `Привет! ✨\nТвой профиль в Weave почти готов. Осталось всего пара шагов, чтобы начать знакомиться. Заверши настройку прямо сейчас!`);
                        await updateLastNotified(session, user.id);
                        console.log(`Sent incomplete notification to user ${user.id}`);
                    } catch (e) {
                        console.error(`Failed to notify incomplete user ${user.id}:`, e.message);
                    }
                }
            }
        });

    } catch (err) {
        console.error('Retention check FAILED:', err);
        return { statusCode: 500, body: err.message };
    } finally {
        await driver.destroy();
    }

    console.log('Retention check completed successfully.');
    return {
        statusCode: 200,
        body: 'Retention check completed',
    };
}

// Helper to map YDB results
function mapResult(resultSet) {
    if (!resultSet || !resultSet.rows) return [];
    return resultSet.rows.map(row => {
        const obj = {};
        if (resultSet.columns) {
            resultSet.columns.forEach((col, i) => {
                const item = row.items[i];
                // Handle different value types roughly
                obj[col.name] = item.textValue || item.int64Value || item.uint64Value || item.boolValue;

                // Special handling for byte/string if needed, or nulls
                if (obj[col.name] === undefined && item.nullFlag) {
                    obj[col.name] = null;
                }
            });
        }
        return obj;
    });
}

// Helper to update last_notified_at
async function updateLastNotified(session, userId) {
    await session.executeQuery(`
        DECLARE $id AS Utf8;
        DECLARE $now AS Timestamp;
        UPSERT INTO users (id, last_notified_at) VALUES ($id, $now);
    `, {
        '$id': TypedValues.utf8(userId),
        '$now': TypedValues.timestamp(new Date())
    });
}

module.exports.handler = handler;
