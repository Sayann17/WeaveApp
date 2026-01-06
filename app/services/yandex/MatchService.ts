import AsyncStorage from '@react-native-async-storage/async-storage';

const API_URL = 'https://d5dg37j92h7tg2f7sf87.o2p3jdjj.apigw.yandexcloud.net';

export interface MatchResult {
    type: 'like' | 'match' | 'already_liked' | 'error';
    chatId?: string;
}

class YandexMatchService {
    async likeUser(targetUserId: string): Promise<MatchResult> {
        console.log('[MatchService] Sending like to:', targetUserId);
        const token = await AsyncStorage.getItem('auth_token');
        console.log('[MatchService] Token:', token ? 'present' : 'missing');

        const url = `${API_URL}/like`;
        console.log('[MatchService] POST', url);

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ targetUserId })
        });

        console.log('[MatchService] Response status:', response.status);

        if (!response.ok) {
            const err = await response.json();
            console.error('[MatchService] Like failed:', err);
            throw new Error(err.error || 'Like failed');
        }

        const result = await response.json();
        console.log('[MatchService] Like result:', result);
        return {
            type: result.isMatch ? 'match' : 'like',
            chatId: result.chatId
        };
    }

    async dislikeUser(targetUserId: string): Promise<void> {
        const token = await AsyncStorage.getItem('auth_token');
        const response = await fetch(`${API_URL}/dislike`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ targetUserId })
        });

        if (!response.ok) {
            const err = await response.json().catch(() => ({ error: 'Dislike failed' }));
            console.error('[MatchService] Dislike failed:', err);
            throw new Error(err.error || 'Dislike failed');
        }
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
    async getYourLikes(): Promise<any[]> {
        const token = await AsyncStorage.getItem('auth_token');
        const response = await fetch(`${API_URL}/your-likes`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) {
            throw new Error(`Failed to fetch sent likes: ${response.status}`);
        }
        const data = await response.json();
        return data.profiles || [];
    }
}

export const yandexMatch = new YandexMatchService();
