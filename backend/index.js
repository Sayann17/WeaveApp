const { getDriver } = require('./db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { TypedValues, TypedData } = require('ydb-sdk');
const { notifyStart } = require('./telegram');

// Secret for JWT - in production use Environment Variable!
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-key-change-me';

module.exports.handler = async function (event, context) {
    console.log('Handler started');
    console.log('Event path:', event.path);
    console.log('Event method:', event.httpMethod);

    const { httpMethod, path, body, headers } = event;
    let driver;
    try {
        driver = await getDriver();
    } catch (dbError) {
        console.error('DB Connection Failed:', dbError);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'DB Connection Failed: ' + dbError.message })
        };
    }

    // CORS Headers
    const responseHeaders = {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    };

    if (httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers: responseHeaders };
    }

    try {
        if (path === '/me' && httpMethod === 'GET') {
            return await me(driver, headers, responseHeaders);
        } else if (path === '/me' && httpMethod === 'DELETE') {
            return await deleteAccount(driver, headers, responseHeaders);
        } else if (path === '/profile' && httpMethod === 'POST') {
            return await updateProfile(driver, headers, JSON.parse(body), responseHeaders);
        } else if (path === '/telegram-login' && httpMethod === 'POST') {
            return await telegramLogin(driver, JSON.parse(body), responseHeaders);
        } else if (path === '/webhook' && httpMethod === 'POST') {
            return await handleWebhook(JSON.parse(body), responseHeaders);
        } else {
            return {
                statusCode: 404,
                headers: responseHeaders,
                body: JSON.stringify({ error: 'Not found' })
            };
        }
    } catch (e) {
        console.error(e);
        return {
            statusCode: 500,
            headers: responseHeaders,
            body: JSON.stringify({ error: e.message })
        };
    }
};

// Helper to decode YDB results safely
function decodeYdbResults(resultSet) {
    if (!resultSet) return [];
    try {
        // Use the correct YDB SDK method
        if (TypedData && typeof TypedData.createNativeObjects === 'function') {
            const result = TypedData.createNativeObjects(resultSet);
            console.log('[decodeYdbResults] Decoded', result.length, 'rows');
            return result;
        }

        // Fallback to decodeResultSet if available
        if (TypedData && typeof TypedData.decodeResultSet === 'function') {
            const result = TypedData.decodeResultSet(resultSet);
            console.log('[decodeYdbResults] Decoded via decodeResultSet', result.length, 'rows');
            return result;
        }

        console.error('[decodeYdbResults] No TypedData methods available');
        return [];
    } catch (e) {
        console.error('[decodeYdbResults] Error:', e);
        return [];
    }
}

