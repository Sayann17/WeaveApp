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
  const [isZenChecked, setIsZenChecked] = useState(false);
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

    const checkNavigation = async () => {
      const inAuthGroup = segments[0] === '(auth)';
      const inTabsGroup = segments[0] === '(tabs)';
      const inOnboarding = segments[0] === 'onboarding';
      const inZen = segments[0] === 'zen';

      console.log('[Layout] checkNavigation:', { user: !!user, profile_completed: user?.profile_completed, segments: segments[0], isZenChecked, inZen });

      if (user) {
        if (!user.profile_completed && !inOnboarding && !inAuthGroup) {
          setIsZenChecked(true);
          router.replace('/onboarding/welcome');
        } else if (user.profile_completed) {
          // Check for Zen (Day Pause) BEFORE navigating anywhere
          if (!isZenChecked && !inZen) {
            console.log('[Layout] Calling ZenService.shouldShowZen()...');
            try {
              const shouldShowZen = await ZenService.shouldShowZen();
              console.log('[Layout] shouldShowZen result:', shouldShowZen);
              setIsZenChecked(true);
              if (shouldShowZen) {
                router.replace('/zen');
                return;
              }
            } catch (err) {
              console.error('[Layout] ZenService error:', err);
              setIsZenChecked(true);
            }
          }

          if (inAuthGroup || inOnboarding) {
            router.replace('/(tabs)');
          }
        }
      } else {
        // NOT setting isZenChecked here - it should remain false until authenticated user check
        if (inTabsGroup || inOnboarding || inZen) {
          router.replace('/(auth)');
        }
      }
    };

    checkNavigation();
  }, [user, segments, isLoading]); // Removed isZenChecked from deps to prevent re-trigger

  // Индикатор загрузки - показывать пока Zen не проверен (only for authenticated users)
  if (isLoading || (user && user.profile_completed && !isZenChecked)) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f3efe1' }}>
        <ActivityIndicator size="large" color="#34d399" />
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
                <Stack.Screen name="zen/index" />
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
