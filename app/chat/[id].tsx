// app/chat/[id].tsx
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
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
  const scrollViewRef = useRef<ScrollView>(null);
  const router = useRouter();
  const { setBackButtonHandler, showBackButton, hideBackButton } = useTelegram();

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
      if (msg.chatId === chatId) {
        setMessages(prev => {
          // 1. Check if we already have this exact message ID
          if (prev.some(m => m.id === msg.id)) return prev;

          // 2. If it's my message, try to find and replace the optimistic "temp" message
          const myId = yandexAuth.getCurrentUser()?.uid;
          if (msg.senderId === myId) {
            const tempIndex = prev.findIndex(m =>
              m.id.startsWith('temp-') &&
              m.text === msg.text &&
              Math.abs(m.timestamp.getTime() - msg.timestamp.getTime()) < 30000 // 30 sec window
            );

            if (tempIndex !== -1) {
              const newMessages = [...prev];
              newMessages[tempIndex] = msg; // Replace temp with real
              return newMessages;
            }
          }

          // 3. New message from other user or no temp found
          const newMessages = [...prev, msg];
          return newMessages.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
        });
        // Scroll slightly delayed to ensure rendering is done
        setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);
      }
    });

    const showSubscription = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      () => {
        setKeyboardVisible(true);
        // Scroll to bottom when keyboard opens
        setTimeout(() => {
          if (scrollViewRef.current) {
            scrollViewRef.current.scrollToEnd({ animated: true });
          }
        }, 150);
      }
    );

    const hideSubscription = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => {
        setKeyboardVisible(false);
      }
    );

    return () => {
      unsubscribe();
      showSubscription.remove();
      hideSubscription.remove();
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
    setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);

    setIsSending(true);
    try {
      await yandexChat.sendMessage(chatId as string, text, participantId);
      // We don't remove the temp message here because the WS echo-back 
      // will come with the real ID, and we should keep the list clean.
      // Actually, if we want to replace it, we'd need more complex state.
      // For now, deduplication in onMessage will handle the echo-back.
      // Wait, if the echo-back has a different ID, we'll have duplicates.
      // Backend generates UUID: const messageId = uuidv4();
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

  const renderMessage = (message: Message) => {
    if (message.type === 'system') {
      return (
        <View key={message.id} style={styles.systemMessageContainer}>
          <Text style={[styles.systemMessageText, { color: theme.subText }]}>{message.text}</Text>
        </View>
      );
    }

    const isMine = isMyMessage(message);

    return (
      <View
        key={message.id}
        style={[
          styles.messageContainer,
          isMine ? styles.myMessage : styles.theirMessage
        ]}
      >
        <View style={[
          styles.messageBubble,
          isMine ? { backgroundColor: '#2a2a2a' } : { backgroundColor: theme.cardBg }, // Мои темные, чужие под тему
          isMine ? styles.myBubble : styles.theirBubble,
          !isMine && { borderWidth: 1, borderColor: theme.border }
        ]}>
          <Text style={[
            styles.messageText,
            isMine ? styles.myMessageText : { color: theme.text }
          ]}>
            {message.text}
          </Text>
          <Text style={[
            styles.messageTime,
            isMine ? styles.myMessageTime : { color: theme.subText }
          ]}>
            {formatMessageTime(message.timestamp)}
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

  return (
    <ThemedBackground>
      <StatusBar barStyle={isLight ? "dark-content" : "light-content"} />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <View style={{ flex: 1, paddingTop: insets.top + 78 }}>

          {/* ХЕДЕР */}
          <View style={[styles.header, { borderBottomColor: theme.border }]}>
            <Pressable style={styles.backButton} onPress={() => router.back()}>
              <Ionicons name="chevron-back" size={28} color={theme.text} />
            </Pressable>

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

            <View style={{ width: 40 }} />
          </View>

          {/* СООБЩЕНИЯ */}
          <View style={styles.chatContainer}>
            <ScrollView
              ref={scrollViewRef}
              style={styles.messagesList}
              contentContainerStyle={styles.messagesContent}
              showsVerticalScrollIndicator={false}
              keyboardDismissMode="on-drag"
              onContentSizeChange={() => {
                // Scroll to bottom when content changes (new messages)
                setTimeout(() => {
                  scrollViewRef.current?.scrollToEnd({ animated: true });
                }, 100);
              }}
            >
              {messages.length > 0 ? (
                messages.map(renderMessage)
              ) : (
                <View style={styles.emptyChat}>
                  <Text style={[styles.emptyChatText, { color: theme.subText }]}>
                    Начните общение ✨{'\n'}Первое слово важнее всего.
                  </Text>
                </View>
              )}
            </ScrollView>

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
                    { backgroundColor: '#2a2a2a' }, // Кнопка отправки всегда темная акцентная
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
  messagesList: { flex: 1 },
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

  emptyChat: { alignItems: 'center', marginTop: 50 },
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