async function updateProfile(driver, requestHeaders, data, headers) {
    const authHeader = requestHeaders['Authorization'] || requestHeaders['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return { statusCode: 401, headers, body: JSON.stringify({ error: 'No token provided' }) };
    }
    const token = authHeader.split(' ')[1];
    let decoded;
    try {
        decoded = jwt.verify(token, JWT_SECRET);
    } catch (e) {
        return { statusCode: 401, headers, body: JSON.stringify({ error: 'Invalid token' }) };
    }
    const id = decoded.uid;

    const allowedFields = {
        'name': 'utf8',
        'age': 'uint32',
        'gender': 'utf8',
        'ethnicity': 'utf8',
        'religion': 'utf8',
        'zodiac': 'utf8',
        'about': 'utf8',
        'job': 'utf8',
        'interests': 'utf8',
        'photos': 'utf8',
        'macro_groups': 'utf8',
        'profile_completed': 'uint32',
        'culture_pride': 'utf8',
        'love_language': 'utf8',
        'family_memory': 'utf8',
        'stereotype_true': 'utf8',
        'stereotype_true': 'utf8',
        'stereotype_false': 'utf8',
        'is_visible': 'bool',
        'latitude': 'double',
        'longitude': 'double',
        'city': 'utf8',
        'social_telegram': 'utf8',
        'social_vk': 'utf8',
        'social_instagram': 'utf8'
    };

    const updates = [];
    const params = { '$id': TypedValues.utf8(id) };

    const jsonFields = ['interests', 'photos', 'macro_groups', 'religion'];
    const fieldMapping = {
        'bio': 'about',
        'religions': 'religion',
        'macroGroups': 'macro_groups',
        'culturePride': 'culture_pride',
        'loveLanguage': 'love_language',
        'familyMemory': 'family_memory',
        'stereotypeTrue': 'stereotype_true',
        'stereotypeFalse': 'stereotype_false',
        'isVisible': 'is_visible',
        'latitude': 'latitude',
        'longitude': 'longitude',
        'city': 'city',
        'socialTelegram': 'social_telegram',
        'socialVk': 'social_vk',
        'socialInstagram': 'social_instagram'
    };

    // Explicitly handle each field to ensure types
    for (const [key, type] of Object.entries(allowedFields)) {
        // Find which key the frontend might have used
        let incomingValue = data[key];

        // If not found with original key, check mapping
        if (incomingValue === undefined) {
            for (const [frontendKey, backendKey] of Object.entries(fieldMapping)) {
                if (backendKey === key) {
                    incomingValue = data[frontendKey];
                    break;
                }
            }
        }

        if (incomingValue !== undefined) {
            console.log(`[updateProfile] Field matched: ${key}, Value: ${typeof incomingValue === 'object' ? JSON.stringify(incomingValue) : incomingValue}`); // ADDED LOG
            updates.push(`${key} = $${key}`);
            if (type === 'uint32') {
                params[`$${key}`] = TypedValues.uint32(parseInt(incomingValue) || 0);
            } else if (type === 'bool') {
                params[`$${key}`] = TypedValues.bool(Boolean(incomingValue));
            } else if (type === 'double') {
                params[`$${key}`] = TypedValues.double(parseFloat(incomingValue) || 0);
            } else if (jsonFields.includes(key)) {
                const value = typeof incomingValue === 'string' ? incomingValue : JSON.stringify(incomingValue);
                params[`$${key}`] = TypedValues.utf8(value);
            } else {
                params[`$${key}`] = TypedValues.utf8(String(incomingValue));
            }
        }
    }

    if (updates.length === 0) {
        console.log('[updateProfile] No updates to apply!'); // ADDED LOG
        return { statusCode: 200, headers, body: JSON.stringify({ message: 'No updates' }) };
    }

    updates.push(`updated_at = $updated_at`);
    params['$updated_at'] = TypedValues.datetime(new Date());

    console.log('[updateProfile] Executing SQL:', `UPDATE users SET ${updates.join(', ')} WHERE id = $id`); // ADDED LOG
    console.log('[updateProfile] Params keys:', Object.keys(params)); // ADDED LOG

    await driver.tableClient.withSession(async (session) => {
        const query = `
            DECLARE $id AS Utf8;
            ${Object.keys(params).filter(k => k !== '$id').map(k => `DECLARE ${k} AS ${k === '$updated_at' ? 'Datetime' : allowedFields[k.substring(1)] === 'uint32' ? 'Uint32' : allowedFields[k.substring(1)] === 'bool' ? 'Bool' : allowedFields[k.substring(1)] === 'double' ? 'Double' : 'Utf8'};`).join('\n')}
            
            UPDATE users SET ${updates.join(', ')} WHERE id = $id;
        `;
        await session.executeQuery(query, params);
    });

    return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
}

async function deleteAccount(driver, requestHeaders, headers) {
    const authHeader = requestHeaders['Authorization'] || requestHeaders['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return { statusCode: 401, headers, body: JSON.stringify({ error: 'No token provided' }) };
    }
    const token = authHeader.split(' ')[1];
    let decoded;
    try {
        decoded = jwt.verify(token, JWT_SECRET);
    } catch (e) {
        return { statusCode: 401, headers, body: JSON.stringify({ error: 'Invalid token' }) };
    }
    const id = decoded.uid;

    await driver.tableClient.withSession(async (session) => {
        const query = `
            DECLARE $id AS Utf8;
            DELETE FROM users WHERE id = $id;
        `;
        await session.executeQuery(query, {
            '$id': TypedValues.utf8(id)
        });
    });

    return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
}

