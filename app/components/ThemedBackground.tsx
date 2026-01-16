// components/ThemedBackground.tsx
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { ImageBackground, StyleSheet, View } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { SpaceBackground } from './ui/SpaceBackground'; // Твой компонент космоса

export const ThemedBackground = ({ children }: { children?: React.ReactNode }) => {
  const { themeType, theme } = useTheme();

  if (themeType === 'space') {
    return (
      <SpaceBackground style={{ flex: 1 }}>
        <StatusBar style="light" />
        {children}
      </SpaceBackground>
    );
  }

  if (themeType === 'wine') {
    return (
      <ImageBackground
        source={require('../../assets/images/themes/wine_bg.jpg')}
        style={{ flex: 1 }}
        resizeMode="cover"
      >
        <StatusBar style="light" />
        <View style={{ flex: 1, backgroundColor: 'rgba(50,10,20,0.3)' }}>
          {children}
        </View>
      </ImageBackground>
    );
  }

  // Для 'light' просто цвет
  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <StatusBar style={themeType === 'light' ? 'dark' : 'light'} />
      {children}
    </View>
  );
};