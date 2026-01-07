// @ts-nocheck
// app/chat/[id].tsx
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StatusBar,
  StyleSheet,
  View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNotifications } from '../context/NotificationContext';
import { useTelegram } from '../context/TelegramProvider';
import { useTheme } from '../context/ThemeContext';
import { yandexAuth } from '../services/yandex/AuthService';
import { yandexChat, type Message } from '../services/yandex/ChatService';
import { YandexUserService } from '../services/yandex/UserService';
import { getPlatformPadding } from '../utils/platformPadding';
import { AppRoot, Input, Avatar, Text, Button, IconButton } from '@telegram-apps/telegram-ui';
import { ThemedBackground } from '../components/ThemedBackground';

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
          {/* Avatar for their message */}
          {!isMine && (
            <View style={{ marginRight: 8, alignSelf: 'flex-end', marginBottom: 4 }}>
              {/* Small Avatar if needed, else nothing or just verify design */}
            </View>
          )}

          <View style={[
            styles.messageBubble,
            isMine ? { backgroundColor: themeType === 'dark' ? '#2b5278' : '#e3f3ff' } : { backgroundColor: theme.cardBg }, // Adjusted colors
            isMine ? styles.myBubble : styles.theirBubble,
            !isMine && { borderWidth: 0, backgroundColor: themeType === 'dark' ? '#1f1f1f' : '#ffffff' } // Native dark theme default
          ]}>
            {repliedMsg && (
              <View style={[styles.replyPreview, { borderLeftColor: theme.accent }]}>
                <Text style={{ fontWeight: '500', fontSize: 13, color: theme.accent, marginBottom: 2 }}>
                  {isMyMessage(repliedMsg) ? 'Вы' : (participant?.name || 'Собеседник')}
                </Text>
                <Text style={{ fontSize: 13, color: theme.subText }} numberOfLines={1}>
                  {repliedMsg.text}
                </Text>
              </View>
            )}

            <Text style={[
              styles.messageText,
              { color: isMine ? (themeType === 'dark' ? '#ffffff' : '#000000') : theme.text }
            ]}>
              {item.text}
            </Text>
            <View style={styles.metaContainer}>
              {item.isEdited && <Text style={[styles.editedLabel, { color: theme.subText }]}>изм.</Text>}
              <Text style={[
                styles.messageTime,
                { color: isMine ? (themeType === 'dark' ? '#8faec5' : '#5994c2') : theme.subText } // Native time colors
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
    <AppRoot
      appearance={isLight ? 'light' : 'dark'}
      platform={isMobile ? 'ios' : 'base'}
      style={{
        flex: 1,
        width: '100%',
        height: '100%',
      }}
    >
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

            {/* ХЕДЕР (Native Look) */}
            <View style={[styles.header, { borderBottomColor: theme.border, backgroundColor: theme.background }]}>
              {/* Back button logic handled by Telegram BackButton, but strictly visual header content here */}
              <View style={styles.headerContent}>
                {participant?.photos?.[0] ? (
                  <Avatar
                    src={participant.photos[0]}
                    size={40}
                    style={{ marginRight: 10 }}
                  />
                ) : (
                  <Avatar
                    acronym={participant?.name?.[0] || '?'}
                    size={40}
                    style={{ marginRight: 10, backgroundColor: theme.accent }}
                  />
                )}
                <View>
                  <Text weight="2" style={{ color: theme.text }}>
                    {participant?.name || 'Собеседник'}
                  </Text>
                  <Text caption style={{ color: theme.subText }}>
                    В сети
                  </Text>
                </View>
              </View>
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
                    <Text weight="2" style={{ color: theme.accent }}>
                      {editingMessage ? 'Редактирование' : `Ответ ${isMyMessage(replyingTo!) ? 'себе' : participant?.name}`}
                    </Text>
                    <Text style={{ color: theme.subText }} numberOfLines={1}>
                      {editingMessage ? editingMessage.text : replyingTo!.text}
                    </Text>
                  </View>
                  <Pressable onPress={cancelAction} style={styles.closeAction}>
                    <Ionicons name="close" size={20} color={theme.subText} />
                  </Pressable>
                </View>
              )}

              {/* ПОЛЕ ВВОДА (Native Look) */}
              <View style={[styles.inputContainer, { backgroundColor: theme.cardBg, borderTopColor: theme.border }]}>
                {/* Attach Button (Mock) */}
                <Pressable style={styles.attachButton}>
                  <Ionicons name="attach" size={28} color={theme.subText} />
                </Pressable>

                <View style={{ flex: 1 }}>
                  <Input
                    value={newMessage}
                    onChange={(e: any) => setNewMessage(e.target.value)}
                    placeholder="Сообщение"
                    style={{ backgroundColor: theme.background }}
                  />
                </View>

                {/* Send Button */}
                {newMessage.trim().length > 0 && (
                  <Pressable
                    onPress={handleSendMessage}
                    style={styles.sendButton}
                    disabled={isSending}
                  >
                    <Ionicons name="arrow-up-circle" size={32} color={theme.accent} />
                  </Pressable>
                )}
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </ThemedBackground>
    </AppRoot>
  );
}

const styles = StyleSheet.create({
  // HEADER
  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    borderBottomWidth: 0.5, // Subtle border
    zIndex: 10,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  // CHAT AREA
  chatContainer: { flex: 1 },
  messagesContent: { paddingHorizontal: 10, paddingVertical: 10 },

  // MESSAGES
  messageContainer: { marginBottom: 6, flexDirection: 'row', maxWidth: '100%' },
  myMessage: { justifyContent: 'flex-end' },
  theirMessage: { justifyContent: 'flex-start' },

  messageBubble: {
    maxWidth: '80%',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 16,
    minWidth: 80,
  },
  myBubble: {
    borderBottomRightRadius: 2,
  },
  theirBubble: {
    borderBottomLeftRadius: 2,
  },

  messageText: { fontSize: 16, lineHeight: 21 },

  metaContainer: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 2, alignItems: 'center' },
  messageTime: { fontSize: 11 },
  editedLabel: { fontSize: 11, marginRight: 4 },

  replyPreview: {
    borderLeftWidth: 2,
    paddingLeft: 8,
    marginBottom: 4,
    opacity: 0.8
  },

  systemMessageContainer: { alignItems: 'center', marginVertical: 12 },
  systemMessageText: {
    fontSize: 12,
    backgroundColor: 'rgba(128,128,128,0.2)',
    paddingHorizontal: 10,
    paddingVertical: 2,
    borderRadius: 12,
    overflow: 'hidden',
  },

  // DATE SEPARATOR
  dateSeparatorContainer: { alignItems: 'center', marginVertical: 12 },
  dateSeparatorText: {
    fontSize: 12,
    fontWeight: '600',
    backgroundColor: 'rgba(128,128,128,0.2)',
    paddingHorizontal: 10,
    paddingVertical: 2,
    borderRadius: 12,
    overflow: 'hidden',
  },

  // ACTION BANNER
  actionBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    borderTopWidth: 1,
  },
  actionInfo: { flex: 1, paddingRight: 10, paddingLeft: 4 },
  closeAction: { padding: 5 },

  // INPUT
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 6,
    borderTopWidth: 0.5
  },
  attachButton: { padding: 8, marginBottom: 4 },
  sendButton: { padding: 4, marginLeft: 4, marginBottom: 2 },
});