async function me(driver, requestHeaders, headers) {
    const authHeader = requestHeaders['Authorization'] || requestHeaders['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return { statusCode: 401, headers, body: JSON.stringify({ error: 'No token provided' }) };
    }

    const token = authHeader.split(' ')[1];

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        const id = decoded.uid;

        let user = null;
        await driver.tableClient.withSession(async (session) => {
            const query = `
                DECLARE $id AS Utf8;
                SELECT * FROM users WHERE id = $id LIMIT 1;
            `;
            const { resultSets } = await session.executeQuery(query, {
                '$id': TypedValues.utf8(id)
            });
            const rows = decodeYdbResults(resultSets[0]);
            if (rows.length > 0) {
                user = rows[0];
            }
        });

        if (!user) {
            return { statusCode: 404, headers, body: JSON.stringify({ error: 'User not found' }) };
        }

        const tryParse = (val) => {
            if (!val) return [];
            if (Array.isArray(val)) return val;
            try {
                return JSON.parse(val);
            } catch (e) {
                console.error('Parse error for value:', val, e);
                return [];
            }
        };

        const responseUser = {
            uid: user.id,
            email: user.email,
            displayName: user.name,
            name: user.name,
            age: user.age,
            gender: user.gender,
            ethnicity: user.ethnicity,
            religions: tryParse(user.religion), // Map to plural
            zodiac: user.zodiac,
            about: user.about,
            bio: user.about, // compatibility
            job: user.job,
            interests: tryParse(user.interests),
            photos: tryParse(user.photos),
            macroGroups: tryParse(user.macro_groups), // Map to camelCase
            profile_completed: user.profile_completed,
            culturePride: user.culture_pride,
            loveLanguage: user.love_language,
            familyMemory: user.family_memory,
            stereotypeTrue: user.stereotype_true,
            stereotypeTrue: user.stereotype_true,
            stereotypeFalse: user.stereotype_false,
            isVisible: user.is_visible !== undefined ? user.is_visible : true,
            latitude: user.latitude,
            longitude: user.longitude,
            city: user.city,
            socialTelegram: user.social_telegram,
            socialVk: user.social_vk,
            socialInstagram: user.social_instagram
        };

        console.log('[/me] Returning user:', {
            name: responseUser.name,
            bio: responseUser.bio,
            culturePride: responseUser.culturePride,
            loveLanguage: responseUser.loveLanguage
        });


        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                user: responseUser
            })
        };
    } catch (e) {
        return { statusCode: 401, headers, body: JSON.stringify({ error: 'Invalid token' }) };
    }
}

