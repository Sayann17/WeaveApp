import { Ionicons } from '@expo/vector-icons';
import { useTelegram } from '../context/TelegramProvider';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Image,
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
import { useNotifications } from '../context/NotificationContext';
import { useTheme } from '../context/ThemeContext';
import { yandexAuth } from '../services/yandex/AuthService';
import { yandexChat, type Chat } from '../services/yandex/ChatService';
import { YandexUserService } from '../services/yandex/UserService';

const userService = new YandexUserService();

interface ChatWithUserData extends Chat {
  participantName: string;
  participantPhoto: string;
  participantId: string;
  participantAge?: number;
  participantEthnicity?: string;
  participantMacroGroups?: string[];
}

export default function ChatsScreen() {
  const { theme, themeType } = useTheme();
  const [chats, setChats] = useState<ChatWithUserData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const router = useRouter();
  const { resetUnreadMessages } = useNotifications();
  const insets = useSafeAreaInsets();
  const { hideBackButton } = useTelegram(); // Added hideBackButton

  const isLight = themeType === 'light';

  useFocusEffect(
    useCallback(() => {
      // Logic to run when the screen comes into focus
      hideBackButton();

      const loadChats = async () => {
        try {
          const currentUser = yandexAuth.getCurrentUser();
          if (!currentUser) {
            setIsLoading(false);
            router.replace('/(auth)');
            return;
          }

          // Initial load
          const chatsList = await yandexChat.getChats();
          const chatsWithUserData: ChatWithUserData[] = chatsList.map(chat => {
            const otherParticipantId = chat.matchId || chat.id.split('_').find(id => id !== currentUser.uid);
            return {
              ...chat,
              participantName: chat.name || 'Пользователь',
              participantPhoto: chat.photo || '',
              participantId: otherParticipantId || '',
              participantAge: chat.age,
              participantEthnicity: chat.ethnicity,
              participantMacroGroups: chat.macroGroups
            };
          });

          chatsWithUserData.sort((a, b) => {
            const timeA = a.lastMessageTime?.getTime() || 0;
            const timeB = b.lastMessageTime?.getTime() || 0;
            return timeB - timeA;
          });

          setChats(chatsWithUserData);
          setIsLoading(false);
          setRefreshing(false);
        } catch (error) {
          console.error('Error loading chats:', error);
          setIsLoading(false);
        }
      };

      loadChats();
      resetUnreadMessages();

      // Ensure we are connected for real-time updates
      yandexChat.connect().catch(console.error);

      // Real-time update listener
      const unsubscribe = yandexChat.onMessage((message) => {
        loadChats(); // Refresh on any new message
      });

      return () => {
        unsubscribe();
      };
    }, [])
  );

  const onRefresh = () => {
    setRefreshing(true);
    // Subscription updates automatically, but for UX:
    setTimeout(() => setRefreshing(false), 1000);
  };

  const formatLastMessageTime = (val?: any) => {
    if (!val) return '';
    // Handle Firestore Timestamp or Date
    const date = val.toDate ? val.toDate() : new Date(val);
    if (isNaN(date.getTime())) return '';

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const messageDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

    // If message is from today, show time (HH:MM)
    if (messageDate.getTime() === today.getTime()) {
      return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    }

    // Otherwise show date (DD.MM)
    return date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
  };

  const getUnreadCount = (chat: any): number => {
    // Current YDB schema doesn't support unread count yet, 
    // but we can add it later. For now, returning 0.
    return 0;
  };

  // Helper to format heritage string
  const getHeritageString = (chat: ChatWithUserData) => {
    const ETHNICITY_MAP: Record<string, string> = {
      slavic: 'Славянские', asian: 'Азиатские', caucasian: 'Кавказские',
      finno_ugric: 'Финно-угорские', european: 'Европейские', african: 'Африканские',
      latin: 'Латиноамериканские', arab: 'Арабские', jewish: 'Еврейские',
      indian: 'Индийские', native_american: 'Коренные', pacific: 'Тихоокеанские',
      middle_eastern: 'Ближневосточные', turkic: 'Тюркские'
    };

    const parts = [];

    // Show macroGroups (roots) if available
    if (chat.participantMacroGroups && Array.isArray(chat.participantMacroGroups) && chat.participantMacroGroups.length > 0) {
      const roots = chat.participantMacroGroups.map((g: string) => ETHNICITY_MAP[g] || g).join(', ');
      parts.push(`${roots} корни`);
    }

    // Show ethnicity (nationality) if available
    if (chat.participantEthnicity) {
      parts.push(chat.participantEthnicity.charAt(0).toUpperCase() + chat.participantEthnicity.slice(1).toLowerCase());
    }

    return parts.join(' • ');
  };

  const renderChatItem = (chat: ChatWithUserData) => {
    const unreadCount = getUnreadCount(chat);

    return (
      <Pressable
        key={chat.id}
        style={({ pressed }) => [
          styles.chatItem,
          { backgroundColor: theme.cardBg },
          pressed && { opacity: 0.8 }
        ]}
        onPress={() => {
          router.push({ pathname: '/chat/[id]', params: { id: chat.id, participantId: chat.participantId } });
        }}
      >
        <View style={styles.avatarContainer}>
          {chat.participantPhoto ? (
            <Image
              source={{ uri: chat.participantPhoto }}
              style={styles.avatar}
            />
          ) : (
            <View style={[styles.fallbackAvatar, { backgroundColor: isLight ? '#f0f0f0' : 'rgba(255,255,255,0.1)' }]}>
              <Ionicons name="person" size={24} color={theme.subText} />
            </View>
          )}
          {unreadCount > 0 && (
            <View style={[styles.unreadBadge, { backgroundColor: theme.accent, borderColor: theme.cardBg }]}>
              <Text style={styles.unreadCount}>
                {unreadCount > 9 ? '9+' : unreadCount}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.chatInfo}>
          <View style={styles.chatHeader}>
            <Text style={[styles.participantName, { color: theme.text }]} numberOfLines={1}>
              {chat.participantName}{chat.participantAge ? `, ${chat.participantAge}` : ''}
            </Text>
            <Text style={[styles.messageTime, { color: theme.subText }]}>
              {formatLastMessageTime(chat.lastMessageTime)}
            </Text>
          </View>

          {getHeritageString(chat) ? (
            <Text style={[styles.heritageText, { color: '#4ade80' }]} numberOfLines={1}>
              {getHeritageString(chat)}
            </Text>
          ) : null}

          <Text
            style={[
              styles.lastMessage,
              { color: theme.subText },
              unreadCount > 0 && { color: theme.text, fontWeight: '600' }
            ]}
            numberOfLines={1}
          >
            {chat.lastMessage || 'Нет сообщений'}
          </Text>
        </View>
      </Pressable>
    );
  };

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.background, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={theme.text} />
      </View>
    );
  }

  return (
    <ThemedBackground>
      <StatusBar barStyle={isLight ? "dark-content" : "light-content"} />

      <View style={{ flex: 1 }}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 95 }]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.text} />
          }
        >
          {chats.length > 0 ? (
            chats.map(renderChatItem)
          ) : (
            <View style={styles.emptyContainer}>
              <View style={[styles.emptyIconBg, { backgroundColor: isLight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.1)' }]}>
                <Ionicons name="chatbubbles-outline" size={40} color={theme.subText} />
              </View>
              <Text style={[styles.emptyTitle, { color: theme.text }]}>Здесь пока тихо</Text>
              <Text style={[styles.emptyText, { color: theme.subText }]}>
                Ваши диалоги появятся здесь после{'\n'}взаимной симпатии.
              </Text>
            </View>
          )}
          <View style={{ height: 20 }} />
        </ScrollView>
      </View>
    </ThemedBackground>
  );
}

const styles = StyleSheet.create({
  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 20 },
  chatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    borderRadius: 16,
    marginBottom: 10,
  },
  avatarContainer: { position: 'relative', marginRight: 15 },
  avatar: { width: 56, height: 56, borderRadius: 28 },
  fallbackAvatar: { width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center' },
  unreadBadge: {
    position: 'absolute',
    right: -2,
    top: -2,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    paddingHorizontal: 4
  },
  unreadCount: { color: 'white', fontSize: 10, fontWeight: 'bold' },
  chatInfo: { flex: 1, justifyContent: 'center' },
  chatHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  participantName: { fontSize: 16, fontWeight: '600', flex: 1, marginRight: 10 },
  messageTime: { fontSize: 12 },
  heritageText: { fontSize: 13, marginBottom: 2 },
  lastMessage: { fontSize: 14 },
  emptyContainer: { alignItems: 'center', justifyContent: 'center', marginTop: 100 },
  emptyIconBg: { width: 80, height: 80, borderRadius: 40, justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  emptyTitle: { fontSize: 20, fontWeight: '600', marginBottom: 10 },
  emptyText: { textAlign: 'center', fontSize: 14, lineHeight: 20 }
});