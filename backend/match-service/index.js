const { getDriver } = require('./db');
const jwt = require('jsonwebtoken');
const { TypedValues, TypedData } = require('ydb-sdk');
const { sendLikeNotification, sendMatchNotifications } = require('./telegram-helpers');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-key-change-me';

module.exports.handler = async function (event, context) {
    const { httpMethod, path, body, headers, queryStringParameters } = event;

    console.log('[match-service] Request:', { path, method: httpMethod });

    const responseHeaders = {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    };

    try {
        const driver = await getDriver();

        // Handle REST API
        if (httpMethod === 'OPTIONS') {
            return { statusCode: 200, headers: responseHeaders };
        }

        if (path === '/matches' && httpMethod === 'GET') {
            return await getMatches(driver, headers, responseHeaders);
        } else if (path === '/like' && httpMethod === 'POST') {
            return await handleLike(driver, headers, JSON.parse(body), responseHeaders);
        } else if (path === '/dislike' && httpMethod === 'POST') {
            return await handleDislike(driver, headers, JSON.parse(body), responseHeaders);
        } else if (path === '/profile' && httpMethod === 'GET') {
            const profileUserId = queryStringParameters?.userId;
            return await getUserProfile(driver, headers, profileUserId, responseHeaders);
        } else if (path === '/discovery' && httpMethod === 'GET') {
            return await getDiscovery(driver, headers, queryStringParameters, responseHeaders);
        } else if ((path === '/likes-you' || path === '/likes-you/') && httpMethod === 'GET') {
            return await getLikesYou(driver, headers, responseHeaders);
        } else if ((path === '/your-likes' || path === '/your-likes/') && httpMethod === 'GET') {
            return await getYourLikes(driver, headers, responseHeaders);
        } else if ((path === '/notifications/likes' || path === '/notifications/likes/') && httpMethod === 'GET') {
            return await getNewLikes(driver, headers, responseHeaders);
        }

        return {
            statusCode: 404,
            headers: responseHeaders,
            body: JSON.stringify({ error: 'Not found' })
        };
    } catch (e) {
        console.error('[match-service] Error:', e);
        return {
            statusCode: 500,
            headers: responseHeaders,
            body: JSON.stringify({ error: e.message })
        };
    }
};

// ========== Helper Functions ==========

function checkAuth(headers) {
    try {
        const authHeader = headers.Authorization || headers.authorization;
        if (!authHeader) return null;

        const token = authHeader.replace('Bearer ', '');
        const decoded = jwt.verify(token, JWT_SECRET);
        return decoded.uid;
    } catch (e) {
        console.error('[Auth] JWT verification failed:', e.message);
        return null;
    }
}

// ========== REST API Handlers ==========

async function getUserProfile(driver, requestHeaders, userId, responseHeaders) {
    const requesterId = checkAuth(requestHeaders);
    if (!requesterId) return { statusCode: 401, headers: responseHeaders, body: JSON.stringify({ error: 'Unauthorized' }) };

    let user = null;
    await driver.tableClient.withSession(async (session) => {
        const query = `
            DECLARE $userId AS Utf8;
            SELECT * FROM users WHERE id = $userId LIMIT 1;
        `;
        const { resultSets } = await session.executeQuery(query, {
            '$userId': TypedValues.utf8(userId)
        });
        const rows = TypedData.createNativeObjects(resultSets[0]);
        if (rows.length > 0) user = rows[0];
    });

    if (!user) return { statusCode: 404, headers: responseHeaders, body: JSON.stringify({ error: 'User not found' }) };

    const tryParse = (val) => {
        if (!val) return [];
        if (Array.isArray(val)) return val;
        try { return JSON.parse(val); } catch (e) { return []; }
    };

    return {
        statusCode: 200,
        headers: responseHeaders,
        body: JSON.stringify({
            id: user.id,
            name: user.name,
            photos: tryParse(user.photos),
            age: user.age,
            gender: user.gender,
            bio: user.about,
            about: user.about,
            ethnicity: user.ethnicity,
            religions: tryParse(user.religion),
            zodiac: user.zodiac,
            interests: tryParse(user.interests),
            macroGroups: tryParse(user.macro_groups),
            culture_pride: user.culture_pride,
            love_language: user.love_language,
            family_memory: user.family_memory,
            stereotype_true: user.stereotype_true,
            stereotype_false: user.stereotype_false,
            city: user.city,
            social_telegram: user.social_telegram,
            social_vk: user.social_vk,
            social_instagram: user.social_instagram,
            latitude: user.latitude,
            longitude: user.longitude
        })
    };
}

