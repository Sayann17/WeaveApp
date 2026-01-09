const { Driver, getCredentialsFromEnv } = require('ydb-sdk');

let driver;

async function getDriver() {
    if (driver) return driver;

    const endpoint = process.env.YDB_ENDPOINT || 'grpcs://ydb.serverless.yandexcloud.net:2135';
    const database = process.env.YDB_DATABASE || '/ru-central1/b1g4ra81mm0ebhpfdhu0/etnttshcbsgjmbepadi4';

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
