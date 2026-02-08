// app/_layout.tsx
import { Stack, useRouter, useSegments } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { DisableZoom } from './components/DisableZoom';
import { MenuModal } from './components/MenuModal';
import { DataProvider } from './context/DataContext';
import { MenuProvider, useMenu } from './context/MenuContext';
import { NotificationProvider } from './context/NotificationContext';
import { TelegramProvider } from './context/TelegramProvider';
import { ThemeProvider } from './context/ThemeContext';
import './global.css'; // Import global CSS for pinch-zoom prevention
import { User } from './services/interfaces/IAuthService';
import { yandexAuth } from './services/yandex/AuthService';
import { ZenService } from './services/ZenService';

export default function RootLayout() {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
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
    if (isLoading) return;

    const inAuthGroup = segments[0] === '(auth)';
    const inTabsGroup = segments[0] === '(tabs)';
    const inOnboarding = segments[0] === 'onboarding';
    const inZen = segments[0] === 'zen';

    const checkNavigation = async () => {
      if (user) {
        if (!user.profile_completed && !inOnboarding && !inAuthGroup) {
          router.replace('/onboarding/welcome');
        } else if (user.profile_completed) {
          // Если профиль заполнен, проверяем Zen (если еще не проверяли)
          // Логика:
          // 1. Если мы в (auth) или onboarding -> значит мы только вошли -> проверяем Zen
          // 2. Если мы просто перезагрузили апп (были в tabs) -> тоже можно проверить Zen?
          //    Пока сделаем простую проверку: если пользователь залогинен и готов,
          //    мы должны решить куда его пустить: в tabs или в zen.

          // Чтобы не вешать ожидание на каждый рендер, проверим Zen один раз за сессию (при загрузке)
          // Но так как checkNavigation вызывается в useEffect, нам нужен флаг.

          // Упростим: если мы УЖЕ в tabs или zen, то не дергаем, если не спец условие?
          // Нет, требование "Пауза дня" подразумевает, что при ОТКРЫТИИ приложения мы проверяем.

          // Проверяем Zen, если мы не в Zen и еще не проходили его
          if (!inZen) {
            try {
              // Оптимизация: проверяем только если мы идем "внутрь" приложения (из auth/onboarding) или при старте
              // Можно добавить локальный стейт, проверяли ли мы уже
              const shouldShowZen = await ZenService.shouldShowZen();
              if (shouldShowZen) {
                router.replace('/zen');
              } else if (inAuthGroup || inOnboarding) {
                // Если Zen не нужен, а мы были на входе - пускаем в табы
                router.replace('/(tabs)');
              }
            } catch (e) {
              console.error('Failed to check Zen:', e);
              if (inAuthGroup || inOnboarding) router.replace('/(tabs)');
            }
          }
        }
      } else if (!user && (inTabsGroup || inOnboarding || inZen)) {
        router.replace('/(auth)');
      }
    };

    checkNavigation();
  }, [user, segments, isLoading]);

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
      <DisableZoom />
      <ThemeProvider>
        <NotificationProvider>
          <DataProvider>
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
          </DataProvider>
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