async function getDiscovery(driver, requestHeaders, filters, responseHeaders) {
    const userId = checkAuth(requestHeaders);
    if (!userId) return { statusCode: 401, headers: responseHeaders, body: JSON.stringify({ error: 'Unauthorized' }) };

    const tryParse = (val) => {
        if (!val) return [];
        if (Array.isArray(val)) return val;
        try { return JSON.parse(val); } catch (e) { return []; }
    };

    let profiles = [];
    console.log('[getDiscovery] Fetching discovery for userId:', userId);

    await driver.tableClient.withSession(async (session) => {
        // Get current user's location & excluded IDs
        const currentUserQuery = `
            DECLARE $userId AS Utf8;
            SELECT to_user_id FROM likes WHERE from_user_id = $userId;
            SELECT latitude, longitude, city FROM users WHERE id = $userId;
        `;
        const { resultSets: resData } = await session.executeQuery(currentUserQuery, { '$userId': TypedValues.utf8(userId) });

        const excludedIds = TypedData.createNativeObjects(resData[0]).map(r => r.to_user_id);
        excludedIds.push(userId);

        const currentUserData = TypedData.createNativeObjects(resData[1])[0] || {};
        const myLat = currentUserData.latitude;
        const myLon = currentUserData.longitude;
        const myCity = currentUserData.city ? currentUserData.city.toLowerCase().trim() : null;

        // Fetch users with filters
        let usersQuery = `SELECT * FROM users WHERE profile_completed = 1`;
        const params = {};

        if (filters) {
            if (filters.gender && filters.gender !== 'all') {
                usersQuery += ` AND gender = $gender`;
                params['$gender'] = TypedValues.utf8(filters.gender);
            }
            if (filters.minAge) {
                usersQuery += ` AND age >= $minAge`;
                const val = parseInt(filters.minAge);
                params['$minAge'] = TypedValues.uint32(isNaN(val) ? 18 : val);
            }
            if (filters.maxAge) {
                usersQuery += ` AND age <= $maxAge`;
                const val = parseInt(filters.maxAge);
                params['$maxAge'] = TypedValues.uint32(isNaN(val) ? 100 : val);
            }
            if (filters.ethnicity) {
                usersQuery += ` AND ethnicity = $ethnicity`;
                params['$ethnicity'] = TypedValues.utf8(filters.ethnicity);
            }
            if (filters.religion) {
                usersQuery += ` AND religion = $religion`;
                params['$religion'] = TypedValues.utf8(filters.religion);
            }
        }

        const { resultSets: resUsers } = await session.executeQuery(usersQuery, params);
        const allUsers = TypedData.createNativeObjects(resUsers[0]);

        // Haversine Distance
        const getDistance = (lat1, lon1, lat2, lon2) => {
            if (!lat1 || !lon1 || !lat2 || !lon2) return Infinity;
            const R = 6371;
            const dLat = (lat2 - lat1) * (Math.PI / 180);
            const dLon = (lon2 - lon1) * (Math.PI / 180);
            const a =
                Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
                Math.sin(dLon / 2) * Math.sin(dLon / 2);
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
            return R * c;
        };

        profiles = allUsers
            .filter(u => !excludedIds.includes(u.id))
            .map(u => {
                const uCity = u.city ? u.city.toLowerCase().trim() : null;
                const distance = getDistance(myLat, myLon, u.latitude, u.longitude);
                const isCityMatch = myCity && uCity && myCity === uCity;

                return {
                    id: u.id,
                    name: u.name,
                    age: u.age,
                    photos: tryParse(u.photos),
                    bio: u.about,
                    gender: u.gender,
                    ethnicity: u.ethnicity,
                    religion: u.religion,
                    macroGroups: tryParse(u.macro_groups),
                    zodiac: u.zodiac,
                    religions: tryParse(u.religion),
                    interests: tryParse(u.interests),
                    culture_pride: u.culture_pride,
                    love_language: u.love_language,
                    family_memory: u.family_memory,
                    stereotype_true: u.stereotype_true,
                    stereotype_false: u.stereotype_false,
                    profileCompleted: true,
                    _distance: distance,
                    _isCityMatch: isCityMatch,
                    city: u.city
                };
            });

        // Sort: City Match first, then Distance
        profiles.sort((a, b) => {
            if (a._isCityMatch && !b._isCityMatch) return -1;
            if (!a._isCityMatch && b._isCityMatch) return 1;

            const distA = a._distance === Infinity ? 99999999 : a._distance;
            const distB = b._distance === Infinity ? 99999999 : b._distance;
            return distA - distB;
        });
    });

    return {
        statusCode: 200,
        headers: responseHeaders,
        body: JSON.stringify({ profiles })
    };
}

