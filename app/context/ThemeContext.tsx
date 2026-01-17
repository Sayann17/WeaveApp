// context/ThemeContext.tsx
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { yandexAuth } from '../services/yandex/AuthService';
import { useTelegram } from './TelegramProvider';

// Типы тем
export type ThemeType = 'light' | 'space' | 'wine';

// Цветовые палитры
export const THEMES = {
  light: {
    type: 'light' as ThemeType,
    background: '#f4f4e7',
    text: '#1c1c1e',
    subText: '#555555',
    cardBg: '#fafaf2',
    sheetBg: '#f4f4e7', // Beige like main background
    border: '#e0e0e0',
    accent: '#000000',
    accentText: '#ffffff',
    icon: '#1c1c1e',
    tint: 'rgba(0,0,0,0.05)'
  },
  space: {
    type: 'space' as ThemeType,
    background: '#0b0d15',
    text: '#ffffff',
    subText: '#a0a0a0',
    cardBg: 'rgba(23, 27, 44, 0.85)',
    sheetBg: '#1a1d2d', // Solid dark for space sheets
    border: 'rgba(255,255,255,0.1)',
    accent: '#ffffff',
    accentText: '#000000',
    icon: '#ffffff',
    tint: 'rgba(255,255,255,0.1)'
  },
  wine: {
    type: 'wine' as ThemeType,
    background: '#4a0e1c',
    text: '#ffffff',
    subText: 'rgba(255,255,255,0.7)',
    cardBg: 'rgba(255, 255, 255, 0.1)',
    sheetBg: '#591c2b', // Solid wine color for sheets/modals
    border: 'rgba(255, 255, 255, 0.2)',
    accent: '#ffffff',
    accentText: '#000000',
    icon: '#ffffff',
    tint: 'rgba(255,255,255,0.3)'
  }
};

type ThemeContextType = {
  theme: typeof THEMES.light;
  themeType: ThemeType;
  isLight: boolean;
  setTheme: (type: ThemeType) => Promise<void>;
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  const [themeType, setThemeType] = useState<ThemeType>('light');

  // Load theme from AsyncStorage on mount
  useEffect(() => {
    const loadTheme = async () => {
      try {
        const savedTheme = await AsyncStorage.getItem('app_theme');
        if (savedTheme && (savedTheme === 'light' || savedTheme === 'space' || savedTheme === 'wine')) {
          setThemeType(savedTheme as ThemeType);
        }
      } catch (e) {
        console.error('Failed to load theme', e);
      }
    };
    loadTheme();
  }, []);

  // Sync with Telegram WebApp
  const { webApp } = useTelegram();

  useEffect(() => {
    if (webApp) {
      const bg = THEMES[themeType].background;
      const isLightTheme = themeType === 'light';

      // Sync colors with Telegram
      const applyTheme = () => {
        if (!webApp) return;

        // 1. Header & Background
        // Setting header color automatically adjusts the system icons (Back, Menu)
        // to be Black (on light bg) or White (on dark bg).
        if (webApp.setHeaderColor) {
          webApp.setHeaderColor(bg);
        }
        if (webApp.setBackgroundColor) {
          webApp.setBackgroundColor(bg);
        }
        if (webApp.setBottomBarColor) {
          webApp.setBottomBarColor(bg);
        }

        // 2. Main Button (Bottom Action Button)
        if (webApp.MainButton) {
          if (isLightTheme) {
            webApp.MainButton.setParams({
              color: '#000000',
              text_color: '#ffffff'
            });
          } else {
            // Dark theme
            webApp.MainButton.setParams({
              color: THEMES[themeType].accent,
              text_color: '#ffffff'
            });
          }
        }
      };

      // 1. Apply immediately
      applyTheme();

      // 2. Re-apply after small delay to fight initial race conditions
      const timer = setTimeout(applyTheme, 100);

      return () => clearTimeout(timer);
    }
  }, [themeType, webApp]);

  // Listen to auth changes to reset theme on logout if needed
  useEffect(() => {
    const unsubscribe = yandexAuth.onAuthStateChanged((user) => {
      if (!user) {
        setThemeType('light');
      }
    });

    return unsubscribe;
  }, []);

  const setTheme = async (type: ThemeType) => {
    setThemeType(type);
    try {
      await AsyncStorage.setItem('app_theme', type);
    } catch (e) {
      console.error('Failed to save theme', e);
    }
  };

  const theme = THEMES[themeType];
  const isLight = themeType === 'light';

  return (
    <ThemeContext.Provider value={{ theme, themeType, isLight, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within a ThemeProvider');
  return context;
};
