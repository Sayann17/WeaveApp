const { getDriver } = require('./db');
const {
    handleConnect,
    handleDisconnect,
    handleMessage
} = require('./src/websocket');

const {
    getMatches,
    getLikesYou,
    getYourLikes,
    handleLike,
    handleDislike
} = require('./src/matches');

const {
    getChats,
    getHistory,
    markAsRead
} = require('./src/chat');

const {
    getUserProfile,
    getDiscovery,
    getNotificationStats
} = require('./src/users');

const { error } = require('./utils/response');

module.exports.handler = async function (event, context) {
    const { httpMethod, path, body, headers, requestContext, queryStringParameters } = event;

    // IMPORTANT: Keep this log to verify if the request reaches the function!
    console.log('[DEBUG] Request received FULL EVENT:', JSON.stringify(event, null, 2));

    console.log('[DEBUG] Request details:', {
        type: requestContext?.eventType || 'REST',
        path: path,
        method: httpMethod,
        connectionId: requestContext?.connectionId,
        queryParams: queryStringParameters
    });

    const responseHeaders = {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    };

    try {
        const driver = await getDriver();

        // Handle WebSocket events
        if (requestContext && requestContext.eventType) {
            const eventType = requestContext.eventType;
            const connectionId = requestContext.connectionId;

            if (eventType === 'CONNECT') {
                return await handleConnect(driver, event, connectionId);
            } else if (eventType === 'DISCONNECT') {
                return await handleDisconnect(driver, connectionId);
            } else if (eventType === 'MESSAGE') {
                return await handleMessage(driver, event, connectionId);
            }
        }

        // Handle REST API
        if (httpMethod === 'OPTIONS') {
            return { statusCode: 200, headers: responseHeaders };
        }

        if (path === '/matches' && httpMethod === 'GET') {
            return await getMatches(driver, headers, responseHeaders);
        } else if (path === '/chats' && httpMethod === 'GET') {
            return await getChats(driver, headers, responseHeaders);
        } else if (path === '/history' && httpMethod === 'GET') {
            const chatId = event.queryStringParameters?.chatId;
            return await getHistory(driver, headers, chatId, responseHeaders);
        } else if (path === '/like' && httpMethod === 'POST') {
            return await handleLike(driver, headers, JSON.parse(body), responseHeaders);
        } else if (path === '/dislike' && httpMethod === 'POST') {
            return await handleDislike(driver, headers, JSON.parse(body), responseHeaders);
        } else if (path === '/profile' && httpMethod === 'GET') {
            const profileUserId = event.queryStringParameters?.userId;
            return await getUserProfile(driver, headers, profileUserId, responseHeaders);
        } else if (path === '/discovery' && httpMethod === 'GET') {
            return await getDiscovery(driver, headers, event.queryStringParameters, responseHeaders);
        } else if ((path === '/likes-you' || path === '/likes-you/') && httpMethod === 'GET') {
            return await getLikesYou(driver, headers, responseHeaders);
        } else if ((path === '/your-likes' || path === '/your-likes/') && httpMethod === 'GET') {
            return await getYourLikes(driver, headers, responseHeaders);
        } else if ((path === '/notifications/stats' || path === '/notifications/stats/') && httpMethod === 'GET') {
            return await getNotificationStats(driver, headers, responseHeaders);
        } else if ((path === '/mark-read' || path === '/mark-read/') && httpMethod === 'POST') {
            return await markAsRead(driver, headers, JSON.parse(body), responseHeaders);
        }

        return error(404, 'Not found', responseHeaders);

    } catch (e) {
        console.error('API Error:', e);
        return error(500, e.message, responseHeaders);
    }
};
