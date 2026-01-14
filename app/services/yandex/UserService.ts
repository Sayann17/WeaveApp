import AsyncStorage from '@react-native-async-storage/async-storage';
import { IUserService, SearchFilters, UserProfile } from '../interfaces';
import { yandexAuth } from './AuthService';

export class YandexUserService implements IUserService {
    async getCurrentUser(): Promise<UserProfile | null> {
        const user = yandexAuth.getCurrentUser();
        if (!user) return null;
        return this.mapToUserProfile(user.uid, user);
    }

    async getUser(userId: string): Promise<UserProfile | null> {
        const token = await AsyncStorage.getItem('auth_token');
        const response = await fetch(`https://d5dg37j92h7tg2f7sf87.o2p3jdjj.apigw.yandexcloud.net/profile?userId=${userId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) return null;
        const data = await response.json();
        return this.mapToUserProfile(userId, data);
    }

    async updateProfile(userId: string, data: Partial<UserProfile>): Promise<void> {
        await yandexAuth.updateProfile(data);
    }

    async getPotentialMatches(currentUserId: string, filters: SearchFilters): Promise<UserProfile[]> {
        try {
            const token = await AsyncStorage.getItem('auth_token');
            const queryParams = new URLSearchParams();
            if (filters.gender) queryParams.append('gender', filters.gender);
            if (filters.minAge) queryParams.append('minAge', filters.minAge.toString());
            if (filters.maxAge) queryParams.append('maxAge', filters.maxAge.toString());
            if (filters.ethnicity) queryParams.append('ethnicity', filters.ethnicity);
            if (filters.religion) queryParams.append('religion', filters.religion);
            if (filters.offset) queryParams.append('offset', filters.offset.toString());

            const url = `https://d5dg37j92h7tg2f7sf87.o2p3jdjj.apigw.yandexcloud.net/discovery?${queryParams.toString()}`;
            console.log('[UserService] Fetching discovery:', url);
            console.log('[UserService] Token present:', !!token);

            const response = await fetch(url, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            console.log('[UserService] Response status:', response.status);

            if (!response.ok) {
                console.error('[UserService] Response not OK:', response.status, response.statusText);
                return [];
            }

            const data = await response.json();
            console.log('[UserService] Profiles received:', data.profiles?.length || 0);
            return data.profiles || [];
        } catch (error) {
            console.error('[UserService] Error fetching discovery:', error);
            return [];
        }
    }

    private mapToUserProfile(id: string, data: any): UserProfile {
        const tryParse = (val: any) => {
            if (!val) return [];
            if (Array.isArray(val)) return val;
            try { return JSON.parse(val); } catch (e) { return []; }
        };

        return {
            id: id,
            name: data.name || data.displayName,
            age: data.age,
            photos: tryParse(data.photos),
            bio: data.about,
            gender: data.gender,
            macroGroups: tryParse(data.macroGroups || data.macro_groups),
            ethnicity: data.ethnicity,
            customEthnicity: data.ethnicity,
            zodiac: data.zodiac,
            religions: tryParse(data.religions || data.religion),
            interests: tryParse(data.interests),
            profileCompleted: !!(data.profile_completed),
            culturePride: data.culture_pride || data.culturePride,
            loveLanguage: data.love_language || data.loveLanguage,
            familyMemory: data.family_memory || data.familyMemory,
            stereotypeTrue: data.stereotype_true || data.stereotypeTrue,
            stereotypeFalse: data.stereotype_false || data.stereotypeFalse,
            latitude: data.latitude,
            longitude: data.longitude,
            city: data.city,
            socialTelegram: data.socialTelegram || data.social_telegram,
            socialVk: data.socialVk || data.social_vk,
            socialInstagram: data.socialInstagram || data.social_instagram,
            likes: [], // To be implemented
            dislikes: [] // To be implemented
        };
    }
}
