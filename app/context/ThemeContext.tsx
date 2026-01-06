// context/ThemeContext.tsx
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { yandexAuth } from '../services/yandex/AuthService';
import { useTelegram } from './TelegramProvider';

// Типы тем
export type ThemeType = 'light' | 'space' | 'aura';

// Цветовые палитры
export const THEMES = {
  light: {
    type: 'light' as ThemeType,
    background: '#f4f4e7',
    text: '#1c1c1e',
    subText: '#555555',
    cardBg: '#fafaf2', // Soft beige instead of pure white
    border: '#e0e0e0',
    accent: '#2a2a2a', // Темные кнопки
    icon: '#1c1c1e',
    tint: 'rgba(0,0,0,0.05)'
  },
  space: {
    type: 'space' as ThemeType,
    background: '#0b0d15', // Темно-синий
    text: '#ffffff',
    subText: '#a0a0a0',
    cardBg: 'rgba(23, 27, 44, 0.85)', // Полупрозрачный темный
    border: 'rgba(255,255,255,0.1)',
    accent: '#e1306c', // Яркий акцент для космоса
    icon: '#ffffff',
    tint: 'rgba(255,255,255,0.1)'
  },
  aura: {
    type: 'aura' as ThemeType,
    background: '#0a0a0a',
    text: '#ffffff',
    subText: '#cccccc',
    cardBg: 'rgba(20, 20, 20, 0.7)', // Полупрозрачный черный
    border: 'rgba(255,255,255,0.1)',
    accent: '#e1306c',
    icon: '#ffffff',
    tint: 'rgba(255,255,255,0.1)'
  }
};

type ThemeContextType = {
  theme: typeof THEMES.light;
  themeType: ThemeType;
  isLight: boolean;
  setTheme: (type: ThemeType) => Promise<void>;
  userPhotoForAura: string | null; // Фото для ауры
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  const [themeType, setThemeType] = useState<ThemeType>('light');
  const [userPhotoForAura, setUserPhotoForAura] = useState<string | null>(null);

  // Load theme from AsyncStorage on mount
  useEffect(() => {
    const loadTheme = async () => {
      try {
        const savedTheme = await AsyncStorage.getItem('app_theme');
        if (savedTheme && (savedTheme === 'light' || savedTheme === 'space' || savedTheme === 'aura')) {
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
      // Set header color to match background (triggers status bar icon color change)
      if (webApp.setHeaderColor) {
        webApp.setHeaderColor(bg);
      }
      // Set background color for overscroll areas
      if (webApp.setBackgroundColor) {
        webApp.setBackgroundColor(bg);
      }
    }
  }, [themeType, webApp]);

  // Listen to auth changes to get user photo
  useEffect(() => {
    const unsubscribe = yandexAuth.onAuthStateChanged((user) => {
      if (user) {
        // Get first photo for aura background
        console.log('[ThemeContext] User photos:', user.photos);
        if (user.photos && Array.isArray(user.photos) && user.photos.length > 0) {
          console.log('[ThemeContext] Setting aura photo:', user.photos[0]);
          setUserPhotoForAura(user.photos[0]);
        } else {
          console.log('[ThemeContext] No photos available for aura');
          setUserPhotoForAura(null);
        }
      } else {
        setThemeType('light');
        setUserPhotoForAura(null);
      }
    });

    return unsubscribe;
  }, []);

  const setTheme = async (type: ThemeType) => {
    setThemeType(type);
    try {
      await AsyncStorage.setItem('app_theme', type);
      // TODO: Optionally save to backend when profile update API supports it
    } catch (e) {
      console.error('Failed to save theme', e);
    }
  };

  const theme = THEMES[themeType];
  const isLight = themeType === 'light';

  return (
    <ThemeContext.Provider value={{ theme, themeType, isLight, setTheme, userPhotoForAura }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within a ThemeProvider');
  return context;
};
