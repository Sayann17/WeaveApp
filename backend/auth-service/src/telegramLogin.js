const { TypedValues, TypedData } = require('ydb-sdk');
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('./auth');
const { success, error } = require('../utils/response');

async function telegramLogin(driver, data, responseHeaders) {
    const { id, first_name, last_name, username, photo_url, auth_date, hash } = data;

    if (!id) {
        return error(400, 'Missing Telegram ID', responseHeaders);
    }

    const email = `tg_${id}@telegram.user`;
    const name = [first_name, last_name].filter(Boolean).join(' ');

    let token, fullUser;

    // All database operations in ONE session
    await driver.tableClient.withSession(async (session) => {
        // Step 1: Check if user exists
        const checkQuery = `
            DECLARE $email AS Utf8;
            SELECT * FROM users WHERE email = $email LIMIT 1;
        `;
        const { resultSets: checkResults } = await session.executeQuery(checkQuery, {
            '$email': TypedValues.utf8(email)
        });
        const existingUsers = TypedData.createNativeObjects(checkResults[0]);

        let userId;

        if (existingUsers.length === 0) {
            // Step 2a: Create new user
            userId = require('crypto').randomUUID();
            const createdAt = new Date().toISOString();
            const passwordHash = 'TELEGRAM_AUTH';
            const photoJson = photo_url ? JSON.stringify([photo_url]) : "[]";

            console.log('[telegramLogin] Creating new user with telegram_id:', id);

            const insertQuery = `
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

            await session.executeQuery(insertQuery, {
                '$id': TypedValues.utf8(userId),
                '$email': TypedValues.utf8(email),
                '$password_hash': TypedValues.utf8(passwordHash),
                '$name': TypedValues.utf8(name || 'Telegram User'),
                '$age': TypedValues.uint32(18),
                '$created_at': TypedValues.datetime(new Date(createdAt)),
                '$photo': TypedValues.utf8(photoJson),
                '$telegram_id': TypedValues.utf8(String(id))
            });
        } else {
            // Step 2b: Update existing user's telegram_id
            userId = existingUsers[0].id;
            console.log('[telegramLogin] Updating telegram_id for existing user:', userId);

            const updateQuery = `
                DECLARE $id AS Utf8;
                DECLARE $telegram_id AS Utf8;
                UPDATE users SET telegram_id = $telegram_id WHERE id = $id;
            `;
            await session.executeQuery(updateQuery, {
                '$id': TypedValues.utf8(userId),
                '$telegram_id': TypedValues.utf8(String(id))
            });
        }

        // Step 3: Fetch full user profile (in same session)
        const profileQuery = `
            DECLARE $id AS Utf8;
            SELECT * FROM users WHERE id = $id LIMIT 1;
        `;
        const { resultSets: profileResults } = await session.executeQuery(profileQuery, {
            '$id': TypedValues.utf8(userId)
        });
        const profiles = TypedData.createNativeObjects(profileResults[0]);
        fullUser = profiles[0];
    });

    // Generate JWT
    token = jwt.sign({ uid: fullUser.id, email: fullUser.email }, JWT_SECRET, { expiresIn: '30d' });

    const tryParse = (val) => {
        if (!val) return [];
        if (Array.isArray(val)) return val;
        try { return JSON.parse(val); } catch (e) { return []; }
    };

    return success({
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
            stereotypeFalse: fullUser.stereotype_false,
            isVisible: fullUser.is_visible !== undefined ? fullUser.is_visible : true,
            latitude: fullUser.latitude,
            longitude: fullUser.longitude,
            city: fullUser.city,
            socialTelegram: fullUser.social_telegram,
            socialVk: fullUser.social_vk,
            socialInstagram: fullUser.social_instagram
        }
    }, responseHeaders);
}

module.exports = { telegramLogin };
