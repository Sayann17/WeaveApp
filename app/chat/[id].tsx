// app/chat/[id].tsx
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable, // Added FlatList
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ThemedBackground } from '../components/ThemedBackground';
import { useTelegram } from '../context/TelegramProvider';
import { useTheme } from '../context/ThemeContext';
import { yandexAuth } from '../services/yandex/AuthService';
import { yandexChat, type Message } from '../services/yandex/ChatService';
import { YandexUserService } from '../services/yandex/UserService';
import { getPlatformPadding } from '../utils/platformPadding';

const userService = new YandexUserService();

export default function ChatScreen() {
  const { id: chatId, participantId } = useLocalSearchParams();
  const { theme, themeType } = useTheme();
  const isLight = themeType === 'light';
  const insets = useSafeAreaInsets();

  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [participant, setParticipant] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string>('');
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const router = useRouter();
  const { setBackButtonHandler, showBackButton, hideBackButton, isMobile } = useTelegram();

  // Проверка параметров
  useEffect(() => {
    if (!participantId || typeof participantId !== 'string' || !chatId || typeof chatId !== 'string') {
      setError('Ошибка параметров чата');
      setIsLoading(false);
      return;
    }
  }, [chatId, participantId]);

  // Загрузка данных собеседника
  useEffect(() => {
    const loadParticipantData = async () => {
      try {
        if (participantId && typeof participantId === 'string') {
          const userData = await userService.getUser(participantId);
          if (userData) {
            setParticipant(userData);
          } else {
            setError('Пользователь не найден');
          }
        }
      } catch (error) {
        console.error('Error loading participant:', error);
        setError('Ошибка загрузки собеседника');
      }
    };
    loadParticipantData();
  }, [participantId]);

  // Подписка на сообщения
  useEffect(() => {
    if (!chatId || typeof chatId !== 'string') return;

    // Ensure WebSocket is connected
    yandexChat.connect().catch(console.error);

    const loadHistory = async () => {
      setIsLoading(true);
      try {
        const history = await yandexChat.getHistory(chatId);
        setMessages(history);
      } catch (err) {
        console.error('History load error:', err);
        setError('Ошибка загрузки сообщений');
      } finally {
        setIsLoading(false);
      }
    };

    loadHistory();

    const unsubscribe = yandexChat.onMessage((msg) => {
      console.log('[Chat] 🔔 WebSocket message received:', {
        messageId: msg.id,
        chatId: msg.chatId,
        currentChatId: chatId,
        senderId: msg.senderId,
        text: msg.text.substring(0, 30)
      });

      if (msg.chatId === chatId) {
        console.log('[Chat] ✅ Message matches current chat, updating UI');
        setMessages(prev => {
          // 1. Check if we already have this exact message ID
          if (prev.some(m => m.id === msg.id)) {
            console.log('[Chat] ⚠️ Duplicate message, skipping');
            return prev;
          }

          // 2. If it's my message, try to find and replace the optimistic "temp" message
          const myId = yandexAuth.getCurrentUser()?.uid;
          if (msg.senderId === myId) {
            const tempIndex = prev.findIndex(m =>
              m.id.startsWith('temp-') &&
              m.text === msg.text &&
              Math.abs(m.timestamp.getTime() - msg.timestamp.getTime()) < 30000 // 30 sec window
            );

            if (tempIndex !== -1) {
              console.log('[Chat] 🔄 Replacing temp message with real one');
              const newMessages = [...prev];
              newMessages[tempIndex] = msg; // Replace temp with real
              return newMessages;
            }
          }

          // 3. New message from other user or no temp found
          console.log('[Chat] ➕ Adding new message to list');
          const newMessages = [...prev, msg];
          return newMessages.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
        });
        // With inverted list, new messages are at index 0 (bottom).
        // FlatList usually auto-updates correctly. 
        // If we want to force scroll to bottom (which is top of inverted list):
        // setTimeout(() => flatListRef.current?.scrollToOffset({ offset: 0, animated: true }), 100);
      } else {
        console.log('[Chat] ⚠️ Message for different chat, ignoring');
      }
    });

    // Keyboard handling is automatic with KeyboardAvoidingView + Inverted FlatList
    // We don't need manual listeners usually.

    return () => {
      unsubscribe();
    };
  }, [chatId]);

  // Telegram BackButton handler
  useEffect(() => {
    showBackButton();
    setBackButtonHandler(() => {
      router.back(); // Navigate back to chats list
    });

    return () => {
      hideBackButton();
      setBackButtonHandler(null);
    };
  }, []);

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !participantId || typeof participantId !== 'string') return;

    const currentUser = yandexAuth.getCurrentUser();
    if (!currentUser) return;

    const text = newMessage.trim();
    setNewMessage('');

    // Optimistic Update
    const tempId = `temp-${Date.now()}`;
    const optimisticMessage: Message = {
      id: tempId,
      chatId: chatId as string,
      text,
      senderId: currentUser.uid,
      timestamp: new Date(),
      type: 'text'
    };

    setMessages(prev => [...prev, optimisticMessage]);

    // Scroll to bottom (start of inverted list)
    // flatListRef.current?.scrollToOffset({ offset: 0, animated: true });

    setIsSending(true);
    try {
      await yandexChat.sendMessage(chatId as string, text, participantId);
    } catch (error: any) {
      // Remove optimistic message on error
      setMessages(prev => prev.filter(m => m.id !== tempId));
      setNewMessage(text); // Restore text
      Alert.alert('Ошибка', 'Не удалось отправить сообщение');
    } finally {
      setIsSending(false);
    }
  };

  const formatMessageTime = (date: Date) => {
    return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  };

  const isMyMessage = (message: Message) => message.senderId === yandexAuth.getCurrentUser()?.uid;

  const renderItem = ({ item }: { item: Message }) => {
    if (item.type === 'system') {
      return (
        <View key={item.id} style={styles.systemMessageContainer}>
          <Text style={[styles.systemMessageText, { color: theme.subText }]}>{item.text}</Text>
        </View>
      );
    }

    const isMine = isMyMessage(item);

    return (
      <View
        key={item.id}
        style={[
          styles.messageContainer,
          isMine ? styles.myMessage : styles.theirMessage
        ]}
      >
        <View style={[
          styles.messageBubble,
          isMine ? { backgroundColor: '#2a2a2a' } : { backgroundColor: theme.cardBg },
          isMine ? styles.myBubble : styles.theirBubble,
          !isMine && { borderWidth: 1, borderColor: theme.border }
        ]}>
          <Text style={[
            styles.messageText,
            isMine ? styles.myMessageText : { color: theme.text }
          ]}>
            {item.text}
          </Text>
          <Text style={[
            styles.messageTime,
            isMine ? styles.myMessageTime : { color: theme.subText }
          ]}>
            {formatMessageTime(item.timestamp)}
          </Text>
        </View>
      </View>
    );
  };

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.background, justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ color: theme.subText }}>Загрузка...</Text>
      </View>
    );
  }

  // Calculate Reversed Messages for Inverted List
  // messages is sorted [Old -> New]
  // Inverted List wants [New -> Old] at indices [0, 1, 2...] which render at Bottom -> Top
  const invertedMessages = [...messages].reverse();

  return (
    <ThemedBackground>
      <StatusBar barStyle={isLight ? "dark-content" : "light-content"} />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        <View style={{ flex: 1, paddingTop: getPlatformPadding(insets, isMobile, 78) }}>

          {/* ХЕДЕР */}
          <View style={[styles.header, { borderBottomColor: theme.border }]}>
            <Pressable
              style={styles.participantInfo}
              onPress={() => participantId && router.push(`/users/${participantId}` as any)}
            >
              {participant?.photos?.[0] ? (
                <Image
                  source={{ uri: participant.photos[0] }}
                  style={styles.participantAvatar}
                />
              ) : (
                <View style={[styles.fallbackAvatar, { backgroundColor: theme.cardBg }]}>
                  <Ionicons name="person" size={20} color={theme.subText} />
                </View>
              )}
              <Text style={[styles.participantName, { color: theme.text }]} numberOfLines={1}>
                {participant?.name || 'Собеседник'}
              </Text>
            </Pressable>
          </View>

          {/* СООБЩЕНИЯ (FlatList Inverted) */}
          <View style={styles.chatContainer}>
            <FlatList
              ref={flatListRef}
              data={invertedMessages}
              renderItem={renderItem}
              keyExtractor={(item: Message) => item.id}
              inverted
              contentContainerStyle={styles.messagesContent}
              keyboardDismissMode="interactive"
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={
                <View style={[styles.emptyChat, { transform: [{ scaleY: -1 }] }]}>
                  {/* Inverted list flips the component, so we flip it back if needed, 
                       but ListEmptyComponent in inverted list renders at top? 
                       Actually inverted list renders items starting from bottom.
                       Empty component might behave normally. Let's start without transform. 
                       Wait, inverted flatlist flips the coordinate system. 
                   */}
                  <View style={{ transform: [{ scaleY: -1 }] }}>
                    <Text style={[styles.emptyChatText, { color: theme.subText }]}>
                      Начните общение ✨{'\n'}Первое слово важнее всего.
                    </Text>
                  </View>
                </View>
              }
            />

            {/* ПОЛЕ ВВОДА */}
            <View style={[styles.inputWrapper]}>
              <View style={[styles.inputContainer, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
                <TextInput
                  style={[styles.textInput, { color: theme.text }]}
                  value={newMessage}
                  onChangeText={setNewMessage}
                  placeholder="Сообщение..."
                  placeholderTextColor={theme.subText}
                  multiline
                  maxLength={500}
                  editable={!isSending}
                />
                <Pressable
                  style={[
                    styles.sendButton,
                    { backgroundColor: '#2a2a2a' },
                    (!newMessage.trim() || isSending) && styles.sendButtonDisabled
                  ]}
                  onPress={handleSendMessage}
                  disabled={!newMessage.trim() || isSending}
                >
                  <Ionicons
                    name="arrow-up"
                    size={20}
                    color="#ffffff"
                  />
                </Pressable>
              </View>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </ThemedBackground>
  );
}

const styles = StyleSheet.create({
  // HEADER
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  backButton: { padding: 5 },
  participantInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  participantAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: 10,
    backgroundColor: '#ddd',
  },
  fallbackAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  participantName: {
    fontSize: 16,
    fontWeight: '600',
  },

  // CHAT AREA
  chatContainer: { flex: 1 },
  // messagesList: { flex: 1 }, // Removed
  messagesContent: { padding: 15, paddingBottom: 20 },

  // MESSAGES
  messageContainer: { marginBottom: 10, flexDirection: 'row' },
  myMessage: { justifyContent: 'flex-end' },
  theirMessage: { justifyContent: 'flex-start' },

  messageBubble: {
    maxWidth: '75%',
    padding: 12,
    borderRadius: 18,
  },
  myBubble: {
    borderBottomRightRadius: 4,
  },
  theirBubble: {
    borderBottomLeftRadius: 4,
  },

  messageText: { fontSize: 16, lineHeight: 22 },
  myMessageText: { color: '#ffffff' },

  messageTime: { fontSize: 11, marginTop: 4, textAlign: 'right' },
  myMessageTime: { color: 'rgba(255,255,255,0.6)' },
  readStatus: { fontSize: 10 },

  systemMessageContainer: { alignItems: 'center', marginVertical: 15 },
  systemMessageText: {
    fontSize: 12,
    backgroundColor: 'rgba(0,0,0,0.05)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 10,
  },

  emptyChat: { flex: 1, alignItems: 'center', justifyContent: 'center', height: 400 },
  emptyChatText: { textAlign: 'center', lineHeight: 22 },

  // INPUT
  inputWrapper: {
    padding: 10,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    borderRadius: 25,
    padding: 5,
    borderWidth: 1,
  },
  textInput: {
    flex: 1,
    paddingHorizontal: 15,
    paddingVertical: 10,
    fontSize: 16,
    maxHeight: 100,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 2,
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
});