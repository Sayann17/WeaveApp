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
import { useTheme } from '../context/ThemeContext';
import { User } from '../services/interfaces/IAuthService';
import { yandexAuth } from '../services/yandex/AuthService';

export default function ProfileScreen() {
  const router = useRouter();
  const { theme, themeType, setTheme } = useTheme();
  const { unreadMessagesCount, newLikesCount } = useNotifications();
  const [userData, setUserData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const insets = useSafeAreaInsets();

  const [isMenuVisible, setMenuVisible] = useState(false);
  const [settingsVisible, setSettingsVisible] = useState(false);

  // Refresh user data whenever screen comes into focus
  useFocusEffect(
    useCallback(() => {
      const loadUserData = () => {
        const currentUser = yandexAuth.getCurrentUser();
        console.log('[ProfileScreen] Loading user data:', currentUser?.name, currentUser?.bio);
        if (currentUser) {
          setUserData(currentUser);
          setIsLoading(false);
        }
      };

      loadUserData();

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

        <View style={[styles.safeArea, { paddingTop: insets.top }]}>
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

              <TouchableOpacity style={styles.menuItem} onPress={() => {
                setMenuVisible(false);
                setTimeout(() => setSettingsVisible(true), 300);
              }}>
                <Ionicons name="color-palette-outline" size={24} color={theme.text} />
                <Text style={[styles.menuText, { color: theme.text }]}>Оформление</Text>
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

      {/* МОДАЛКА ОФОРМЛЕНИЯ */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={settingsVisible}
        onRequestClose={() => setSettingsVisible(false)}
      >
        <TouchableWithoutFeedback onPress={() => setSettingsVisible(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <View style={[styles.menuContainer, { backgroundColor: theme.cardBg, paddingBottom: 50 }]}>

                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 25 }}>
                  <Text style={{ fontSize: 24, fontWeight: 'bold', color: theme.text }}>Тема приложения</Text>
                  <TouchableOpacity onPress={() => setSettingsVisible(false)} style={{ padding: 5 }}>
                    <Ionicons name="close" size={28} color={theme.text} />
                  </TouchableOpacity>
                </View>

                {/* THEME CARDS */}
                <View style={{ gap: 15 }}>
                  {[
                    { id: 'light', name: 'Светлая', desc: 'Классический стиль', icon: 'sunny-outline', color: '#FFD700', bg: '#f8f9fa' },
                    { id: 'space', name: 'Космос', desc: 'Глубокий темный режим', icon: 'planet-outline', color: '#a29bfe', bg: '#0b0d15' },
                    { id: 'aura', name: 'Аура', desc: 'Мистический градиент', icon: 'color-wand-outline', color: '#9b59b6', bg: '#2a1b3d' }
                  ].map((item) => (
                    <TouchableOpacity
                      key={item.id}
                      activeOpacity={0.7}
                      onPress={() => setTheme(item.id as any)}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        backgroundColor: themeType === item.id ? (isLight ? '#eee' : '#333') : 'transparent',
                        padding: 15,
                        borderRadius: 16
                      }}
                    >
                      {/* Icon Box */}
                      <View style={{
                        width: 50, height: 50, borderRadius: 14,
                        backgroundColor: item.bg,
                        justifyContent: 'center', alignItems: 'center',
                        marginRight: 15,
                        borderWidth: 1, borderColor: '#ffffff20'
                      }}>
                        <Ionicons name={item.icon as any} size={28} color={item.color} />
                      </View>

                      {/* Text */}
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 18, fontWeight: '600', color: theme.text, marginBottom: 4 }}>{item.name}</Text>
                        <Text style={{ fontSize: 14, color: theme.subText }}>{item.desc}</Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>

              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  menuContainer: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 40 },
  menuItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 15, gap: 15 },
  menuText: { fontSize: 18, fontWeight: '500' },
  divider: { height: 1, marginVertical: 10 }
});