async function getNewLikes(driver, requestHeaders, responseHeaders) {
    const userId = checkAuth(requestHeaders);
    if (!userId) return { statusCode: 401, headers: responseHeaders, body: JSON.stringify({ error: 'Unauthorized' }) };

    let newLikes = 0;

    await driver.tableClient.withSession(async (session) => {
        const likeQuery = `
            DECLARE $userId AS Utf8;
            $my_likes = (SELECT to_user_id FROM likes WHERE from_user_id = $userId);
            
            SELECT COUNT(*) as count
            FROM likes l
            LEFT JOIN $my_likes m ON m.to_user_id = l.from_user_id
            WHERE l.to_user_id = $userId
            AND m.to_user_id IS NULL; 
        `;
        const { resultSets: likeRes } = await session.executeQuery(likeQuery, { '$userId': TypedValues.utf8(userId) });

        if (likeRes[0] && likeRes[0].rows && likeRes[0].rows.length > 0) {
            const countVal = likeRes[0].rows[0].items[0].uint64Value || likeRes[0].rows[0].items[0].int64Value;
            newLikes = Number(countVal);
        }
        console.log('[getNewLikes] Count:', newLikes);
    });

    return {
        statusCode: 200,
        headers: responseHeaders,
        body: JSON.stringify({ newLikes })
    };
}

async function getMatches(driver, requestHeaders, responseHeaders) {
    const userId = checkAuth(requestHeaders);
    if (!userId) return { statusCode: 401, headers: responseHeaders, body: JSON.stringify({ error: 'Unauthorized' }) };

    const tryParse = (val) => {
        if (!val) return [];
        if (Array.isArray(val)) return val;
        try { return JSON.parse(val); } catch (e) { return []; }
    };

    let matches = [];
    console.log('[getMatches] Starting for userId:', userId);

    await driver.tableClient.withSession(async (session) => {
        // 1. Find mutual likes (Matches)
        // Find users who liked me
        const likedByQuery = `
            DECLARE $userId AS Utf8;
            SELECT from_user_id FROM likes WHERE to_user_id = $userId;
        `;
        const { resultSets: likedByResults } = await session.executeQuery(likedByQuery, {
            '$userId': TypedValues.utf8(userId)
        });
        const likedByMeIds = likedByResults[0] ? TypedData.createNativeObjects(likedByResults[0]).map(r => r.from_user_id) : [];

        if (likedByMeIds.length === 0) return;

        // Find users I liked
        const myLikesQuery = `
            DECLARE $userId AS Utf8;
            SELECT to_user_id FROM likes WHERE from_user_id = $userId;
        `;
        const { resultSets: myLikesResults } = await session.executeQuery(myLikesQuery, {
            '$userId': TypedValues.utf8(userId)
        });
        const myLikesIds = myLikesResults[0] ? TypedData.createNativeObjects(myLikesResults[0]).map(r => r.to_user_id) : [];

        // Intersection = Matches
        const matchIds = likedByMeIds.filter(id => myLikesIds.includes(id));
        console.log(`[getMatches] Found ${matchIds.length} matches (robust)`);

        if (matchIds.length === 0) return;

        // 2. Fetch User Data
        for (const matchId of matchIds) {
            const userQuery = `
                DECLARE $id AS Utf8;
                SELECT id, name, age, photos, about, gender, ethnicity, macro_groups
                FROM users WHERE id = $id;
            `;
            const { resultSets: userResults } = await session.executeQuery(userQuery, {
                '$id': TypedValues.utf8(matchId)
            });
            const users = userResults[0] ? TypedData.createNativeObjects(userResults[0]) : [];

            if (users.length > 0) {
                const u = users[0];
                matches.push({
                    id: u.id,
                    chatId: [userId, u.id].sort().join('_'),
                    name: u.name,
                    age: u.age,
                    photos: tryParse(u.photos),
                    bio: u.about,
                    gender: u.gender,
                    ethnicity: u.ethnicity,
                    macroGroups: tryParse(u.macro_groups)
                });
            }
        }
    });

    console.log('[getMatches] Returning matches count:', matches.length);
    return {
        statusCode: 200,
        headers: responseHeaders,
        body: JSON.stringify({ matches })
    };
}


