
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
  /* 
   * 🔥 SCORING MOVED TO BACKEND (backend/match-service/scoring.js)
   * This file now only handles Likes/Dislikes interactions.
   */


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
