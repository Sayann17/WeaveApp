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

                let handleVisibilityChange: (() => void) | undefined;
                let handleResize: (() => void) | undefined;

                try {
                    let detectedIsMobile = false;
                    WebApp.ready();

                    // Debug info
                    console.log('=== TELEGRAM DEBUG INFO ===');
                    console.log('Platform:', WebApp.platform);
                    console.log('InitData:', WebApp.initDataUnsafe);
                    console.log('Is expanded:', WebApp.isExpanded);
                    console.log('Version:', WebApp.version);
                    console.log('======================');

                    // Detect platform
                    const detectedPlatform = WebApp.platform;
                    setPlatform(detectedPlatform);

                    // Platform-specific settings
                    detectedIsMobile = detectedPlatform === 'android' || detectedPlatform === 'ios' || /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
                    const detectedIsDesktop = detectedPlatform === 'macos' || detectedPlatform === 'tdesktop' || detectedPlatform === 'windows';
                    const detectedIsWeb = detectedPlatform === 'web' || detectedPlatform === 'weba' || detectedPlatform === 'webk';

                    setIsMobile(detectedIsMobile);
                    setIsDesktop(detectedIsDesktop);
                    setIsWeb(detectedIsWeb);

                    // Expansion Function
                    const expandApp = () => {
                        try {
                            // Standard expand
                            if (!WebApp.isExpanded) {
                                WebApp.expand();
                            }

                            // API v7.0+ requestFullscreen
                            if (WebApp.requestFullscreen) {
                                WebApp.requestFullscreen();
                            }
                        } catch (e) {
                            console.error('Expansion failed:', e);
                        }
                    };

                    // Only auto-expand on Mobile devices
                    if (detectedIsMobile) {
                        // REMOVED: Automatic expansion to allow "Open" button to open in half-screen/default mode
                        // The user requested that clicking "Open" should NOT open in fullscreen.
                        // By removing expand(), we respect the default behavior or the button configuration.

                        // User can still manually expand if we provide a button, or via gesture.

                        // 1. Immediate call
                        expandApp();

                        // 2. Check start_param logic
                        const initData = WebApp.initData;
                        const startParam = new URLSearchParams(initData).get('start_param') || WebApp.initDataUnsafe?.start_param;
                        if (startParam === 'fullscreen') {
                            expandApp();
                        }

                        // 3. Persistent expansion (Interval) - helps with some loading states
                        const expandInterval = setInterval(() => {
                            expandApp();
                        }, 100);

                        // Clear interval after 2s
                        setTimeout(() => {
                            clearInterval(expandInterval);
                            // Final attempt
                            expandApp();
                        }, 2000);

                        // 4. Event Listeners
                        // Re-expand on visibility change (e.g. switching back to app) - Keeping this disabled as well
                        /*
                        handleVisibilityChange = () => {
                            if (document.visibilityState === 'visible') {
                                expandApp();
                            }
                        };
                        document.addEventListener('visibilitychange', handleVisibilityChange);

                        // Re-expand on viewport change/resize
                        handleResize = () => {
                            if (!WebApp.isExpanded) {
                                expandApp();
                            }
                        };
                        window.addEventListener('resize', handleResize);
                        */
                    }

                    // Set viewport height to full
                    // 🔥 REMOVED: Conflicting setHeaderColor. ThemeContext handles this now.
                    // if (WebApp.setHeaderColor) {
                    //     WebApp.setHeaderColor('secondary_bg_color');
                    // }

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
                    // Use a more robust check in cleanup
                    const isMobilePlatform = WebApp.platform === 'android' || WebApp.platform === 'ios' || /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
                    if (isMobilePlatform) {
                        if (handleVisibilityChange) document.removeEventListener('visibilitychange', handleVisibilityChange);
                        if (handleResize) window.removeEventListener('resize', handleResize);
                    }
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
