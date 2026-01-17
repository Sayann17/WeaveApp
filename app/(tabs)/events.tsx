// app/(tabs)/index.tsx
import React, { useRef } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EventsFeed } from '../components/EventsFeed';
import { ThemedBackground } from '../components/ThemedBackground';
import { useTelegram } from '../context/TelegramProvider';
import { useTheme } from '../context/ThemeContext';
import { getPlatformPadding } from '../utils/platformPadding';

export default function HomeScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { isMobile } = useTelegram();
  const scrollViewRef = useRef<ScrollView>(null);

  const handleScrollToTop = () => {
    scrollViewRef.current?.scrollTo({ y: 0, animated: true });
  };

  return (
    <ThemedBackground>
      <View style={[styles.container, { paddingTop: getPlatformPadding(insets, isMobile) }]}>
        <ScrollView
          ref={scrollViewRef}
          contentContainerStyle={{ paddingBottom: 20 }}
          showsVerticalScrollIndicator={false}
        >
          <Text style={[styles.headerTitle, { color: theme.text }]}>События</Text>
          <EventsFeed onScrollToTop={handleScrollToTop} />
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
  headerTitle: {
    fontSize: 34,
    fontWeight: '800',
    paddingHorizontal: 20,
    marginBottom: 20,
    marginTop: 20,
    letterSpacing: -1
  },
});