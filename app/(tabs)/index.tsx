import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  StatusBar,
  StyleSheet,
  View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MenuModal } from '../components/MenuModal';
import { ProfileView } from '../components/ProfileView';
import { ThemedBackground } from '../components/ThemedBackground';
import { Colors } from '../constants/colors';
import { useNotifications } from '../context/NotificationContext';
import { useTelegram } from '../context/TelegramProvider';
import { useTheme } from '../context/ThemeContext';
import { User } from '../services/interfaces/IAuthService';
import { yandexAuth } from '../services/yandex/AuthService';
import { getPlatformPadding } from '../utils/platformPadding';

export default function ProfileScreen() {
  const router = useRouter();
  const { theme, themeType, setTheme } = useTheme();
  const { unreadMessagesCount, newLikesCount } = useNotifications();
  const [userData, setUserData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const insets = useSafeAreaInsets();
  const { isMobile, hideBackButton } = useTelegram();

  const [isMenuVisible, setMenuVisible] = useState(false);
  const [settingsVisible, setSettingsVisible] = useState(false);

  // Refresh user data whenever screen comes into focus
  useFocusEffect(
    useCallback(() => {
      hideBackButton();

      const loadFullProfile = async () => {
        const currentUser = yandexAuth.getCurrentUser();
        if (currentUser) {
          console.log('[ProfileScreen] currentUser.events:', (currentUser as any).events);
          setUserData(currentUser);
          setIsLoading(false);
        }
      };

      loadFullProfile();

      // Also listen for auth state changes
      const unsubscribe = yandexAuth.onAuthStateChanged((u: User | null) => {
        if (u) {
          console.log('[ProfileScreen] Auth state changed, updating user data');
          setUserData(u);
          setIsLoading(false);
        }
      });

      return unsubscribe;
    }, [])
  );

  const isLight = themeType === 'light';
  const textColor = isLight ? '#1a1a1a' : Colors.text;
  const iconColor = isLight ? '#1a1a1a' : '#ffffff';

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.background, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <>
      <ThemedBackground>
        <StatusBar barStyle={isLight ? "dark-content" : "light-content"} />

        <View style={[styles.safeArea, { paddingTop: getPlatformPadding(insets, isMobile) }]}>
          {/* 🔥 ИСПОЛЬЗУЕМ ПЕРЕИСПОЛЬЗУЕМЫЙ КОМПОНЕНТ */}
          <ProfileView userData={userData} isOwnProfile={true} />
        </View>
      </ThemedBackground>

      <MenuModal visible={isMenuVisible} onClose={() => setMenuVisible(false)} />
    </>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
});