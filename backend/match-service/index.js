const { getDriver } = require('./db');
const jwt = require('jsonwebtoken');
const { TypedValues, TypedData } = require('ydb-sdk');
const { sendLikeNotification, sendMatchNotifications } = require('./telegram-helpers');
const { calculateCulturalScore } = require('./scoring');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-key-change-me';

module.exports.handler = async function (event, context) {
    const { httpMethod, path, body, headers, queryStringParameters } = event;

    console.log('[match-service] Request:', { path, method: httpMethod });

    // CORS Headers - Whitelist for Telegram Mini Apps
    const allowedOrigins = [
        'https://web.telegram.org',
        'https://webk.telegram.org',
        'https://webz.telegram.org'
    ];
    const requestOrigin = headers.Origin || headers.origin || '';
    const corsOrigin = allowedOrigins.includes(requestOrigin) ? requestOrigin : (requestOrigin === '' ? '*' : '');

    const responseHeaders = {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': corsOrigin || 'https://web.telegram.org',
        'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Credentials': 'true'
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
    let isAdmin = false;

    await driver.tableClient.withSession(async (session) => {
        const query = `
            DECLARE $userId AS Utf8;
            DECLARE $requesterId AS Utf8;
            SELECT * FROM users WHERE id = $userId LIMIT 1;
            SELECT is_admin FROM users WHERE id = $requesterId LIMIT 1;
        `;
        const { resultSets } = await session.executeQuery(query, {
            '$userId': TypedValues.utf8(userId),
            '$requesterId': TypedValues.utf8(requesterId)
        });
        const rows = TypedData.createNativeObjects(resultSets[0]);
        if (rows.length > 0) user = rows[0];

        const requesterRows = TypedData.createNativeObjects(resultSets[1]);
        if (requesterRows.length > 0) isAdmin = requesterRows[0].is_admin === true;
    });

    if (!user) return { statusCode: 404, headers: responseHeaders, body: JSON.stringify({ error: 'User not found' }) };

    // Banned user check: Only admins can view banned profiles
    if (user.is_banned && !isAdmin) {
        return { statusCode: 404, headers: responseHeaders, body: JSON.stringify({ error: 'User not found' }) };
    }

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
            events: tryParse(user.events)
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
    await driver.tableClient.withSession(async (session) => {
        // Get current user data including location, BLOCKED users, and recent DISLIKES
        const currentUserQuery = `
            DECLARE $userId AS Utf8;
            DECLARE $fiveDaysAgo AS Timestamp;
            SELECT to_user_id FROM likes WHERE from_user_id = $userId;
            SELECT * FROM users WHERE id = $userId;
            SELECT blocked_id FROM blocked_users WHERE blocker_id = $userId;
            SELECT blocker_id FROM blocked_users WHERE blocked_id = $userId;
            SELECT to_user_id FROM dislikes WHERE from_user_id = $userId AND created_at > $fiveDaysAgo;
        `;

        // Calculate 5 days ago timestamp
        const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);

        const { resultSets: resData } = await session.executeQuery(currentUserQuery, {
            '$userId': TypedValues.utf8(userId),
            '$fiveDaysAgo': TypedValues.timestamp(fiveDaysAgo)
        });

        const likedIds = resData[0] ? TypedData.createNativeObjects(resData[0]).map(r => r.to_user_id) : [];
        const currentUserDataRaw = resData[1] ? TypedData.createNativeObjects(resData[1])[0] : null;
        const blockedByMe = resData[2] ? TypedData.createNativeObjects(resData[2]).map(r => r.blocked_id) : [];
        const blockedMe = resData[3] ? TypedData.createNativeObjects(resData[3]).map(r => r.blocker_id) : [];
        const recentDislikes = resData[4] ? TypedData.createNativeObjects(resData[4]).map(r => r.to_user_id) : [];

        const excludedIds = [...new Set([...likedIds, ...blockedByMe, ...blockedMe, ...recentDislikes])];
        excludedIds.push(userId); // Exclude self
        console.log(`[getDiscovery] Excluding ${recentDislikes.length} recent dislikes (5 day window)`);
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
        let usersQuery = `SELECT * FROM users WHERE profile_completed = 1 AND (is_banned IS NULL OR is_banned = false)`;
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
                    events: tryParse(u.events),
                    profileCompleted: true,
                    score: score // Include score in response
                };
            });

        // Loop Logic: If no candidates found (and we had excluding logic), try fetching without exclusions?
        // Actually, for "Infinite Carousel", if we run out of NEW users, we should include OLD users.
        // If scoredCandidates is empty and offset is 0 (or small), we should fetch previously seen users to restart loop.

        let totalCount = scoredCandidates.length;

        // If total count is 0 (filtered out everything), we should probably fetch the SEEN users to loop.
        // If total count is 0, we simply return empty (or whatever is left). 
        // We DO NOT fall back to showing liked users again. 
        // Disliked users are not tracked in DB, so they remain in 'scoredCandidates' naturally and will loop if pagination wraps.


        // Sort by Score DESC
        scoredCandidates.sort((a, b) => b.score - a.score);

        // Client-side Loop logic:
        // If offset >= totalCount, we wrap around.
        let effectiveOffset = offset;
        if (totalCount > 0) {
            effectiveOffset = offset % totalCount;
        }

        // Slice the page
        const limit = 50;

        if (effectiveOffset + limit <= totalCount) {
            profiles = scoredCandidates.slice(effectiveOffset, effectiveOffset + limit);
        } else {
            // We need to wrap around
            const firstPart = scoredCandidates.slice(effectiveOffset, totalCount);
            const remaining = limit - firstPart.length;
            const secondPart = scoredCandidates.slice(0, remaining);
            profiles = [...firstPart, ...secondPart];
        }

        console.log(`[getDiscovery] Returning ${profiles.length} profiles. Offset: ${offset} (Effective: ${effectiveOffset}). Total Candidates: ${totalCount}`);
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
        // 1. Fetch matches directly from 'matches' table
        // We need to check both user1_id and user2_id columns
        const matchesQuery = `
            DECLARE $userId AS Utf8;
            
            SELECT user1_id, user2_id, created_at 
            FROM matches 
            WHERE user1_id = $userId OR user2_id = $userId;
        `;

        const { resultSets: matchesRes } = await session.executeQuery(matchesQuery, {
            '$userId': TypedValues.utf8(userId)
        });

        const rawMatches = matchesRes[0] ? TypedData.createNativeObjects(matchesRes[0]) : [];

        if (rawMatches.length === 0) return;

        // 2. Identify the other person's ID and Chat ID
        const activeMatches = rawMatches.map(m => {
            const otherId = m.user1_id === userId ? m.user2_id : m.user1_id;
            const chatId = [userId, otherId].sort().join('_');
            return {
                otherId,
                chatId,
                matchCreatedAt: m.created_at
            };
        });

        // 3. Fetch Last Message Details from Messages Table directly
        // This gives us sender_id (to know if it's ours) and is_read status
        // We can do this efficiently? Or just iterate.
        // Let's iterate for safety and simplicity as we have chatId. 
        // A bulk IN query would be better but let's stick to safe logic first.

        const sortedMatches = [];

        for (const m of activeMatches) {
            const chatQuery = `
                DECLARE $chatId AS Utf8;
                DECLARE $userId AS Utf8;

                -- Get actual last message details
                SELECT sender_id, is_read, text, timestamp 
                FROM messages 
                WHERE chat_id = $chatId 
                ORDER BY timestamp DESC LIMIT 1;
                
                -- Get unread count (incoming only)
                SELECT COUNT(*) as unread_count 
                FROM messages 
                WHERE chat_id = $chatId 
                AND is_read = false 
                AND sender_id != $userId;
            `;
            const { resultSets: res } = await session.executeQuery(chatQuery, {
                '$chatId': TypedValues.utf8(m.chatId),
                '$userId': TypedValues.utf8(userId)
            });
            const lastMsgRow = res[0] ? TypedData.createNativeObjects(res[0])[0] : null;
            const unreadRow = res[1] ? TypedData.createNativeObjects(res[1])[0] : null;

            let sortTime = m.matchCreatedAt;
            let lastMessage = null;
            let isOwnMessage = false;
            let isRead = false;
            let lastMessageTime = null;

            if (lastMsgRow) {
                lastMessage = lastMsgRow.text;
                lastMessageTime = lastMsgRow.timestamp;
                isOwnMessage = lastMsgRow.sender_id === userId;
                isRead = lastMsgRow.is_read;

                // If last message is newer than match creation, use it for sorting
                const msgDate = new Date(lastMessageTime);
                const matchDate = new Date(m.matchCreatedAt);
                if (msgDate > matchDate) {
                    sortTime = lastMessageTime;
                }
            }

            const unreadCount = unreadRow ? (unreadRow.unread_count || unreadRow.count || 0) : 0;
            // Handle different number types from YDB (uint64 vs int64)
            const hasUnread = Number(unreadCount) > 0;

            sortedMatches.push({
                ...m,
                sortTime,
                lastMessageTime,
                unreadCount: Number(unreadCount),
                hasUnread,
                lastMessage,
                isOwnMessage,
                isRead
            });
        }

        // 4. Sort by sortTime DESC
        sortedMatches.sort((a, b) => new Date(b.sortTime) - new Date(a.sortTime));

        // 5. Fetch User Profiles for these matches
        for (const m of sortedMatches) {
            const userQuery = `
                DECLARE $id AS Utf8;
                SELECT id, name, age, photos, about, gender, ethnicity, religion, zodiac, macro_groups
                FROM users WHERE id = $id AND (is_banned IS NULL OR is_banned = false);
            `;
            const { resultSets: userResults } = await session.executeQuery(userQuery, {
                '$id': TypedValues.utf8(m.otherId)
            });
            const users = userResults[0] ? TypedData.createNativeObjects(userResults[0]) : [];

            if (users.length > 0) {
                const u = users[0];

                // Parse religion properly (handles double-escaped JSON)
                let religionsArray = null;
                if (u.religion) {
                    try {
                        const parsed = tryParse(u.religion);
                        if (parsed && Array.isArray(parsed)) {
                            // Each element might be a JSON string like "\"buddhism\""
                            religionsArray = parsed.map(item => {
                                if (typeof item === 'string') {
                                    // Try to parse again to remove escaped quotes
                                    try {
                                        return JSON.parse(item);
                                    } catch {
                                        return item;
                                    }
                                }
                                return item;
                            }).filter(item => item); // Remove empty values
                        } else if (parsed) {
                            religionsArray = [parsed];
                        }
                    } catch (e) {
                        console.error('[getMatches] Failed to parse religion:', e);
                    }
                }

                matches.push({
                    id: u.id,
                    chatId: m.chatId,
                    name: u.name,
                    age: u.age,
                    photos: tryParse(u.photos),
                    bio: u.about,
                    gender: u.gender,
                    ethnicity: u.ethnicity,
                    religion: u.religion, // Keep original for backward compatibility
                    zodiac: u.zodiac,
                    religions: religionsArray, // Parsed array
                    macroGroups: tryParse(u.macro_groups),
                    sortTime: m.sortTime,
                    lastMessageTime: m.lastMessageTime,
                    unreadCount: m.unreadCount,
                    hasUnread: m.hasUnread,
                    lastMessage: m.lastMessage,
                    isOwnMessage: m.isOwnMessage,
                    isRead: m.isRead
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
                SELECT id, name, age, photos, about, gender, ethnicity, religion, macro_groups, zodiac, interests, culture_pride, love_language, family_memory, stereotype_true, stereotype_false, events
                FROM users
                WHERE id = $likeId AND (is_banned IS NULL OR is_banned = false);
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
                stereotype_false: u.stereotype_false,
                events: tryParse(u.events)
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
                SELECT id, name, age, photos, about, gender, ethnicity, religion, macro_groups, zodiac, interests, culture_pride, love_language, family_memory, stereotype_true, stereotype_false, events
                FROM users
                WHERE id = $likeId AND (is_banned IS NULL OR is_banned = false);
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
                stereotype_false: u.stereotype_false,
                events: tryParse(u.events)
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

    try {
        await driver.tableClient.withSession(async (session) => {
            const timestamp = new Date();

            const insertQuery = `
                DECLARE $fromUserId AS Utf8;
                DECLARE $toUserId AS Utf8;
                DECLARE $createdAt AS Timestamp;
                
                UPSERT INTO dislikes (from_user_id, to_user_id, created_at)
                VALUES ($fromUserId, $toUserId, $createdAt);
            `;

            await session.executeQuery(insertQuery, {
                '$fromUserId': TypedValues.utf8(userId),
                '$toUserId': TypedValues.utf8(targetUserId),
                '$createdAt': TypedValues.timestamp(timestamp)
            }, { commitTx: true, beginTx: { serializableReadWrite: {} } });

            console.log(`[handleDislike] Saved dislike: ${userId} -> ${targetUserId}`);
        });
    } catch (error) {
        console.error('[handleDislike] Error saving dislike:', error);
        return { statusCode: 500, headers: responseHeaders, body: JSON.stringify({ error: 'Failed to save dislike' }) };
    }

    return {
        statusCode: 200,
        headers: responseHeaders,
        body: JSON.stringify({ success: true })
    };
}


