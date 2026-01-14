// app/(tabs)/index.tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { ThemedBackground } from '../components/ThemedBackground';
import { useTheme } from '../context/ThemeContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function HomeScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <ThemedBackground>
      <View style={[styles.container, { paddingTop: insets.top + 20 }]}>
        <View style={[styles.header, { borderBottomColor: theme.border }]}>
          <Text style={[styles.title, { color: theme.text }]}>Главная</Text>
        </View>

        <View style={styles.content}>
          <Text style={[styles.placeholder, { color: theme.subText }]}>
            Добро пожаловать в Weave!
            {"\n"}
            Здесь скоро будет лента новостей.
          </Text>
        </View>
      </View>
    </ThemedBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 15,
    borderBottomWidth: 1,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  placeholder: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
  },
});