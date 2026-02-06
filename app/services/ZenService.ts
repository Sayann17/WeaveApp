import { yandexAuth } from './yandex/AuthService';

const API_URL = 'https://d5dg37j92h7tg2f7sf87.o2p3jdjj.apigw.yandexcloud.net';

export interface ZenQuote {
    id: string;
    text: string;
    theme: string;
}

export const ZenService = {
    /**
     * Checks if the user should see the Zen screen by calling the backend.
     * Also returns the quote if available.
     */
    getZenState: async (): Promise<{ shouldShow: boolean, quote?: ZenQuote }> => {
        try {
            console.log('[ZenService] Checking status at:', `${API_URL}/zen/quote`);
            const token = await yandexAuth.getToken();

            if (!token) {
                console.log('[ZenService] No token available, skipping.');
                return { shouldShow: false };
            }

            const response = await fetch(`${API_URL}/zen/quote`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            console.log('[ZenService] Status:', response.status);

            if (response.ok) {
                const data = await response.json();
                console.log('[ZenService] Data:', data);
                return data; // { shouldShow, quote }
            } else {
                const text = await response.text();
                console.error('[ZenService] Error response:', text);
            }
            return { shouldShow: false }; // Fail safe
        } catch (error) {
            console.error('[ZenService] Network/Logic Error:', error);
            return { shouldShow: false };
        }
    },

    /**
     * Marks the Zen screen as seen on the backend.
     */
    completeZen: async (quoteId?: string): Promise<void> => {
        try {
            const token = await yandexAuth.getToken();
            if (!token) return;

            await fetch(`${API_URL}/zen/complete`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ quoteId })
            });
        } catch (error) {
            console.error('Error completing Zen:', error);
        }
    },

    // Legacy method for compatibility with _layout until full refactor
    shouldShowZen: async (): Promise<boolean> => {
        const state = await ZenService.getZenState();
        return state.shouldShow;
    }
};
