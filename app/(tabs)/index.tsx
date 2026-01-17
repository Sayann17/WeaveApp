import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ProfileView } from '../components/ProfileView';
import { ThemedBackground } from '../components/ThemedBackground';
import { Colors } from '../constants/colors';
import { useNotifications } from '../context/NotificationContext';
import { useTelegram } from '../context/TelegramProvider';
import { useTheme } from '../context/ThemeContext';
import { User } from '../services/interfaces/IAuthService';
import { yandexAuth } from '../services/yandex/AuthService';
import { normalize } from '../utils/normalize';
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

      {/* МЕНЮ */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={isMenuVisible}
        onRequestClose={() => setMenuVisible(false)}
      >
        <TouchableWithoutFeedback onPress={() => setMenuVisible(false)}>
          <View style={styles.modalOverlay}>
            <View style={[styles.menuContainer, { backgroundColor: theme.cardBg }]}>
              <TouchableOpacity style={styles.menuItem} onPress={() => { setMenuVisible(false); router.push('/profile/edit'); }}>
                <Ionicons name="create-outline" size={24} color={theme.text} />
                <Text style={[styles.menuText, { color: theme.text }]}>Редактировать профиль</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.menuItem} onPress={() => { setMenuVisible(false); router.push('/notifications'); }}>
                <Ionicons name="notifications-outline" size={24} color={theme.text} />
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                  <Text style={[styles.menuText, { color: theme.text }]}>Уведомления</Text>
                  {unreadMessagesCount > 0 && (
                    <View style={{ backgroundColor: '#e1306c', borderRadius: 10, paddingHorizontal: 6, paddingVertical: 2 }}>
                      <Text style={{ color: 'white', fontSize: 10, fontWeight: 'bold' }}>{unreadMessagesCount}</Text>
                    </View>
                  )}
                </View>
              </TouchableOpacity>

              <View style={[styles.divider, { backgroundColor: theme.border }]} />

              <TouchableOpacity style={styles.menuItem} onPress={() => { setMenuVisible(false); yandexAuth.logout(); }}>
                <Ionicons name="log-out-outline" size={24} color={Colors.error} />
                <Text style={[styles.menuText, { color: Colors.error }]}>Выйти</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableWithoutFeedback>
      </Modal>


    </>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  menuContainer: { borderTopLeftRadius: normalize(20), borderTopRightRadius: normalize(20), padding: normalize(20), paddingBottom: normalize(40) },
  menuItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: normalize(15), gap: normalize(15) },
  menuText: { fontSize: normalize(18), fontWeight: '500' },
  divider: { height: 1, marginVertical: normalize(10) }
});