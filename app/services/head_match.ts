import { getZodiacSignById } from '../utils/basic_info';
import { yandexMatch } from './yandex/MatchService';

export interface LikeResult {
  type: 'like' | 'match' | 'already_liked' | 'error';
  targetUserName?: string;
  targetUserPhoto?: string;
  chatId?: string;
}

export interface DislikeResult {
  type: 'dislike' | 'already_disliked' | 'error';
}

class MatchService {
  /**
   * 🔥 АЛГОРИТМ КУЛЬТУРНОГО СОВПАДЕНИЯ (V2)
   */
  public calculateCulturalScore(currentUserData: any, targetUserData: any): number {
    let score = 0;

    // 1. Сравнение Макрогрупп (База: +5 баллов)
    const userAMacroGroups: string[] = currentUserData.macroGroups || [];
    const userBMacroGroups: string[] = targetUserData.macroGroups || [];

    const commonGroups = userAMacroGroups.filter(id => userBMacroGroups.includes(id));
    score += 5 * commonGroups.length;

    // 2. Сравнение Текста Национальности (+15 баллов - Бинго!)
    const textA = (currentUserData.customEthnicity || '').trim().toLowerCase();
    const textB = (targetUserData.customEthnicity || '').trim().toLowerCase();

    if (textA && textB && textA === textB) {
      score += 15;
    }

    // 3. Совпадение по Религии (+3 балла - Точное, +1 - Духовное)
    const userAReligions: string[] = currentUserData.religions || [];
    const userBReligions: string[] = targetUserData.religions || [];
    const commonReligions = userAReligions.filter(id => userBReligions.includes(id));
    score += 3 * commonReligions.length;

    // 4. Совпадение по Интересам (+1 балл)
    const userAInterests: string[] = currentUserData.interests || [];
    const userBInterests: string[] = targetUserData.interests || [];
    const commonInterests = userAInterests.filter(id => userBInterests.includes(id));
    score += 1 * commonInterests.length;

    // 5. 🔮 Зодиакальная Совместимость (+3 балла)
    const zodiacA = getZodiacSignById(currentUserData.zodiac);
    const zodiacB = getZodiacSignById(targetUserData.zodiac);

    if (zodiacA && zodiacB) {
      // @ts-ignore
      const elA = zodiacA.element;
      // @ts-ignore
      const elB = zodiacB.element;

      if (elA === elB) {
        score += 3; // Одна стихия
      } else if (
        (elA === 'fire' && elB === 'air') || (elA === 'air' && elB === 'fire') ||
        (elA === 'earth' && elB === 'water') || (elA === 'water' && elB === 'earth')
      ) {
        score += 3; // Комплементарные стихии
      }
    }

    // 6. 📅 Возрастная Близость
    const ageA = Number(currentUserData.age);
    const ageB = Number(targetUserData.age);
    if (!isNaN(ageA) && !isNaN(ageB)) {
      const diff = Math.abs(ageA - ageB);
      if (diff <= 5) score += 5;
      else if (diff <= 10) score += 2;
    }

    // 7. 🗣️ "Vibe Check" - совпадение слов в био и хуках
    const getWords = (text: string) => (text || '').toLowerCase().split(/\s+/).filter(w => w.length > 3);
    const keywordsA = new Set([
      ...getWords(currentUserData.bio),
      ...getWords(currentUserData.dreamDinner),
      ...getWords(currentUserData.perfectSunday)
    ]);
    const keywordsB = new Set([
      ...getWords(targetUserData.bio),
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

  public sortProfilesByCulturalScore(currentUserData: any, profiles: any[]): any[] {
    return profiles
      .map(profile => ({
        ...profile,
        score: this.calculateCulturalScore(currentUserData, profile)
      }))
      .sort((a, b) => b.score - a.score);
  }

  /**
   * Лайк через Yandex Cloud
   */
  async likeUser(targetUserId: string): Promise<LikeResult> {
    try {
      const result = await yandexMatch.likeUser(targetUserId);
      return {
        type: result.type,
        chatId: result.chatId
      };
    } catch (error: any) {
      console.error('Error in likeUser:', error);
      return { type: 'error' };
    }
  }

  /**
   * Дизлайк через Yandex Cloud
   */
  async dislikeUser(targetUserId: string): Promise<DislikeResult> {
    try {
      await yandexMatch.dislikeUser(targetUserId);
      return { type: 'dislike' };
    } catch (error: any) {
      console.error('Error in dislikeUser:', error);
      return { type: 'error' };
    }
  }
}

export const enhancedMatchService = new MatchService();

// Совместимость со старым explore.tsx
export const likeUser = (targetUserId: string) => enhancedMatchService.likeUser(targetUserId);
export const dislikeUser = (targetUserId: string) => enhancedMatchService.dislikeUser(targetUserId);
