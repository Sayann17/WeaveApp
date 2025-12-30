// app/_layout.tsx
import { Stack, useRouter, useSegments } from 'expo-router'; //
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { NotificationProvider } from './context/NotificationContext';
import { TelegramProvider } from './context/TelegramProvider';
import { ThemeProvider } from './context/ThemeContext';
import { User } from './services/interfaces/IAuthService';
import { yandexAuth } from './services/yandex/AuthService';
import SplashScreen from './splash';

export default function RootLayout() {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSplashComplete, setIsSplashComplete] = useState(false);
  const segments = useSegments();
  const router = useRouter();

  // ... existing fonts code ...

  // Проверка авторизации
  useEffect(() => {
    const unsubscribe = yandexAuth.onAuthStateChanged((user) => {
      console.log('Yandex Auth state changed:', user ? 'User logged in' : 'No user');
      setUser(user);
      setIsLoading(false);
    });

    return unsubscribe;
  }, []);

  // Навигация после загрузки
  useEffect(() => {
    if (isLoading || !isSplashComplete) return;

    const inAuthGroup = segments[0] === '(auth)';
    const inTabsGroup = segments[0] === '(tabs)';
    const inOnboarding = segments[0] === 'onboarding';

    if (user) {
      if (!user.profile_completed && !inOnboarding && !inAuthGroup) {
        // Если профиль не заполнен, отправляем на онбординг (но не если мы уже там)
        router.replace('/onboarding/welcome');
      } else if (user.profile_completed && (inAuthGroup || inOnboarding)) {
        // Если профиль заполнен и мы в авторизации или онбординге - в табы
        router.replace('/(tabs)');
      }
    } else if (!user && (inTabsGroup || inOnboarding)) {
      // Нет пользователя - в авторизацию
      router.replace('/(auth)');
    }
  }, [user, segments, isLoading, isSplashComplete]);

  // Показываем сплеш-скрин
  if (!isSplashComplete) {
    // 🔥 ИСПРАВЛЕНИЕ: Передаем функцию onFinish
    return <SplashScreen onFinish={() => setIsSplashComplete(true)} />;
  }

  // Индикатор загрузки
  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0a0a0a' }}>
        <ActivityIndicator size="large" color="#e1306c" />
      </View>
    );
  }

  return (
    <TelegramProvider>
      <ThemeProvider>
        <NotificationProvider>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(auth)" options={{ headerShown: false }} />
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            {/* Остальные экраны... */}
            <Stack.Screen name="onboarding/welcome" options={{ headerShown: false }} />
            <Stack.Screen name="onboarding/gender" options={{ headerShown: false }} />
            <Stack.Screen name="onboarding/ethnicity" options={{ headerShown: false }} />
            <Stack.Screen name="onboarding/interests" options={{ headerShown: false }} />
            <Stack.Screen name="onboarding/religion" options={{ headerShown: false }} />
            <Stack.Screen name="onboarding/zodiac" options={{ headerShown: false }} />
            <Stack.Screen name="profile/onboarding" options={{ headerShown: false }} />
            <Stack.Screen name="profile/edit" options={{ title: 'Редактировать профиль' }} />
          </Stack>
        </NotificationProvider>
      </ThemeProvider>
    </TelegramProvider>
  );
}