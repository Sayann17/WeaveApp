const { getDriver } = require('./db');
const jwt = require('jsonwebtoken');
const { TypedValues, TypedData } = require('ydb-sdk');
const { sendLikeNotification, sendMatchNotifications } = require('./telegram-helpers');
const { calculateCulturalScore } = require('./scoring');

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

            // --- Events API ---
        } else if ((path === '/events' || path === '/events/') && httpMethod === 'GET') {
            return await getEvents(driver, headers, responseHeaders);
        } else if ((path === '/events/attend' || path === '/events/attend/') && httpMethod === 'POST') {
            return await attendEvent(driver, headers, JSON.parse(body), responseHeaders);
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
    let userEvents = []; // [NEW]
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

        // [NEW] Fetch events
        if (user) {
            const eventQuery = `
                DECLARE $userId AS Utf8;
                SELECT e.id, e.title, e.image_key, e.event_date
                FROM event_participants ep
                JOIN events e ON e.id = ep.event_id
                WHERE ep.user_id = $userId;
            `;
            const { resultSets: eventRes } = await session.executeQuery(eventQuery, {
                '$userId': TypedValues.utf8(userId)
            });
            userEvents = TypedData.createNativeObjects(eventRes[0]).map(e => ({
                id: e.id,
                title: e.title,
                imageKey: e.image_key,
                date: e.event_date
            }));
        }
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
            longitude: user.longitude,
            events: userEvents // [NEW] Attach events
        })
    };
}


