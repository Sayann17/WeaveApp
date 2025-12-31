// app/(tabs)/index.tsx
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Pressable,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ThemedBackground } from '../components/ThemedBackground';
import { useTheme } from '../context/ThemeContext';
import { User } from '../services/interfaces/IAuthService';
import { yandexAuth } from '../services/yandex/AuthService';

const { width } = Dimensions.get('window');

// Хелпер для даты
const getFormattedDate = () => {
  const options: Intl.DateTimeFormatOptions = {
    weekday: 'long',
    month: 'long',
    day: 'numeric'
  };
  return new Date().toLocaleDateString('ru-RU', options);
};

export default function HomeScreen() {
  const router = useRouter();
  const { theme, themeType } = useTheme(); // 🔥 Use Global Theme
  const insets = useSafeAreaInsets(); // 🔥
  const [user, setUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Подписка на данные пользователя
  useEffect(() => {
    console.log('[HomeScreen] Mounting...');
    const currentUser = yandexAuth.getCurrentUser();
    console.log('[HomeScreen] Current user:', currentUser ? 'Found' : 'Null');

    if (currentUser) {
      setUser(currentUser);
      setIsLoading(false);
    } else {
      console.log('[HomeScreen] Waiting for user...');
      const unsubscribe = yandexAuth.onAuthStateChanged((u: User | null) => {
        console.log('[HomeScreen] Auth state changed:', u ? 'User found' : 'Null');
        if (u) {
          setUser(u);
          setIsLoading(false);
        }
      });
      return unsubscribe;
    }
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await yandexAuth.refreshSession(); // Re-fetch from backend
      setUser(yandexAuth.getCurrentUser());
    } catch (e) {
      console.error(e);
    } finally {
      setRefreshing(false);
    }
  };

  if (isLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.text} />
        <Text style={{ marginTop: 10, color: theme.text }}>Загрузка главной...</Text>
      </View>
    );
  }

  // Приветствие
  const hour = new Date().getHours();
  let greeting = 'Добрый день';
  if (hour < 12) greeting = 'Доброе утро';
  else if (hour >= 18) greeting = 'Добрый вечер';

  const isLight = themeType === 'light';

  return (
    <ThemedBackground>
      <StatusBar barStyle={isLight ? "dark-content" : "light-content"} />

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 20 }]} // Dynamic padding
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.text} />
        }
      >
        {/* 1. ХЕДЕР */}
        <View style={styles.header}>
          <Text style={[styles.dateText, { color: theme.subText }]}>{getFormattedDate()}</Text>
          <Text style={[styles.greetingText, { color: theme.text }]}>
            {greeting}, {user?.name || 'Гость'}.
          </Text>
        </View>

        {/* 2. ВОПРОС ДНЯ */}
        <View style={[styles.dailyQuestionCard, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
          <View style={styles.questionIcon}>
            <Ionicons name="sparkles-outline" size={20} color={theme.text} />
          </View>
          <Text style={styles.questionLabel}>Вопрос дня</Text>
          <Text style={[styles.questionText, { color: theme.text }]}>
            "Какая семейная традиция для вас важнее всего?"
          </Text>
        </View>

        {/* 3. НАВИГАЦИЯ */}
        <View style={styles.navContainer}>
          <NavChip label="Поиск" icon="search-outline" path="/(tabs)/explore" theme={theme} router={router} />
          <NavChip label="Профиль" icon="person-outline" path="/profile" theme={theme} router={router} />
          <NavChip label="Редактировать" icon="create-outline" path="/profile/edit" theme={theme} router={router} />
        </View>

        {/* 4. КАРТА ДНЯ */}
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Люди рядом</Text>
          <Pressable onPress={() => router.push('/(tabs)/explore')}>
            <Text style={[styles.sectionLink, { color: theme.subText }]}>Смотреть всех</Text>
          </Pressable>
        </View>

        <Pressable
          style={[styles.dailyCard, { backgroundColor: theme.cardBg, borderColor: theme.border }]}
          onPress={() => router.push('/(tabs)/explore')}
        >
          <View style={styles.cardImagePlaceholder}>
            <Ionicons name="image-outline" size={48} color="#ccc" />
            <Text style={styles.cardPlaceholderText}>Здесь будет фото</Text>
          </View>
          <View style={styles.cardContent}>
            <Text style={[styles.cardName, { color: theme.text }]}>Анна, 26</Text>
            <Text style={[styles.cardSub, { color: theme.subText }]}>Дизайнер • Москва</Text>
            <Text style={[styles.cardQuote, { color: theme.subText }]}>
              "Ищу человека, с которым можно молчать и все понимать..."
            </Text>
          </View>
        </Pressable>

        <View style={{ height: 40 }} />

      </ScrollView>
    </ThemedBackground>
  );
}

const NavChip = ({ label, icon, path, theme, router }: any) => (
  <Pressable
    style={[styles.navChip, {
      backgroundColor: theme.cardBg,
      borderColor: theme.border
    }]}
    onPress={() => router.push(path)}
  >
    <Ionicons name={icon} size={18} color={theme.text} />
    <Text style={[styles.navText, { color: theme.text }]}>{label}</Text>
  </Pressable>
);

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    padding: 24,
    paddingTop: 60,
  },
  header: { marginBottom: 30 },
  dateText: {
    fontSize: 13,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
    fontWeight: '600',
  },
  greetingText: {
    fontSize: 32,
    fontWeight: '300',
    lineHeight: 40,
  },
  dailyQuestionCard: {
    padding: 20,
    borderRadius: 16,
    marginBottom: 30,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  questionIcon: {
    position: 'absolute',
    top: 20, right: 20,
    opacity: 0.5
  },
  questionLabel: {
    fontSize: 12,
    color: '#e1306c',
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  questionText: {
    fontSize: 18,
    fontStyle: 'italic',
    lineHeight: 26,
  },
  navContainer: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 40,
  },
  navChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
    gap: 6,
  },
  navText: {
    fontSize: 14,
    fontWeight: '500',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
  },
  sectionLink: {
    fontSize: 14,
  },
  dailyCard: {
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 4,
  },
  cardImagePlaceholder: {
    height: width * 0.8,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardPlaceholderText: {
    marginTop: 10,
    color: '#999',
    fontSize: 14,
  },
  cardContent: {
    padding: 20,
  },
  cardName: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  cardSub: {
    fontSize: 14,
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  cardQuote: {
    fontSize: 16,
    fontStyle: 'italic',
    lineHeight: 22,
  },
});