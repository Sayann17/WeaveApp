const { getDriver } = require('./db');
const {
    getUserProfile,
    getDiscovery,
    getNotificationStats
} = require('./src/users');
const { error } = require('./utils/response');

module.exports.handler = async function (event, context) {
    const { httpMethod, path, headers, queryStringParameters } = event;

    console.log('[auth-service] Request:', { path, method: httpMethod });

    const responseHeaders = {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    };

    try {
        const driver = await getDriver();

        // Handle CORS preflight
        if (httpMethod === 'OPTIONS') {
            return { statusCode: 200, headers: responseHeaders };
        }

        // Route handlers
        if (path === '/profile' && httpMethod === 'GET') {
            const profileUserId = queryStringParameters?.userId;
            return await getUserProfile(driver, headers, profileUserId, responseHeaders);
        }
        else if (path === '/discovery' && httpMethod === 'GET') {
            return await getDiscovery(driver, headers, queryStringParameters, responseHeaders);
        }
        else if ((path === '/notifications/stats' || path === '/notifications/stats/') && httpMethod === 'GET') {
            return await getNotificationStats(driver, headers, responseHeaders);
        }

        return error(404, 'Not found', responseHeaders);

    } catch (e) {
        console.error('[auth-service] Error:', e);
        return error(500, e.message, responseHeaders);
    }
};
