import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { IAuthService, User } from '../interfaces/IAuthService';

const API_URL = 'https://d5dg37j92h7tg2f7sf87.o2p3jdjj.apigw.yandexcloud.net';

class YandexAuthService implements IAuthService {
    private _currentUser: User | null = null;
    private _listeners: ((user: User | null) => void)[] = [];

    constructor() {
        // Skip session load on server-side (Next.js/Expo Router SSG)
        if (Platform.OS === 'web' && typeof window === 'undefined') {
            return;
        }
        this._loadSession();
    }

    get user(): User | null {
        return this._currentUser;
    }

    async getToken(): Promise<string | null> {
        return AsyncStorage.getItem('auth_token');
    }

    async telegramLogin(tgUser: any): Promise<void> {
        try {
            console.log('Authenticating with backend via Telegram...', tgUser);

            const response = await fetch(`${API_URL}/telegram-login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(tgUser),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Telegram auth failed on server');
            }

            if (data.token && data.user) {
                this._currentUser = this._transformUser(data.user);
                await AsyncStorage.setItem('auth_token', data.token);
                this._notifyListeners();
                console.log('Telegram login successful, token saved');
            } else {
                throw new Error('Invalid response from server');
            }
        } catch (error) {
            console.error('Telegram Login Error:', error);
            throw error;
        }
    }
    private async _loadSession() {
        if (Platform.OS === 'web' && typeof window === 'undefined') return;

        try {
            const token = await AsyncStorage.getItem('auth_token');
            console.log('[AuthService] Loading session, token exists:', !!token);

            if (token) {
                // Verify token with backend
                const response = await fetch(`${API_URL}/me`, {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });

                console.log('[AuthService] /me response status:', response.status);

                if (response.ok) {
                    const data = await response.json();
                    console.log('[AuthService] /me response data:', { hasUser: !!data?.user, uid: data?.user?.uid });

                    if (data && data.user) {
                        this._currentUser = this._transformUser(data.user);
                        this._notifyListeners();
                        console.log('[AuthService] User loaded successfully');
                    } else {
                        console.error('[AuthService] Invalid user data from backend:', data);
                        // Don't clear token blindly on malformed data, but maybe we should?
                        // Safe bet: keep token, retry later? Or clear?
                        // If data is invalid structure, maybe backend is broken. 
                        // Let's NOT clear token here unless we are sure.
                    }
                } else {
                    // Token invalid only if 401
                    if (response.status === 401) {
                        console.log('[AuthService] Token expired or invalid (401), clearing');
                        this._currentUser = null;
                        this._notifyListeners();
                        await AsyncStorage.removeItem('auth_token');
                    } else {
                        console.log(`[AuthService] Server returned ${response.status}, keeping token`);
                    }
                }
            } else {
                // No token
                console.log('[AuthService] No token found');
                this._currentUser = null;
                this._notifyListeners();
            }
        } catch (e) {
            console.error('[AuthService] Failed to load session (network/other)', e);
            // DO NOT clear token on network error! 
            // Keep _currentUser as null (or previous?), but don't logout.
            // If we have no cached user, we can't do much, but we shouldn't destroy the session.
        }
    }

    getCurrentUser(): User | null {
        return this._currentUser;
    }



    async logout(): Promise<void> {
        this._currentUser = null;
        await AsyncStorage.removeItem('auth_token');
        this._notifyListeners();
    }

    async deleteAccount(): Promise<void> {
        const token = await AsyncStorage.getItem('auth_token');
        if (!token) throw new Error('Not authenticated');

        const response = await fetch(`${API_URL}/me`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            const data = await response.json().catch(() => ({}));
            throw new Error(data.error || 'Failed to delete account');
        }

        await this.logout();
    }

    onAuthStateChanged(callback: (user: User | null) => void): () => void {
        this._listeners.push(callback);
        // Immediate callback
        callback(this._currentUser);

        return () => {
            this._listeners = this._listeners.filter(l => l !== callback);
        };
    }

    private _notifyListeners() {
        this._listeners.forEach(listener => listener(this._currentUser));
    }
    async refreshSession(): Promise<void> {
        await this._loadSession();
    }

    async updateProfile(data: Partial<User> & Record<string, any>): Promise<void> {
        console.log('[AuthService] updateProfile called with:', Object.keys(data));
        const token = await AsyncStorage.getItem('auth_token');
        if (!token) throw new Error('Not authenticated');

        // OPTIMISTIC UPDATE: Update local state BEFORE server call for instant UI feedback
        const previousUser = this._currentUser ? { ...this._currentUser } : null;
        if (this._currentUser) {
            // Merge new data with existing user data to preserve all fields
            this._currentUser = { ...this._currentUser, ...data };
            this._notifyListeners();
            console.log('[AuthService] Optimistic update applied, UI updated instantly');
        }

        try {
            const response = await fetch(`${API_URL}/profile`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(data)
            });

            console.log('[AuthService] updateProfile response status:', response.status);

            if (!response.ok) {
                const text = await response.text();
                console.error('[AuthService] Update profile failed:', response.status, text);

                // ROLLBACK: Restore previous state on error
                if (previousUser) {
                    this._currentUser = previousUser;
                    this._notifyListeners();
                    console.log('[AuthService] Rolled back optimistic update due to server error');
                }

                throw new Error(`Failed to update profile: ${response.status} ${text}`);
            }

            console.log('[AuthService] Profile successfully saved to server');
            // No refreshSession here - it causes race conditions when multiple fields are updated quickly
            // The optimistic update already has the correct data merged
        } catch (e) {
            // If it's a network error (not thrown by us above), also rollback
            if (previousUser && e instanceof Error && !e.message.startsWith('Failed to update profile')) {
                this._currentUser = previousUser;
                this._notifyListeners();
                console.log('[AuthService] Rolled back optimistic update due to network error');
            }
            throw e;
        }
    }

    private _transformUser(user: any): User {
        const tryParse = (val: any) => {
            if (!val) return [];
            if (Array.isArray(val)) return val;
            try {
                return JSON.parse(val);
            } catch (e) {
                return [];
            }
        };

        return {
            ...user,
            photos: tryParse(user.photos),
            interests: tryParse(user.interests),
            religions: tryParse(user.religions || user.religion),
            macroGroups: tryParse(user.macroGroups || user.macro_groups),
            isVisible: user.isVisible,
            latitude: user.latitude,
            longitude: user.longitude,
            city: user.city,
            socialTelegram: user.socialTelegram || user.social_telegram,
            socialVk: user.socialVk || user.social_vk,
            socialInstagram: user.socialInstagram || user.social_instagram,
            events: tryParse(user.events)
        };
    }
}

export const yandexAuth = new YandexAuthService();
