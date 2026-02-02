const { Driver, getCredentialsFromEnv, TypedData } = require('ydb-sdk');
require('dotenv').config();

const YDB_ENDPOINT = process.env.YDB_ENDPOINT;
const YDB_DATABASE = process.env.YDB_DATABASE;

async function debug() {
    const driver = new Driver({
        endpoint: YDB_ENDPOINT,
        database: YDB_DATABASE,
        authService: getCredentialsFromEnv(),
    });

    if (!await driver.ready(10000)) {
        console.error('Driver not ready!');
        return;
    }

    await driver.tableClient.withSession(async (session) => {
        console.log('Fetching all users...');
        const { resultSets } = await session.executeQuery(`
            SELECT id, name, created_at, profile_completed, last_notified_at, telegram_id
            FROM users;
        `);
        const users = TypedData.createNativeObjects(resultSets[0]);

        console.log('Total users:', users.length);

        const now = new Date();
        const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
        const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

        let incomplete = 0;
        let incompleteWithTg = 0;
        let incompleteWithTgOldEnough = 0; // > 1h
        let incompleteWithTgNotNotified = 0;

        console.log('\n--- Analysis ---');

        users.forEach(u => {
            const isProfileIncomplete = u.profile_completed === 0 || u.profile_completed === null || u.profile_completed === undefined;

            if (isProfileIncomplete) {
                incomplete++;
                const hasTg = !!u.telegram_id;

                if (hasTg) {
                    incompleteWithTg++;

                    const createdAt = new Date(u.created_at);
                    const isOldEnough = createdAt < oneHourAgo;

                    if (isOldEnough) {
                        incompleteWithTgOldEnough++;

                        const isNotNotified = !u.last_notified_at;
                        if (isNotNotified) {
                            incompleteWithTgNotNotified++;
                        } else {
                            // Optionally log notified users to see if they are the "missing" ones
                            // console.log(`Excluded (Already Notified): ${u.name} (${u.id})`);
                        }
                    } else {
                        console.log(`Excluded (Too New): ${u.name} (${u.id}), created: ${createdAt.toISOString()}`);
                    }
                } else {
                    console.log(`Excluded (No TG): ${u.name} (${u.id})`);
                }
            }
        });

        console.log('\n--- Summary ---');
        console.log(`1. Total Incomplete (profile_completed = 0/NULL): ${incomplete}`);
        console.log(`2. Incomplete + Has Telegram ID: ${incompleteWithTg}`);
        console.log(`3. ... + Created > 1 hour ago: ${incompleteWithTgOldEnough}`);
        console.log(`4. ... + Not Notified Yet (Should be found): ${incompleteWithTgNotNotified}`);
        console.log('----------------');
    });

    await driver.destroy();
}

debug().catch(console.error);
