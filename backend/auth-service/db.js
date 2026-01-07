const { Driver, getCredentialsFromEnv, MetadataAuthService } = require('ydb-sdk');
const fs = require('fs');
const path = require('path');

// YDB Configuration
const ENDPOINT = 'grpcs://ydb.serverless.yandexcloud.net:2135';
const DATABASE = '/ru-central1/b1g4ra81mm0ebhpfdhu0/etnttshcbsgjmbepadi4';

let driver = null;

async function getDriver() {
    console.log('getDriver: Start');
    if (driver) {
        console.log('getDriver: Using cached driver');
        return driver;
    }

    console.log('getDriver: getting credentials from env');
    const authService = getCredentialsFromEnv();

    console.log('getDriver: initializing Driver');
    driver = new Driver({
        endpoint: ENDPOINT,
        database: DATABASE,
        authService: authService,
    });

    const timeout = 10000;
    console.log(`getDriver: waiting for ready (timeout ${timeout}ms)`);
    if (!await driver.ready(timeout)) {
        console.error(`Driver has not become ready in ${timeout}ms!`);
        throw new Error('YDB driver not ready');
    }
    console.log('getDriver: Driver is ready');

    return driver;
}

module.exports = { getDriver };