async function getLikesYou(driver, requestHeaders, responseHeaders) {
    const userId = checkAuth(requestHeaders);
    if (!userId) return { statusCode: 401, headers: responseHeaders, body: JSON.stringify({ error: 'Unauthorized' }) };

    const tryParse = (val) => {
        if (!val) return [];
        if (Array.isArray(val)) return val;
        try { return JSON.parse(val); } catch (e) { return []; }
    };

    let profiles = [];
    console.log('[getLikesYou] Starting for userId:', userId);

    await driver.tableClient.withSession(async (session) => {
        // Find users who liked me
        const likedByQuery = `
            DECLARE $userId AS Utf8;
            SELECT from_user_id FROM likes WHERE to_user_id = $userId;
        `;
        const { resultSets: likedByResults } = await session.executeQuery(likedByQuery, {
            '$userId': TypedValues.utf8(userId)
        });
        const likedByMeIds = likedByResults[0] ? TypedData.createNativeObjects(likedByResults[0]).map(r => r.from_user_id) : [];
        console.log('[getLikesYou] Users who liked me (potential):', likedByMeIds);

        if (likedByMeIds.length === 0) return;

        // Find users I already liked
        const myLikesQuery = `
            DECLARE $userId AS Utf8;
            SELECT to_user_id FROM likes WHERE from_user_id = $userId;
        `;
        const { resultSets: myLikesResults } = await session.executeQuery(myLikesQuery, {
            '$userId': TypedValues.utf8(userId)
        });
        const myLikesIds = myLikesResults[0] ? TypedData.createNativeObjects(myLikesResults[0]).map(r => r.to_user_id) : [];
        console.log('[getLikesYou] Users I already liked (to exclude):', myLikesIds);

        // Filter out mutual likes
        const newLikesIds = likedByMeIds.filter(id => !myLikesIds.includes(id));
        console.log('[getLikesYou] Final one-sided like IDs:', newLikesIds);

        if (newLikesIds.length === 0) return;

        // Get user data
        for (const likeId of newLikesIds) {
            const userQuery = `
                DECLARE $likeId AS Utf8;
                SELECT id, name, age, photos, about, gender, ethnicity, religion, macro_groups, zodiac, interests, culture_pride, love_language, family_memory, stereotype_true, stereotype_false
                FROM users
                WHERE id = $likeId;
            `;
            const { resultSets: userResults } = await session.executeQuery(userQuery, {
                '$likeId': TypedValues.utf8(likeId)
            });
            const users = userResults[0] ? TypedData.createNativeObjects(userResults[0]) : [];
            console.log(`[getLikesYou] Fetched user data for ${likeId}:`, users.length > 0 ? 'Success' : 'Not found');

            if (users.length === 0) continue;

            const u = users[0];
            profiles.push({
                id: u.id,
                name: u.name,
                age: u.age,
                photos: tryParse(u.photos),
                bio: u.about,
                gender: u.gender,
                ethnicity: u.ethnicity,
                religion: u.religion,
                religions: tryParse(u.religion),
                macroGroups: tryParse(u.macro_groups),
                zodiac: u.zodiac,
                interests: tryParse(u.interests),
                culture_pride: u.culture_pride,
                love_language: u.love_language,
                family_memory: u.family_memory,
                stereotype_true: u.stereotype_true,
                stereotype_false: u.stereotype_false
            });
        }
    });

    console.log('[getLikesYou] Returning profiles count:', profiles.length);
    return {
        statusCode: 200,
        headers: responseHeaders,
        body: JSON.stringify({ profiles })
    };

}


