import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { IAuthService, User } from '../interfaces/IAuthService';

const API_URL = 'https://d5dg37j92h7tg2f7sf87.o2p3jdjj.apigw.yandexcloud.net';

// Retry helper for network requests
async function withRetry<T>(
    fn: () => Promise<T>,
    options: { maxRetries?: number; delayMs?: number; shouldRetry?: (error: any) => boolean } = {}
): Promise<T> {
    const { maxRetries = 3, delayMs = 1000, shouldRetry = () => true } = options;
    let lastError: any;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error;
            console.log(`[Retry] Attempt ${attempt}/${maxRetries} failed:`, error);

            // Don't retry if it's a business logic error (ban, auth, etc.)
            if (!shouldRetry(error)) {
                throw error;
            }

            if (attempt < maxRetries) {
                console.log(`[Retry] Waiting ${delayMs}ms before retry...`);
                await new Promise(resolve => setTimeout(resolve, delayMs));
            }
        }
    }

    throw lastError;
}

class YandexAuthService implements IAuthService {
    private _currentUser: User | null = null;
    private _listeners: ((user: User | null) => void)[] = [];
    private _cachedToken: string | null = null; // In-memory token cache to avoid AsyncStorage delays

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
        // Return cached token first for instant access
        if (this._cachedToken) {
            return this._cachedToken;
        }
        // Fallback to AsyncStorage
        const token = await AsyncStorage.getItem('auth_token');
        if (token) {
            this._cachedToken = token;
        }
        return token;
    }

    async telegramLogin(tgUser: any): Promise<void> {
        await withRetry(
            async () => {
                console.log('Authenticating with backend via Telegram...');

                const response = await fetch(`${API_URL}/telegram-login`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(tgUser),
                });

                const data = await response.json();

                if (!response.ok) {
                    if (data.isBanned) {
                        const error = new Error(data.error || 'Account banned');
                        // @ts-ignore
                        error.isBanned = true;
                        // @ts-ignore
                        error.reason = data.reason;
                        throw error;
                    }
                    throw new Error(data.error || 'Telegram auth failed on server');
                }

                if (data.token && data.user) {
                    this._currentUser = this._transformUser(data.user);
                    // Cache token in memory FIRST for instant access
                    this._cachedToken = data.token;
                    await AsyncStorage.setItem('auth_token', data.token);
                    this._notifyListeners();
                    console.log('Telegram login successful, token saved and cached');
                } else {
                    throw new Error('Invalid response from server');
                }
            },
            {
                maxRetries: 3,
                delayMs: 1500,
                // Don't retry on ban or explicit auth failures
                shouldRetry: (error) => {
                    if (error?.isBanned) return false;
                    if (error?.message?.includes('banned')) return false;
                    return true;
                }
            }
        );
    }
    private async _loadSession() {
        if (Platform.OS === 'web' && typeof window === 'undefined') return;

        try {
            const token = await AsyncStorage.getItem('auth_token');
            // Cache the token in memory
            this._cachedToken = token;
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
        this._cachedToken = null; // Clear cached token
        await AsyncStorage.removeItem('auth_token');
        this._notifyListeners();
    }

    async deleteAccount(): Promise<void> {
        const token = await this.getToken(); // Use cached token method
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

        // OPTIMISTIC UPDATE: Update local state BEFORE server call for instant UI feedback
        const previousUser = this._currentUser ? { ...this._currentUser } : null;
        if (this._currentUser) {
            this._currentUser = { ...this._currentUser, ...data };
            this._notifyListeners();
            console.log('[AuthService] Optimistic update applied, UI updated instantly');
        }

        try {
            await withRetry(
                async () => {
                    const token = await this.getToken(); // Use cached token for instant access
                    if (!token) throw new Error('Not authenticated');

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

                        // Don't retry on 401 (auth error) or 4xx client errors
                        if (response.status === 401) {
                            const error = new Error('Not authenticated');
                            // @ts-ignore
                            error.noRetry = true;
                            throw error;
                        }
                        if (response.status >= 400 && response.status < 500) {
                            const error = new Error(`Failed to update profile: ${response.status} ${text}`);
                            // @ts-ignore
                            error.noRetry = true;
                            throw error;
                        }

                        throw new Error(`Failed to update profile: ${response.status} ${text}`);
                    }

                    console.log('[AuthService] Profile successfully saved to server');
                },
                {
                    maxRetries: 3,
                    delayMs: 1000,
                    shouldRetry: (error) => {
                        // @ts-ignore
                        if (error?.noRetry) return false;
                        if (error?.message === 'Not authenticated') return false;
                        return true;
                    }
                }
            );
        } catch (e) {
            // ROLLBACK: Restore previous state on final failure
            if (previousUser) {
                this._currentUser = previousUser;
                this._notifyListeners();
                console.log('[AuthService] Rolled back optimistic update due to error');
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
            events: tryParse(user.events),
            is_admin: user.is_admin
        };
    }
}

export const yandexAuth = new YandexAuthService();
