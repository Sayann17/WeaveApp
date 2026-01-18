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
import { useData } from '../context/DataContext';
import { useNotifications } from '../context/NotificationContext';
import { useTelegram } from '../context/TelegramProvider';
import { useTheme } from '../context/ThemeContext';
import { getPlatformPadding } from '../utils/platformPadding';

export default function ProfileScreen() {
  const router = useRouter();
  const { theme, themeType, setTheme } = useTheme();
  const { unreadMessagesCount, newLikesCount } = useNotifications();
  const { userProfile: userData, isLoading } = useData();
  const insets = useSafeAreaInsets();
  const { isMobile, hideBackButton } = useTelegram();

  const [isMenuVisible, setMenuVisible] = useState(false);
  const [settingsVisible, setSettingsVisible] = useState(false);

  // Ensure Back Button is hidden
  useFocusEffect(
    useCallback(() => {
      hideBackButton();
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