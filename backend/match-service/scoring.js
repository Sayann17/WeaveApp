
// backend/match-service/scoring.js

// ------------------------------------------------------------------
// DATA CONSTANTS (Ported from frontend basic_info.ts)
// ------------------------------------------------------------------

const zodiacSigns = [
    { id: 'aries', element: 'fire' },
    { id: 'taurus', element: 'earth' },
    { id: 'gemini', element: 'air' },
    { id: 'cancer', element: 'water' },
    { id: 'leo', element: 'fire' },
    { id: 'virgo', element: 'earth' },
    { id: 'libra', element: 'air' },
    { id: 'scorpio', element: 'water' },
    { id: 'sagittarius', element: 'fire' },
    { id: 'capricorn', element: 'earth' },
    { id: 'aquarius', element: 'air' },
    { id: 'pisces', element: 'water' },
];

const getZodiacSignById = (id) => {
    if (!id) return null;
    return zodiacSigns.find(z => z.id === id.toLowerCase());
};

// ------------------------------------------------------------------
// SCORING LOGIC (Ported from frontend head_match.ts)
// ------------------------------------------------------------------

function calculateCulturalScore(currentUserData, targetUserData) {
    let score = 0;

    // 1. Comparison of MacroGroups (Base: +5 points)
    const userAMacroGroups = currentUserData.macroGroups || [];
    const userBMacroGroups = targetUserData.macroGroups || [];

    // Parse if string JSON (safeguard)
    const parseArr = (arr) => {
        if (Array.isArray(arr)) return arr;
        try { return JSON.parse(arr); } catch (e) { return []; }
    };

    const groupsA = parseArr(userAMacroGroups);
    const groupsB = parseArr(userBMacroGroups);

    const commonGroups = groupsA.filter(id => groupsB.includes(id));
    score += 5 * commonGroups.length;

    // 2. Comparison of Ethnicity Text (+15 points - Bingo!)
    const textA = (currentUserData.customEthnicity || '').trim().toLowerCase();
    const textB = (targetUserData.customEthnicity || '').trim().toLowerCase();

    if (textA && textB && textA === textB) {
        score += 15;
    }

    // 3. Comparison by Religion (+3 points)
    const relA = parseArr(currentUserData.religions || currentUserData.religion); // Handle potential field mismatch
    const relB = parseArr(targetUserData.religions || targetUserData.religion);
    const commonReligions = relA.filter(id => relB.includes(id));
    score += 3 * commonReligions.length;

    // 4. Comparison by Interests (+1 point)
    const interestsA = parseArr(currentUserData.interests);
    const interestsB = parseArr(targetUserData.interests);
    const commonInterests = interestsA.filter(id => interestsB.includes(id));
    score += 1 * commonInterests.length;

    // 5. Zodiac Compatibility (+3 points)
    const zodiacA = getZodiacSignById(currentUserData.zodiac);
    const zodiacB = getZodiacSignById(targetUserData.zodiac);

    if (zodiacA && zodiacB) {
        const elA = zodiacA.element;
        const elB = zodiacB.element;

        if (elA === elB) {
            score += 3; // Same element
        } else if (
            (elA === 'fire' && elB === 'air') || (elA === 'air' && elB === 'fire') ||
            (elA === 'earth' && elB === 'water') || (elA === 'water' && elB === 'earth')
        ) {
            score += 3; // Complementary elements
        }
    }

    // 6. Age Closeness
    const ageA = Number(currentUserData.age);
    const ageB = Number(targetUserData.age);
    if (!isNaN(ageA) && !isNaN(ageB)) {
        const diff = Math.abs(ageA - ageB);
        if (diff <= 5) score += 5;
        else if (diff <= 10) score += 2;
    }

    // 7. Vibe Check - Matching words in bio
    const getWords = (text) => (text || '').toLowerCase().split(/\s+/).filter(w => w.length > 3);
    const keywordsA = new Set([
        ...getWords(currentUserData.bio || currentUserData.about),
        ...getWords(currentUserData.dreamDinner),
        ...getWords(currentUserData.perfectSunday)
    ]);
    const keywordsB = new Set([
        ...getWords(targetUserData.bio || targetUserData.about),
        ...getWords(targetUserData.dreamDinner),
        ...getWords(targetUserData.perfectSunday)
    ]);

    let sharedKeywords = 0;
    keywordsA.forEach(word => {
        if (keywordsB.has(word)) sharedKeywords++;
    });
    score += 2 * sharedKeywords;

    return score;
}

module.exports = {
    calculateCulturalScore
};