async function getYourLikes(driver, requestHeaders, responseHeaders) {
    const userId = checkAuth(requestHeaders);
    if (!userId) return { statusCode: 401, headers: responseHeaders, body: JSON.stringify({ error: 'Unauthorized' }) };

    const tryParse = (val) => {
        if (!val) return [];
        if (Array.isArray(val)) return val;
        try { return JSON.parse(val); } catch (e) { return []; }
    };

    let profiles = [];
    console.log('[getYourLikes] Starting for userId:', userId);

    await driver.tableClient.withSession(async (session) => {
        // Find users I liked
        const myLikesQuery = `
            DECLARE $userId AS Utf8;
            SELECT to_user_id FROM likes WHERE from_user_id = $userId;
        `;
        const { resultSets: myLikesResults } = await session.executeQuery(myLikesQuery, {
            '$userId': TypedValues.utf8(userId)
        });
        const myLikesIds = myLikesResults[0] ? TypedData.createNativeObjects(myLikesResults[0]).map(r => r.to_user_id) : [];
        console.log('[getYourLikes] Users I liked (potential):', myLikesIds);

        if (myLikesIds.length === 0) return;

        // Find users who liked me back
        const likedByQuery = `
            DECLARE $userId AS Utf8;
            SELECT from_user_id FROM likes WHERE to_user_id = $userId;
        `;
        const { resultSets: likedByResults } = await session.executeQuery(likedByQuery, {
            '$userId': TypedValues.utf8(userId)
        });
        const likedByMeIds = likedByResults[0] ? TypedData.createNativeObjects(likedByResults[0]).map(r => r.from_user_id) : [];
        console.log('[getYourLikes] Users who liked me (to exclude):', likedByMeIds);

        // Filter out mutual likes
        const oneSidedLikes = myLikesIds.filter(id => !likedByMeIds.includes(id));
        console.log('[getYourLikes] Final one-sided like IDs:', oneSidedLikes);

        if (oneSidedLikes.length === 0) return;

        // Get user data
        for (const likeId of oneSidedLikes) {
            const userQuery = `
                DECLARE $likeId AS Utf8;
                SELECT id, name, age, photos, about, gender, ethnicity, religion, macro_groups, zodiac, interests, culture_pride, love_language, family_memory, stereotype_true, stereotype_false
                FROM users
                WHERE id = $likeId;
            `;
            const { resultSets: userResults } = await session.executeQuery(userQuery, {
                '$likeId': TypedValues.utf8(likeId)
            });
            const users = userResults[0] ? TypedData.createNativeObjects(userResults[0]) : [];
            console.log(`[getYourLikes] Fetched user data for ${likeId}:`, users.length > 0 ? 'Success' : 'Not found');

            if (users.length === 0) continue;

            const u = users[0];
            profiles.push({
                id: u.id,
                name: u.name,
                age: u.age,
                photos: tryParse(u.photos),
                bio: u.about,
                gender: u.gender,
                ethnicity: u.ethnicity,
                religion: u.religion,
                religions: tryParse(u.religion),
                macroGroups: tryParse(u.macro_groups),
                zodiac: u.zodiac,
                interests: tryParse(u.interests),
                culture_pride: u.culture_pride,
                love_language: u.love_language,
                family_memory: u.family_memory,
                stereotype_true: u.stereotype_true,
                stereotype_false: u.stereotype_false
            });
        }
    });

    console.log('[getYourLikes] Returning profiles count:', profiles.length);
    return {
        statusCode: 200,
        headers: responseHeaders,
        body: JSON.stringify({ profiles })
    };

}


