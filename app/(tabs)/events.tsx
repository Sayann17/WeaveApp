import { useFocusEffect } from 'expo-router';
import React, { useCallback, useRef } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EventsFeed } from '../components/EventsFeed';
import { ThemedBackground } from '../components/ThemedBackground';
import { useTelegram } from '../context/TelegramProvider';
import { useTheme } from '../context/ThemeContext';
import { normalize } from '../utils/normalize';
import { getPlatformPadding } from '../utils/platformPadding';

export default function HomeScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { isMobile, hideBackButton } = useTelegram();
  const scrollViewRef = useRef<ScrollView>(null);

  useFocusEffect(
    useCallback(() => {
      hideBackButton();
    }, [])
  );

  const handleScrollToTop = () => {
    scrollViewRef.current?.scrollTo({ y: 0, animated: true });
  };

  return (
    <ThemedBackground>
      <View style={[styles.container, { paddingTop: getPlatformPadding(insets, isMobile) }]}>
        <ScrollView
          ref={scrollViewRef}
          contentContainerStyle={{ paddingBottom: normalize(120) }}
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
    paddingHorizontal: normalize(20),
    paddingBottom: normalize(15),
    borderBottomWidth: 1,
  },
  title: {
    fontSize: normalize(28),
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
  },
  placeholder: {
    fontSize: normalize(16),
    textAlign: 'center',
    lineHeight: normalize(24),
  },
  headerTitle: {
    fontSize: normalize(34),
    fontWeight: '800',
    paddingHorizontal: normalize(20),
    marginBottom: normalize(20),
    marginTop: normalize(20),
    letterSpacing: -1
  },
});