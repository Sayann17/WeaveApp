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
    platform: string;
    isMobile: boolean;
    isDesktop: boolean;
    isWeb: boolean;
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
    platform: 'unknown',
    isMobile: false,
    isDesktop: false,
    isWeb: false,
    showBackButton: () => { },
    hideBackButton: () => { },
    setBackButtonHandler: () => { },
});

export const useTelegram = () => useContext(TelegramContext);

export function TelegramProvider({ children }: { children: React.ReactNode }) {
    const [isTelegram, setIsTelegram] = useState(false);
    const [colorScheme, setColorScheme] = useState<'light' | 'dark'>('light');
    const [platform, setPlatform] = useState('unknown');
    const [isMobile, setIsMobile] = useState(false);
    const [isDesktop, setIsDesktop] = useState(false);
    const [isWeb, setIsWeb] = useState(false);
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

                    // Detect platform
                    const detectedPlatform = WebApp.platform; // 'android', 'ios', 'macos', 'tdesktop', 'web', 'weba', 'webk', 'unknown'
                    console.log('[Telegram] Platform detected:', detectedPlatform);
                    setPlatform(detectedPlatform);

                    // Platform-specific settings
                    const detectedIsMobile = detectedPlatform === 'android' || detectedPlatform === 'ios';
                    const detectedIsDesktop = detectedPlatform === 'macos' || detectedPlatform === 'tdesktop' || detectedPlatform === 'windows';
                    const detectedIsWeb = detectedPlatform === 'web' || detectedPlatform === 'weba' || detectedPlatform === 'webk';

                    setIsMobile(detectedIsMobile);
                    setIsDesktop(detectedIsDesktop);
                    setIsWeb(detectedIsWeb);

                    // Force expand to fullscreen
                    WebApp.expand();

                    // Aggressive expansion strategy to ensure 100% height
                    const expandInterval = setInterval(() => {
                        try {
                            if (!WebApp.isExpanded) {
                                WebApp.expand();
                            }
                        } catch (e) {
                            console.error('Error expanding WebApp:', e);
                        }
                    }, 100);

                    // Clear interval after 2 seconds, but keep trying initially
                    setTimeout(() => {
                        clearInterval(expandInterval);
                        // One final attempt
                        try {
                            WebApp.expand();
                        } catch (e) { }
                    }, 2000);

                    // Set viewport height to full
                    if (WebApp.setHeaderColor) {
                        WebApp.setHeaderColor('secondary_bg_color');
                    }

                    // Platform-specific viewport settings
                    if (WebApp.setViewportHeight) {
                        WebApp.setViewportHeight(window.innerHeight);
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

    return (
        <TelegramContext.Provider
            value={{
                isTelegram,
                user: WebApp?.initDataUnsafe?.user || null,
                webApp: WebApp,
                initData: WebApp?.initData || '',
                initDataUnsafe: WebApp?.initDataUnsafe || {},
                colorScheme,
                platform,
                isMobile,
                isDesktop,
                isWeb,
                showBackButton,
                hideBackButton,
                setBackButtonHandler: (handler) => setCustomBackHandler(() => handler),
            }}
        >
            {children}
        </TelegramContext.Provider>
    );
}
