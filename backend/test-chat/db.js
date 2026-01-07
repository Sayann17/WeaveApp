const { Driver, getCredentialsFromEnv } = require('ydb-sdk');

let driver;

async function getDriver() {
    if (driver) return driver;

    const endpoint = process.env.YDB_ENDPOINT;
    const database = process.env.YDB_DATABASE;

    if (!endpoint || !database) {
        throw new Error('YDB_ENDPOINT and YDB_DATABASE environment variables are required');
    }

    const authService = getCredentialsFromEnv();
    driver = new Driver({ endpoint, database, authService });

    if (!await driver.ready(10000)) {
        throw new Error('Driver did not become ready in 10 seconds');
    }

    return driver;
}

module.exports = { getDriver };
