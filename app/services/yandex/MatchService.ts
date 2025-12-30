import AsyncStorage from '@react-native-async-storage/async-storage';

const API_URL = 'https://d5dg37j92h7tg2f7sf87.o2p3jdjj.apigw.yandexcloud.net';

export interface MatchResult {
    type: 'like' | 'match' | 'already_liked' | 'error';
    chatId?: string;
}

class YandexMatchService {
    async likeUser(targetUserId: string): Promise<MatchResult> {
        const token = await AsyncStorage.getItem('auth_token');
        const response = await fetch(`${API_URL}/like`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ targetUserId })
        });

        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error || 'Like failed');
        }

        return await response.json();
    }

    async dislikeUser(targetUserId: string): Promise<void> {
        const token = await AsyncStorage.getItem('auth_token');
        await fetch(`${API_URL}/dislike`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ targetUserId })
        });
    }

    async getMatches(): Promise<any[]> {
        const token = await AsyncStorage.getItem('auth_token');
        const response = await fetch(`${API_URL}/matches`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) throw new Error('Failed to fetch matches');
        const data = await response.json();
        return data.matches || [];
    }

    async getLikesYou(): Promise<any[]> {
        const token = await AsyncStorage.getItem('auth_token');
        const response = await fetch(`${API_URL}/likes-you`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) {
            let errorMsg = `Failed to fetch likes: ${response.status}`;
            try {
                const data = await response.json();
                if (data.error) errorMsg += ` - ${data.error}`;
            } catch (e) {
                // If not JSON, try to get text
                try {
                    const text = await response.text();
                    if (text) errorMsg += ` - ${text.substring(0, 100)}`;
                } catch (e2) { }
            }
            throw new Error(errorMsg);
        }
        const data = await response.json();
        return data.profiles || [];
    }
}

export const yandexMatch = new YandexMatchService();
