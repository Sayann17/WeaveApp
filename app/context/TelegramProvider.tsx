import { useRouter } from 'expo-router';
import { createContext, useContext, useEffect, useState } from 'react';
import { Platform } from 'react-native';

let WebApp: any = null;
if (Platform.OS === 'web') {
    try {
        WebApp = require('@twa-dev/sdk').default;
    } catch (e) {
        console.error('Failed to load @twa-dev/sdk', e);
    }
}

interface TelegramContextType {
    isTelegram: boolean;
    user: any;
    webApp: typeof WebApp | null;
    initData: string;
    initDataUnsafe: any;
    colorScheme: 'light' | 'dark';
    showBackButton: () => void;
    hideBackButton: () => void;
    setBackButtonHandler: (handler: (() => void) | null) => void;
}

const TelegramContext = createContext<TelegramContextType>({
    isTelegram: false,
    user: null,
    webApp: null,
    initData: '',
    initDataUnsafe: {},
    colorScheme: 'light',
    showBackButton: () => { },
    hideBackButton: () => { },
    setBackButtonHandler: () => { },
});

export const useTelegram = () => useContext(TelegramContext);

export function TelegramProvider({ children }: { children: React.ReactNode }) {
    const [isTelegram, setIsTelegram] = useState(false);
    const [colorScheme, setColorScheme] = useState<'light' | 'dark'>('light');
    const [customBackHandler, setCustomBackHandler] = useState<(() => void) | null>(null);
    const router = useRouter();

    useEffect(() => {
        // Check if running on web and if Telegram WebApp is available
        const checkTelegram = () => {
            if (Platform.OS === 'web' && typeof window !== 'undefined' && (window as any).Telegram?.WebApp) {
                // Determine if we are really inside Telegram by checking initData or platform
                // (initData might be empty during local dev, but WebApp object exists)
                setIsTelegram(true);

                try {
                    WebApp.ready();

                    // Force expand to fullscreen
                    WebApp.expand();

                    // Enable fullscreen mode if available
                    if (WebApp.isExpanded === false) {
                        setTimeout(() => WebApp.expand(), 100);
                    }

                    // Set viewport height to full
                    if (WebApp.setHeaderColor) {
                        WebApp.setHeaderColor('secondary_bg_color');
                    }

                    setColorScheme(WebApp.colorScheme);

                    // Listen for theme changes
                    const themeParams = WebApp.themeParams;
                    // You could sync specific colors here if needed
                } catch (e) {
                    console.error('Error initializing Telegram WebApp:', e);
                }

                // Handle Back Button
                const handleBackButton = () => {
                    if (customBackHandler) {
                        customBackHandler();
                    } else {
                        router.back();
                    }
                };

                WebApp.BackButton.onClick(handleBackButton);

                // Show BackButton if we can go back... logic can be complex in Expo Router
                // For now, let's leave it controlled by screens or simple logic
                // WebApp.BackButton.show(); 

                return () => {
                    WebApp.BackButton.offClick(handleBackButton);
                };
            }
        };

        const cleanup = checkTelegram();
        return cleanup;
    }, [router, customBackHandler]);

    const showBackButton = () => {
        if (isTelegram && WebApp?.BackButton) {
            WebApp.BackButton.show();
        }
    };

    const hideBackButton = () => {
        if (isTelegram && WebApp?.BackButton) {
            WebApp.BackButton.hide();
        }
    };

    const setBackButtonHandler = (handler: (() => void) | null) => {
        setCustomBackHandler(() => handler);
    };

    const value: TelegramContextType = {
        isTelegram,
        user: isTelegram ? WebApp.initDataUnsafe?.user : null,
        webApp: isTelegram ? WebApp : null,
        initData: isTelegram ? WebApp.initData : '',
        initDataUnsafe: isTelegram ? WebApp.initDataUnsafe : {},
        colorScheme,
        showBackButton,
        hideBackButton,
        setBackButtonHandler,
    };

    return (
        <TelegramContext.Provider value={value}>
            {children}
        </TelegramContext.Provider>
    );
}