async function telegramLogin(driver, data, headers) {
    const { id, first_name, last_name, username, photo_url, auth_date, hash } = data;

    if (!id) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing Telegram ID' }) };
    }

    const email = `tg_${id}@telegram.user`;
    const name = [first_name, last_name].filter(Boolean).join(' ');

    // Check if user exists
    let user = null;
    await driver.tableClient.withSession(async (session) => {
        const query = `
            DECLARE $email AS Utf8;
            SELECT * FROM users WHERE email = $email LIMIT 1;
        `;
        const { resultSets } = await session.executeQuery(query, {
            '$email': TypedValues.utf8(email)
        });
        const rows = decodeYdbResults(resultSets[0]);
        if (rows.length > 0) {
            user = rows[0];
        }
    });

    if (!user) {
        // Register new user
        const newId = require('crypto').randomUUID();
        const createdAt = new Date().toISOString();
        const passwordHash = 'TELEGRAM_AUTH'; // Placeholder

        console.log('[telegramLogin] Creating new user with telegram_id:', id);

        await driver.tableClient.withSession(async (session) => {
            const query = `
                DECLARE $id AS Utf8;
                DECLARE $email AS Utf8;
                DECLARE $password_hash AS Utf8;
                DECLARE $name AS Utf8;
                DECLARE $age AS Uint32;
                DECLARE $created_at AS Datetime;
                DECLARE $photo AS Utf8;
                DECLARE $telegram_id AS Utf8;

                INSERT INTO users (id, email, password_hash, name, age, created_at, photos, telegram_id)
                VALUES ($id, $email, $password_hash, $name, $age, $created_at, $photo, $telegram_id);
            `;

            // Wrap photo in array string as per schema
            const photoJson = photo_url ? JSON.stringify([photo_url]) : "[]";

            await session.executeQuery(query, {
                '$id': TypedValues.utf8(newId),
                '$email': TypedValues.utf8(email),
                '$password_hash': TypedValues.utf8(passwordHash),
                '$name': TypedValues.utf8(name || 'Telegram User'),
                '$age': TypedValues.uint32(18), // Default age
                '$created_at': TypedValues.datetime(new Date(createdAt)),
                '$photo': TypedValues.utf8(photoJson),
                '$telegram_id': TypedValues.utf8(String(id))
            });
        });

        user = { uid: newId, email, name, age: 18 };
    } else {
        // Update telegram_id for existing user (if not set)
        console.log('[telegramLogin] Updating telegram_id for existing user:', user.id);
        await driver.tableClient.withSession(async (session) => {
            const query = `
                DECLARE $id AS Utf8;
                DECLARE $telegram_id AS Utf8;
                UPDATE users SET telegram_id = $telegram_id WHERE id = $id;
            `;
            await session.executeQuery(query, {
                '$id': TypedValues.utf8(user.id),
                '$telegram_id': TypedValues.utf8(String(id))
            });
        });
    }

    // Generate real JWT
    const token = jwt.sign({ uid: user.id || user.uid, email: user.email }, JWT_SECRET, { expiresIn: '30d' });

    // Fetch full profile for client
    let fullUser = null;
    await driver.tableClient.withSession(async (session) => {
        const query = `
            DECLARE $id AS Utf8;
            SELECT * FROM users WHERE id = $id LIMIT 1;
        `;
        const { resultSets } = await session.executeQuery(query, {
            '$id': TypedValues.utf8(user.id || user.uid)
        });
        const rows = decodeYdbResults(resultSets[0]);
        if (rows.length > 0) fullUser = rows[0];
    });

    if (!fullUser) fullUser = user;

    const tryParse = (val) => {
        if (!val) return [];
        if (Array.isArray(val)) return val;
        try { return JSON.parse(val); } catch (e) { return []; }
    };

    return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
            token,
            user: {
                uid: fullUser.id,
                email: fullUser.email,
                displayName: fullUser.name,
                name: fullUser.name,
                age: fullUser.age,
                gender: fullUser.gender,
                ethnicity: fullUser.ethnicity,
                religions: tryParse(fullUser.religion),
                zodiac: fullUser.zodiac,
                about: fullUser.about,
                bio: fullUser.about,
                job: fullUser.job,
                interests: tryParse(fullUser.interests),
                photos: tryParse(fullUser.photos),
                macroGroups: tryParse(fullUser.macro_groups),
                profile_completed: fullUser.profile_completed,
                culturePride: fullUser.culture_pride,
                loveLanguage: fullUser.love_language,
                familyMemory: fullUser.family_memory,
                stereotypeTrue: fullUser.stereotype_true,
                stereotypeFalse: fullUser.stereotype_false
            }
        })
    };
}

async function handleWebhook(update, headers) {
    console.log('[Webhook] Received update:', JSON.stringify(update));

    if (update.message && update.message.text === '/start') {
        const chatId = update.message.chat.id;
        console.log('[Webhook] Processing /start for chat:', chatId);
        await notifyStart(chatId);
    }

    return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ status: 'ok' })
    };
}
