// components/ThemedBackground.tsx
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { ImageBackground, StyleSheet, View } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { SpaceBackground } from './ui/SpaceBackground'; // Твой компонент космоса

export const ThemedBackground = ({ children }: { children?: React.ReactNode }) => {
  const { themeType, theme, userPhotoForAura } = useTheme();

  if (themeType === 'space') {
    return <SpaceBackground style={{ flex: 1 }}>{children}</SpaceBackground>;
  }

  if (themeType === 'aura' && userPhotoForAura) {
    return (
      <View style={{ flex: 1, backgroundColor: '#000' }}>
        <ImageBackground
          source={{ uri: userPhotoForAura }}
          style={StyleSheet.absoluteFill}
          blurRadius={90}
        >
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' }}>
            {children}
          </View>
        </ImageBackground>
      </View>
    );
  }

  // Для 'light' и 'aura' (если нет фото) просто цвет
  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <StatusBar style={themeType === 'light' ? 'dark' : 'light'} />
      {children}
    </View>
  );
};