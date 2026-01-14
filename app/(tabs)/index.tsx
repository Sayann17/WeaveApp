// app/(tabs)/index.tsx
import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { EventsFeed } from '../components/EventsFeed';
import { ThemedBackground } from '../components/ThemedBackground';
import { useTheme } from '../context/ThemeContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function HomeScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <ThemedBackground>
      <View style={[styles.container, { paddingTop: 92 }]}>
        <View style={[styles.header, { borderBottomColor: theme.border }]}>
          <Text style={[styles.title, { color: theme.text }]}>Главная</Text>
        </View>

        <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 100 }}>
          <EventsFeed />
        </ScrollView>
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
  },
  placeholder: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
  },
});