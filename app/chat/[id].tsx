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
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ThemedBackground } from '../components/ThemedBackground';
import { useNotifications } from '../context/NotificationContext';
import { useTelegram } from '../context/TelegramProvider';
import { useTheme } from '../context/ThemeContext';
import { yandexAuth } from '../services/yandex/AuthService';
import { yandexChat, type Message } from '../services/yandex/ChatService';
import { YandexUserService } from '../services/yandex/UserService';
import { getPlatformPadding } from '../utils/platformPadding';


import { MessageActionModal } from '../components/MessageActionModal';

const userService = new YandexUserService();

export default function ChatScreen() {
  const { id: chatId, participantId } = useLocalSearchParams();
  const { theme, themeType } = useTheme();
  const isLight = themeType === 'light';
  const insets = useSafeAreaInsets();
  const { refreshNotifications } = useNotifications();

  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [participant, setParticipant] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string>('');
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);

  // Custom Menu State
  const [menuVisible, setMenuVisible] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);

  const flatListRef = useRef<FlatList>(null);
  const router = useRouter();
  const { setBackButtonHandler, showBackButton, hideBackButton, isMobile } = useTelegram();

  // ... (useEffects remain same) ...
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

    yandexChat.connect().catch(console.error);

    const loadHistory = async () => {
      setIsLoading(true);
      try {
        await yandexChat.markAsRead(chatId); // Mark as read immediately on load
        refreshNotifications();
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

    const unsubscribe = yandexChat.onMessage((msg, eventType) => {
      if (msg.chatId === chatId) {
        if (eventType !== 'messageEdited') {
          yandexChat.markAsRead(chatId);
          refreshNotifications(); // Updates global badge
        }
        setMessages(prev => {
          if (eventType === 'messageEdited') {
            return prev.map(m => m.id === msg.id ? { ...m, ...msg, text: msg.text, isEdited: true, editedAt: msg.editedAt } : m);
          }
          if (prev.some(m => m.id === msg.id)) return prev;
          const myId = yandexAuth.getCurrentUser()?.uid;
          if (msg.senderId === myId) {
            const tempIndex = prev.findIndex(m => m.id.startsWith('temp-') && m.text === msg.text);
            if (tempIndex !== -1) {
              const newMessages = [...prev];
              newMessages[tempIndex] = msg;
              return newMessages;
            }
          }
          return [...prev, msg].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
        });
      }
    });

    return () => {
      unsubscribe();
    };
  }, [chatId]);

  // Telegram BackButton handler
  useEffect(() => {
    showBackButton();
    setBackButtonHandler(() => {
      router.back();
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

    if (editingMessage) {
      const updatedMsg = { ...editingMessage, text: text, isEdited: true, editedAt: new Date() };
      setMessages(prev => prev.map(m => m.id === editingMessage.id ? updatedMsg : m));
      setEditingMessage(null);

      try {
        await yandexChat.editMessage(chatId as string, editingMessage.id, text, participantId);
      } catch (e) {
        console.error(e);
        Alert.alert('Error', 'Failed to edit message');
      }
      return;
    }

    const replyId = replyingTo ? replyingTo.id : undefined;
    setReplyingTo(null);

    const tempId = `temp-${Date.now()}`;
    const optimisticMessage: Message = {
      id: tempId,
      chatId: chatId as string,
      text,
      senderId: currentUser.uid,
      timestamp: new Date(),
      type: 'text',
      replyToId: replyId
    };

    setMessages(prev => [...prev, optimisticMessage]);
    setIsSending(true);

    try {
      await yandexChat.sendMessage(chatId as string, text, participantId, replyId);
    } catch (error: any) {
      setMessages(prev => prev.filter(m => m.id !== tempId));
      setNewMessage(text);
      Alert.alert('Ошибка', 'Не удалось отправить сообщение');
    } finally {
      setIsSending(false);
    }
  };

  const onMessageLongPress = (item: Message) => {
    setSelectedMessage(item);
    setMenuVisible(true);
  };

  const handleReply = () => {
    if (selectedMessage) {
      setReplyingTo(selectedMessage);
      setEditingMessage(null);
      setMenuVisible(false);
      setSelectedMessage(null);
    }
  };

  const handleEdit = () => {
    if (selectedMessage) {
      setEditingMessage(selectedMessage);
      setReplyingTo(null);
      setNewMessage(selectedMessage.text);
      setMenuVisible(false);
      setSelectedMessage(null);
    }
  };

  const handleModalClose = () => {
    setMenuVisible(false);
    setSelectedMessage(null);
  };

  const cancelAction = () => {
    setReplyingTo(null);
    setEditingMessage(null);
    setNewMessage('');
  };

  const formatMessageTime = (date: Date) => {
    return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  };

  const formatDateSeparator = (date: Date) => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const messageDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

    if (messageDate.getTime() === today.getTime()) {
      return 'Сегодня';
    }

    return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
  };

  const shouldShowDateSeparator = (currentMsg: Message, prevMsg: Message | null) => {
    if (!prevMsg) return true;

    const currentDate = new Date(currentMsg.timestamp.getFullYear(), currentMsg.timestamp.getMonth(), currentMsg.timestamp.getDate());
    const prevDate = new Date(prevMsg.timestamp.getFullYear(), prevMsg.timestamp.getMonth(), prevMsg.timestamp.getDate());

    return currentDate.getTime() !== prevDate.getTime();
  };

  const isMyMessage = (message: Message) => message.senderId === yandexAuth.getCurrentUser()?.uid;

  const renderItem = ({ item, index }: { item: Message; index: number }) => {
    if (item.type === 'system') {
      return (
        <View key={item.id} style={styles.systemMessageContainer}>
          <Text style={[styles.systemMessageText, { color: theme.subText }]}>{item.text}</Text>
        </View>
      );
    }

    const isMine = isMyMessage(item);
    const repliedMsg = item.replyToId ? messages.find(m => m.id === item.replyToId) : null;

    // Check if we need to show date separator (inverted list, so check next message)
    const nextMsg = index < invertedMessages.length - 1 ? invertedMessages[index + 1] : null;
    const showDateSep = shouldShowDateSeparator(item, nextMsg);

    return (
      <>
        {showDateSep && (
          <View style={styles.dateSeparatorContainer}>
            <Text style={[styles.dateSeparatorText, { color: theme.subText }]}>
              {formatDateSeparator(item.timestamp)}
            </Text>
          </View>
        )}
        <Pressable
          onLongPress={() => onMessageLongPress(item)}
          delayLongPress={200}
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
            {repliedMsg && (
              <View style={[styles.replyPreview, { borderLeftColor: theme.accent }]}>
                <Text style={[styles.replySender, { color: theme.accent }]}>
                  {isMyMessage(repliedMsg) ? 'Вы' : (participant?.name || 'Собеседник')}
                </Text>
                <Text style={[styles.replyText, { color: theme.subText }]} numberOfLines={1}>
                  {repliedMsg.text}
                </Text>
              </View>
            )}

            <Text style={[
              styles.messageText,
              isMine ? styles.myMessageText : { color: theme.text }
            ]}>
              {item.text}
            </Text>
            <View style={styles.metaContainer}>
              {item.isEdited && <Text style={[styles.editedLabel, { color: isMine ? 'rgba(255,255,255,0.6)' : theme.subText }]}>изм.</Text>}
              <Text style={[
                styles.messageTime,
                isMine ? styles.myMessageTime : { color: theme.subText }
              ]}>
                {formatMessageTime(item.timestamp)}
              </Text>
            </View>
          </View>
        </Pressable>
      </>
    );
  };

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.background, justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ color: theme.subText }}>Загрузка...</Text>
      </View>
    );
  }

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

          <MessageActionModal
            visible={menuVisible}
            onClose={handleModalClose}
            onReply={handleReply}
            onEdit={selectedMessage && isMyMessage(selectedMessage) ? handleEdit : undefined}
            isMine={selectedMessage ? isMyMessage(selectedMessage) : false}
          />

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
            />

            {/* ACTION BANNER (Reply/Edit) */}
            {(replyingTo || editingMessage) && (
              <View style={[styles.actionBanner, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
                <View style={styles.actionInfo}>
                  <Text style={[styles.actionTitle, { color: theme.accent }]}>
                    {editingMessage ? 'Редактирование' : `Ответ ${isMyMessage(replyingTo!) ? 'себе' : participant?.name}`}
                  </Text>
                  <Text style={[styles.actionText, { color: theme.subText }]} numberOfLines={1}>
                    {editingMessage ? editingMessage.text : replyingTo!.text}
                  </Text>
                </View>
                <Pressable onPress={cancelAction} style={styles.closeAction}>
                  <Ionicons name="close" size={20} color={theme.subText} />
                </Pressable>
              </View>
            )}

            {/* ПОЛЕ ВВОДА */}
            <View style={[styles.inputWrapper]}>
              <View style={[styles.inputContainer, { backgroundColor: theme.cardBg }]}>
                <TextInput
                  style={[styles.textInput, { color: theme.text }]}
                  value={newMessage}
                  onChangeText={setNewMessage}
                  placeholder="Сообщение..."
                  placeholderTextColor={theme.subText}
                  multiline
                  maxLength={500}
                  editable={!isSending}
                  underlineColorAndroid="transparent"
                  // @ts-ignore
                  dataSet={{ outline: 'none' }}
                  nativeID="chat-input"
                />
                <Pressable
                  style={[
                    styles.sendButton,
                    { backgroundColor: editingMessage ? theme.accent : '#2a2a2a' },
                    (!newMessage.trim() || isSending) && styles.sendButtonDisabled
                  ]}
                  onPress={handleSendMessage}
                  disabled={!newMessage.trim() || isSending}
                >
                  <Ionicons
                    name={editingMessage ? "checkmark" : "arrow-up"}
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

  metaContainer: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 4, alignItems: 'center' },
  messageTime: { fontSize: 11, textAlign: 'right' },
  myMessageTime: { color: 'rgba(255,255,255,0.6)' },
  editedLabel: { fontSize: 10, marginRight: 4 },

  replyPreview: {
    borderLeftWidth: 2,
    paddingLeft: 8,
    marginBottom: 8,
    opacity: 0.8
  },
  replySender: { fontWeight: '600', fontSize: 12, marginBottom: 2 },
  replyText: { fontSize: 12 },

  systemMessageContainer: { alignItems: 'center', marginVertical: 15 },
  systemMessageText: {
    fontSize: 12,
    backgroundColor: 'rgba(0,0,0,0.05)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 10,
  },

  // DATE SEPARATOR
  dateSeparatorContainer: { alignItems: 'center', marginVertical: 20 },
  dateSeparatorText: {
    fontSize: 13,
    fontWeight: '600',
    backgroundColor: 'rgba(0,0,0,0.05)',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 12,
  },

  // ACTION BANNER
  actionBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderTopWidth: 1,
    borderBottomWidth: 1,
  },
  actionInfo: { flex: 1, paddingRight: 10 },
  actionTitle: { fontWeight: '600', fontSize: 12, marginBottom: 2 },
  actionText: { fontSize: 12 },
  closeAction: { padding: 5 },

  // INPUT
  inputWrapper: {
    padding: 10,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    borderRadius: 25,
    padding: 5,
    borderWidth: 0,
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