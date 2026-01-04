// app/_layout.tsx
import { Stack, useRouter, useSegments } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { MenuModal } from './components/MenuModal';
import { MenuProvider, useMenu } from './context/MenuContext';
import { NotificationProvider } from './context/NotificationContext';
import { TelegramProvider } from './context/TelegramProvider';
import { ThemeProvider } from './context/ThemeContext';
import './global.css'; // Import global CSS for pinch-zoom prevention
import { User } from './services/interfaces/IAuthService';
import { yandexAuth } from './services/yandex/AuthService';
import SplashScreen from './splash';

export default function RootLayout() {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSplashComplete, setIsSplashComplete] = useState(false);
  const segments = useSegments();
  const router = useRouter();

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
        router.replace('/onboarding/welcome');
      } else if (user.profile_completed && (inAuthGroup || inOnboarding)) {
        router.replace('/(tabs)/profile');
      }
    } else if (!user && (inTabsGroup || inOnboarding)) {
      router.replace('/(auth)');
    }
  }, [user, segments, isLoading, isSplashComplete]);

  // Показываем сплеш-скрин
  if (!isSplashComplete) {
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
          <MenuProvider>
            <Stack screenOptions={{ headerShown: false, animation: 'fade' }}>
              <Stack.Screen name="splash" />
              <Stack.Screen name="(auth)" />
              <Stack.Screen name="onboarding" />
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="chat/[id]" />
              <Stack.Screen name="profile/[id]" />
              <Stack.Screen name="profile/edit" />
              <Stack.Screen name="notifications" />
            </Stack>
            <MenuModalWrapper />
          </MenuProvider>
        </NotificationProvider>
      </ThemeProvider>
    </TelegramProvider>
  );
}

// Wrapper component to use menu context
function MenuModalWrapper() {
  const { isMenuOpen, closeMenu } = useMenu();
  return <MenuModal visible={isMenuOpen} onClose={closeMenu} />;
}