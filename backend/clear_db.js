const { getDriver } = require('./db');
const { TypedValues } = require('ydb-sdk');

async function clearUsers() {
    console.log('Connecting to database...');
    let driver;
    try {
        driver = await getDriver();
    } catch (e) {
        console.error('Failed to connect:', e);
        return;
    }

    console.log('Clearing users table...');
    try {
        await driver.tableClient.withSession(async (session) => {
            // YDB requires the ON SELECT clause for mass deletions in some modes,
            // or we can just iterate. The most reliable "clear all" in YDB SQL is often:
            // DELETE FROM users ON SELECT * FROM users;
            const query = `DELETE FROM users ON SELECT * FROM users;`;

            await session.executeQuery(query);
        });
        console.log('Successfully cleared all users.');
    } catch (e) {
        console.error('Error clearing table:', e);
    } finally {
        await driver.destroy();
    }
}

clearUsers();
