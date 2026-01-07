const { getDriver } = require('./db');
const {
    getMatches,
    getLikesYou,
    getYourLikes,
    handleLike,
    handleDislike
} = require('./src/matches');
const { error } = require('./utils/response');

module.exports.handler = async function (event, context) {
    const { httpMethod, path, headers, body } = event;

    console.log('[matches-service] Request:', { path, method: httpMethod });

    const responseHeaders = {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    };

    try {
        const driver = await getDriver();

        // Handle CORS preflight
        if (httpMethod === 'OPTIONS') {
            return { statusCode: 200, headers: responseHeaders };
        }

        // Route handlers
        if (path === '/matches' && httpMethod === 'GET') {
            return await getMatches(driver, headers, responseHeaders);
        }
        else if ((path === '/likes-you' || path === '/likes-you/') && httpMethod === 'GET') {
            return await getLikesYou(driver, headers, responseHeaders);
        }
        else if ((path === '/your-likes' || path === '/your-likes/') && httpMethod === 'GET') {
            return await getYourLikes(driver, headers, responseHeaders);
        }
        else if (path === '/like' && httpMethod === 'POST') {
            return await handleLike(driver, headers, JSON.parse(body), responseHeaders);
        }
        else if (path === '/dislike' && httpMethod === 'POST') {
            return await handleDislike(driver, headers, JSON.parse(body), responseHeaders);
        }

        return error(404, 'Not found', responseHeaders);

    } catch (e) {
        console.error('[matches-service] Error:', e);
        return error(500, e.message, responseHeaders);
    }
};