async function getDiscovery(driver, requestHeaders, queryParams, responseHeaders) {
    const userId = checkAuth(requestHeaders);
    if (!userId) return { statusCode: 401, headers: responseHeaders, body: JSON.stringify({ error: 'Unauthorized' }) };

    let filters = {};
    let offset = 0;

    if (queryParams) {
        if (queryParams.filters) {
            try { filters = JSON.parse(queryParams.filters); } catch (e) { }
        }

        // Fallback/Override: Read flattened params (from UserService.ts)
        if (queryParams.gender) filters.gender = queryParams.gender;
        if (queryParams.minAge) filters.minAge = queryParams.minAge;
        if (queryParams.maxAge) filters.maxAge = queryParams.maxAge;
        if (queryParams.ethnicity) filters.ethnicity = queryParams.ethnicity;
        if (queryParams.religion) filters.religion = queryParams.religion;

        if (queryParams.offset) {
            offset = parseInt(queryParams.offset) || 0;
        }
    }

    const tryParse = (val) => {
        if (!val) return [];
        if (Array.isArray(val)) return val;
        try { return JSON.parse(val); } catch (e) { return []; }
    };

    let profiles = [];
    return await driver.tableClient.withSession(async (session) => {
        // Get current user data including location
        const currentUserQuery = `
            DECLARE $userId AS Utf8;
            SELECT to_user_id FROM likes WHERE from_user_id = $userId;
            SELECT * FROM users WHERE id = $userId;
        `;
        const { resultSets: resData } = await session.executeQuery(currentUserQuery, { '$userId': TypedValues.utf8(userId) });

        const excludedIds = resData[0] ? TypedData.createNativeObjects(resData[0]).map(r => r.to_user_id) : [];
        excludedIds.push(userId); // Exclude self

        const currentUserDataRaw = resData[1] ? TypedData.createNativeObjects(resData[1])[0] : null;
        if (!currentUserDataRaw) return; // Should not happen if auth is valid

        // Normalize current user data for scoring
        const currentUser = {
            ...currentUserDataRaw,
            macroGroups: tryParse(currentUserDataRaw.macro_groups),
            interests: tryParse(currentUserDataRaw.interests),
            religions: tryParse(currentUserDataRaw.religion),
            customEthnicity: currentUserDataRaw.ethnicity // Map field names if they differ
        };

        // Fetch CANDIDATES (Limit 1000 for performance safety)
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

        // Fetch a large pool to sort from
        usersQuery += ` LIMIT 1000`;

        const { resultSets: resUsers } = await session.executeQuery(usersQuery, params);
        const allCandidates = TypedData.createNativeObjects(resUsers[0]);

        // Filter and Score Candidates
        let scoredCandidates = allCandidates
            .filter(u => !excludedIds.includes(u.id))
            .map(u => {
                // Normalize candidate data
                const candidateData = {
                    ...u,
                    macroGroups: tryParse(u.macro_groups),
                    interests: tryParse(u.interests),
                    religions: tryParse(u.religion),
                    customEthnicity: u.ethnicity
                };

                const score = calculateCulturalScore(currentUser, candidateData);

                return {
                    id: u.id,
                    name: u.name,
                    age: u.age,
                    photos: tryParse(u.photos),
                    bio: u.about,
                    gender: u.gender,
                    ethnicity: u.ethnicity,
                    religion: u.religion,
                    macroGroups: candidateData.macroGroups,
                    zodiac: u.zodiac,
                    religions: candidateData.religions,
                    interests: candidateData.interests,
                    culture_pride: u.culture_pride,
                    love_language: u.love_language,
                    family_memory: u.family_memory,
                    stereotype_true: u.stereotype_true,
                    stereotype_false: u.stereotype_false,
                    profileCompleted: true,
                    score: score // Include score in response
                };
            });

        // Loop Logic: If no candidates found (and we had excluding logic), try fetching without exclusions?
        // Actually, for "Infinite Carousel", if we run out of NEW users, we should include OLD users.
        // If scoredCandidates is empty and offset is 0 (or small), we should fetch previously seen users to restart loop.

        // Sort by Score DESC
        scoredCandidates.sort((a, b) => b.score - a.score);

        let totalCount = scoredCandidates.length;
        let effectiveOffset = offset;

        // Circular / Wrapping Logic
        if (totalCount > 0) {
            effectiveOffset = offset % totalCount;
        }

        // Slice the page (Limit 10)
        let finalProfiles = [];
        const limit = 10;

        if (totalCount === 0) {
            finalProfiles = [];
        } else if (effectiveOffset + limit <= totalCount) {
            finalProfiles = scoredCandidates.slice(effectiveOffset, effectiveOffset + limit);
        } else {
            // we need to wrap around
            const firstPart = scoredCandidates.slice(effectiveOffset, totalCount);
            const remaining = limit - firstPart.length;
            const secondPart = scoredCandidates.slice(0, remaining);
            finalProfiles = [...firstPart, ...secondPart];
        }

        // Enhance with events
        const profilesWithEvents = await Promise.all(finalProfiles.map(async (candidate) => {
            const evts = await getEvents(candidate.id);
            return { ...candidate, events: evts };
        }));

        console.log(`[getDiscovery] Returning ${profilesWithEvents.length} profiles. Offset: ${offset} (Effective: ${effectiveOffset}). Total Candidates: ${totalCount}`);

        return {
            statusCode: 200,
            headers: responseHeaders,
            body: JSON.stringify(profilesWithEvents)
        };
    });
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

// ========== Events API ==========

async function getEvents(driver, requestHeaders, responseHeaders) {
    const userId = checkAuth(requestHeaders);
    // userId is optional if we allow viewing events without login? 
    // But usually we need it to check 'isGoing'. 
    // Let's assume auth is required for consistency or at least check it.

    // Fetch all events
    // Fetch user participation if userId exists

    let events = [];

    await driver.tableClient.withSession(async (session) => {
        const query = `
            SELECT * FROM events ORDER BY event_date ASC;
        `;
        const { resultSets } = await session.executeQuery(query);
        const allEvents = TypedData.createNativeObjects(resultSets[0]);

        // Check participation
        let myEventIds = [];
        if (userId) {
            const partQuery = `
                DECLARE $userId AS Utf8;
                SELECT event_id FROM event_participants WHERE user_id = $userId;
            `;
            const { resultSets: partRes } = await session.executeQuery(partQuery, { '$userId': TypedValues.utf8(userId) });
            if (partRes[0]) {
                myEventIds = TypedData.createNativeObjects(partRes[0]).map(r => r.event_id);
            }
        }

        events = allEvents.map(e => ({
            id: e.id,
            title: e.title,
            description: e.description,
            date: e.event_date,
            imageKey: e.image_key,
            isGoing: myEventIds.includes(e.id)
        }));
    });

    return {
        statusCode: 200,
        headers: responseHeaders,
        body: JSON.stringify({ events })
    };
}

async function attendEvent(driver, requestHeaders, body, responseHeaders) {
    const userId = checkAuth(requestHeaders);
    if (!userId) return { statusCode: 401, headers: responseHeaders, body: JSON.stringify({ error: 'Unauthorized' }) };

    const { eventId } = body;
    if (!eventId) return { statusCode: 400, headers: responseHeaders, body: JSON.stringify({ error: 'Missing eventId' }) };

    await driver.tableClient.withSession(async (session) => {
        const query = `
            DECLARE $userId AS Utf8;
            DECLARE $eventId AS Utf8;
            DECLARE $status AS Utf8;
            DECLARE $createdAt AS Timestamp;
            
            UPSERT INTO event_participants (user_id, event_id, status, created_at)
            VALUES ($userId, $eventId, $status, $createdAt);
        `;

        await session.executeQuery(query, {
            '$userId': TypedValues.utf8(userId),
            '$eventId': TypedValues.utf8(eventId),
            '$status': TypedValues.utf8('going'),
            '$createdAt': TypedValues.timestamp(new Date())
        }, { commitTx: true, beginTx: { serializableReadWrite: {} } });

        console.log(`[attendEvent] User ${userId} is going to event ${eventId}`);
    });

    return {
        statusCode: 200,
        headers: responseHeaders,
        body: JSON.stringify({ success: true })
    };
}