async function handleLike(driver, requestHeaders, body, responseHeaders) {
    const userId = checkAuth(requestHeaders);
    if (!userId) return { statusCode: 401, headers: responseHeaders, body: JSON.stringify({ error: 'Unauthorized' }) };

    const { targetUserId } = body;
    if (!targetUserId) return { statusCode: 400, headers: responseHeaders, body: JSON.stringify({ error: 'Missing targetUserId' }) };

    let isMatch = false;

    await driver.tableClient.withSession(async (session) => {
        // Insert the like
        const insertQuery = `
            DECLARE $fromUserId AS Utf8;
            DECLARE $toUserId AS Utf8;
            DECLARE $createdAt AS Timestamp;
            
            UPSERT INTO likes (from_user_id, to_user_id, created_at)
            VALUES ($fromUserId, $toUserId, $createdAt);
        `;

        await session.executeQuery(insertQuery, {
            '$fromUserId': TypedValues.utf8(userId),
            '$toUserId': TypedValues.utf8(targetUserId),
            '$createdAt': TypedValues.timestamp(new Date())
        }, { commitTx: true, beginTx: { serializableReadWrite: {} } });
        console.log('[handleLike] Like inserted for:', userId, '->', targetUserId);


        // Check if it's a match
        const checkQuery = `
            DECLARE $userId AS Utf8;
            DECLARE $targetUserId AS Utf8;
            
            SELECT COUNT(*) AS count
            FROM likes
            WHERE from_user_id = $targetUserId
            AND to_user_id = $userId;
        `;

        const { resultSets: matchResults } = await session.executeQuery(checkQuery, {
            '$userId': TypedValues.utf8(userId),
            '$targetUserId': TypedValues.utf8(targetUserId)
        });

        if (matchResults[0] && matchResults[0].rows && matchResults[0].rows.length > 0) {
            const countVal = matchResults[0].rows[0].items[0].uint64Value || matchResults[0].rows[0].items[0].int64Value;
            isMatch = Number(countVal) > 0;

            // Create chat entry when match occurs
            if (isMatch) {
                const chatId = [userId, targetUserId].sort().join('_');
                const [user1, user2] = [userId, targetUserId].sort();
                const timestamp = new Date();

                const matchQuery = `
                    DECLARE $chatId AS Utf8;
                    DECLARE $user1 AS Utf8;
                    DECLARE $user2 AS Utf8;
                    DECLARE $createdAt AS Timestamp;
                    
                    -- Create chat entry
                    UPSERT INTO chats (id, user1_id, user2_id, created_at, is_match_chat)
                    VALUES ($chatId, $user1, $user2, $createdAt, true);
                    
                    -- Create match entry
                    UPSERT INTO matches (user1_id, user2_id, created_at)
                    VALUES ($user1, $user2, $createdAt);
                `;

                await session.executeQuery(matchQuery, {
                    '$chatId': TypedValues.utf8(chatId),
                    '$user1': TypedValues.utf8(user1),
                    '$user2': TypedValues.utf8(user2),
                    '$createdAt': TypedValues.timestamp(timestamp)
                }, { commitTx: true, beginTx: { serializableReadWrite: {} } });


                console.log(`[Match] Created chat ${chatId} and match for users ${userId} and ${targetUserId}`);
            }
        }
    });

    // Send notifications
    if (isMatch) {
        await sendMatchNotifications(driver, userId, targetUserId);
    } else {
        await sendLikeNotification(driver, targetUserId);
    }

    return {
        statusCode: 200,
        headers: responseHeaders,
        body: JSON.stringify({
            success: true,
            isMatch,
            chatId: isMatch ? [userId, targetUserId].sort().join('_') : undefined
        })
    };
}

async function handleDislike(driver, requestHeaders, body, responseHeaders) {
    const userId = checkAuth(requestHeaders);
    if (!userId) return { statusCode: 401, headers: responseHeaders, body: JSON.stringify({ error: 'Unauthorized' }) };

    const { targetUserId } = body;
    if (!targetUserId) return { statusCode: 400, headers: responseHeaders, body: JSON.stringify({ error: 'Missing targetUserId' }) };

    // If you don't have a 'dislikes' table in your schema, we should just return success
    // or log it. Currently, the schema provided only has 'likes'.
    console.log('[handleDislike] Skipping DB insert because dislikes table does not exist. (Intentional pass)');

    return {
        statusCode: 200,
        headers: responseHeaders,
        body: JSON.stringify({ success: true })
    };
}
