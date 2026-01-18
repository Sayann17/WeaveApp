import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableWithoutFeedback,
  View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ThemedBackground } from '../components/ThemedBackground';
import { useNotifications } from '../context/NotificationContext';
import { useTelegram } from '../context/TelegramProvider';
import { useTheme } from '../context/ThemeContext';
import { yandexAuth } from '../services/yandex/AuthService';
import { yandexChat, type Message } from '../services/yandex/ChatService';
import { yandexMatch } from '../services/yandex/MatchService';
import { YandexUserService } from '../services/yandex/UserService';
import { normalize } from '../utils/normalize';
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

  // Block State
  const [blockConfirmVisible, setBlockConfirmVisible] = useState(false);
  const [reasonModalVisible, setReasonModalVisible] = useState(false);
  const [customReason, setCustomReason] = useState('');

  const BLOCK_REASONS = [
    'Мошенничество (Скам)',
    'Неприемлемый контент',
    'Нецензурная брань'
  ];

  const flatListRef = useRef<FlatList>(null);
  const inputRef = useRef<TextInput>(null);
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
      console.log('[ChatScreen] Received WebSocket message:', msg);
      console.log('[ChatScreen] Current chatId:', chatId);
      console.log('[ChatScreen] Message chatId:', msg.chatId);
      console.log('[ChatScreen] Match:', msg.chatId === chatId);

      if (msg.chatId === chatId) {
        console.log('[ChatScreen] Message matches current chat, updating UI');
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
      } else {
        console.log('[ChatScreen] Message does NOT match current chat, ignoring');
      }
    });

    return () => {
      unsubscribe();
    };
  }, [chatId]);

  // Telegram BackButton handler
  useFocusEffect(
    useCallback(() => {
      showBackButton();
      setBackButtonHandler(() => {
        router.back();
      });
      return () => {
        hideBackButton();
        setBackButtonHandler(null);
      };
    }, [])
  );

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !participantId || typeof participantId !== 'string') return;

    const currentUser = yandexAuth.getCurrentUser();
    if (!currentUser) return;

    const text = newMessage.trim();
    setNewMessage('');

    // Force keep focus to prevent keyboard dismissal on button press
    inputRef.current?.focus();

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

  // Block Functions
  const handleBlockInit = () => {
    setBlockConfirmVisible(true);
  };

  const confirmBlockInit = () => {
    setBlockConfirmVisible(false);
    setTimeout(() => {
      setReasonModalVisible(true);
    }, 100);
  };

  const submitBlock = async (reason: string) => {
    setReasonModalVisible(false);
    setCustomReason('');

    if (!participantId || typeof participantId !== 'string') return;

    try {
      // Call Backend
      if (yandexMatch.blockUser) {
        await yandexMatch.blockUser(participantId, reason);
      } else {
        console.warn('blockUser method not implemented in MatchService yet');
      }

      Alert.alert('Успешно', 'Пользователь заблокирован.', [
        { text: 'OK', onPress: () => router.back() }
      ]);
    } catch (e) {
      Alert.alert('Ошибка', 'Не удалось заблокировать пользователя');
      console.error(e);
    }
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
    // Check if we need to show date separator (inverted list, so check next message)
    const nextMsg = index < invertedMessages.length - 1 ? invertedMessages[index + 1] : null;
    const showDateSep = shouldShowDateSeparator(item, nextMsg);

    if (item.type === 'system') {
      return (
        <View key={item.id}>
          {showDateSep && (
            <View style={styles.dateSeparatorContainer}>
              <Text style={[styles.dateSeparatorText, { color: theme.subText }]}>
                {formatDateSeparator(item.timestamp)}
              </Text>
            </View>
          )}
          <View style={styles.systemMessageContainer}>
            <Text style={[styles.systemMessageText, { color: theme.subText }]}>{item.text}</Text>
          </View>
        </View>
      );
    }

    const isMine = isMyMessage(item);
    const repliedMsg = item.replyToId ? messages.find(m => m.id === item.replyToId) : null;

    return (
      <View key={item.id}>
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

            <View>
              <Text style={[
                styles.messageText,
                isMine ? styles.myMessageText : { color: theme.text }
              ]}>
                {item.text}
                {/* Dynamic Spacer: Uses actual time string + padding for ticks to reserve exact width */}
                <Text style={{ color: 'transparent', fontSize: normalize(12) }}>
                  {`\u00A0${formatMessageTime(item.timestamp)}\u00A0\u00A0\u00A0\u00A0\u00A0`}
                </Text>
              </Text>
              <View style={styles.metaContainerFloating}>
                {item.isEdited && <Text style={[styles.editedLabel, { color: isMine ? 'rgba(255,255,255,0.6)' : theme.subText }]}>изм.</Text>}
                <Text style={[
                  styles.messageTime,
                  isMine ? styles.myMessageTime : { color: theme.subText }
                ]}>
                  {formatMessageTime(item.timestamp)}
                </Text>
                {isMine && (
                  <Ionicons
                    name={item.isRead ? "checkmark-done" : "checkmark"}
                    size={normalize(16)}
                    color={item.isRead ? '#4ade80' : 'rgba(255,255,255,0.6)'}
                    style={{ marginLeft: normalize(4) }}
                  />
                )}
              </View>
            </View>
          </View>
        </Pressable>
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

          {/* Block Модалы */}
          {/* 1. Block Confirmation Modal */}
          <Modal
            transparent
            visible={blockConfirmVisible}
            animationType="fade"
            onRequestClose={() => setBlockConfirmVisible(false)}
          >
            <View style={[styles.modalOverlay, { backgroundColor: 'rgba(0,0,0,0.7)' }]}>
              <View style={[styles.alertBox, { backgroundColor: theme.cardBg }]}>
                <Text style={[styles.alertTitle, { color: theme.text }]}>Заблокировать пользователя?</Text>
                <Text style={[styles.alertMessage, { color: theme.subText }]}>
                  Это безвозвратное действие, которое приведет к полному удалению мэтча и истории переписки. Вы больше не увидите друг друга в поиске.
                </Text>
                <View style={styles.alertButtons}>
                  <Pressable
                    style={[styles.alertButton, { backgroundColor: theme.cardBg, borderColor: theme.border, borderWidth: 1 }]}
                    onPress={() => setBlockConfirmVisible(false)}
                  >
                    <Text style={[styles.alertButtonText, { color: theme.text }]}>Нет</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.alertButton, { backgroundColor: '#ff4444' }]}
                    onPress={confirmBlockInit}
                  >
                    <Text style={[styles.alertButtonText, { color: '#ffffff' }]}>Да</Text>
                  </Pressable>
                </View>
              </View>
            </View>
          </Modal>

          {/* 2. Reason Selection Modal */}
          <Modal
            transparent
            visible={reasonModalVisible}
            animationType="slide"
            onRequestClose={() => setReasonModalVisible(false)}
          >
            <TouchableWithoutFeedback onPress={() => setReasonModalVisible(false)}>
              <View style={[styles.modalOverlay, { backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' }]}>
                <TouchableWithoutFeedback>
                  <View style={[styles.reasonSheet, { backgroundColor: theme.cardBg }]}>
                    <View style={styles.reasonHeader}>
                      <Text style={[styles.reasonTitle, { color: theme.text }]}>Укажите причину</Text>
                      <Pressable onPress={() => setReasonModalVisible(false)}>
                        <Ionicons name="close-circle" size={normalize(20)} color={theme.subText} />
                      </Pressable>
                    </View>

                    {BLOCK_REASONS.map((reason) => (
                      <Pressable
                        key={reason}
                        style={[styles.reasonItem, { borderBottomColor: theme.border }]}
                        onPress={() => submitBlock(reason)}
                      >
                        <Text style={[styles.reasonText, { color: theme.text }]}>{reason}</Text>
                        <Ionicons name="chevron-forward" size={normalize(20)} color={theme.subText} />
                      </Pressable>
                    ))}

                    {/* Custom Reason */}
                    <View style={{ marginTop: 20 }}>
                      <Text style={[styles.label, { color: theme.subText }]}>Своя причина</Text>
                      <View style={[styles.inputContainerReason, { backgroundColor: isLight ? '#f5f5f5' : '#2a2a2a' }]}>
                        <TextInput
                          style={[styles.input, { color: theme.text }]}
                          value={customReason}
                          onChangeText={setCustomReason}
                          placeholder="Опишите причину..."
                          placeholderTextColor={theme.subText}
                          multiline
                        />
                      </View>
                      <Pressable
                        style={[styles.submitButton, { backgroundColor: customReason.trim() ? '#ff4444' : (isLight ? '#eee' : '#333') }]}
                        disabled={!customReason.trim()}
                        onPress={() => submitBlock(customReason.trim())}
                      >
                        <Text style={[styles.submitButtonText, { color: customReason.trim() ? '#fff' : theme.subText }]}>
                          Подтвердить
                        </Text>
                      </Pressable>
                    </View>
                  </View>
                </TouchableWithoutFeedback>
              </View>
            </TouchableWithoutFeedback>
          </Modal>

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
                  <Ionicons name="person" size={normalize(20)} color={theme.subText} />
                </View>
              )}
              <Text style={[styles.participantName, { color: theme.text }]} numberOfLines={1}>
                {participant?.name || 'Собеседник'}
              </Text>
            </Pressable>

            {/* Block Button */}
            <Pressable
              style={{ padding: 10 }}
              onPress={handleBlockInit}
            >
              <Ionicons name="ban-outline" size={normalize(24)} color="#ff4444" />
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
                  <Ionicons name="close" size={normalize(20)} color={theme.subText} />
                </Pressable>
              </View>
            )}

            {/* ПОЛЕ ВВОДА */}
            <View style={[styles.inputWrapper]}>
              <View style={[styles.inputContainer, { backgroundColor: theme.cardBg }]}>
                <TextInput
                  ref={inputRef}
                  style={[styles.textInput, { color: theme.text }]}
                  value={newMessage}
                  onChangeText={setNewMessage}
                  placeholder="Сообщение..."
                  placeholderTextColor={theme.subText}
                  multiline
                  blurOnSubmit={false}
                  maxLength={1000}
                  selectionColor={themeType === 'light' ? '#000000' : '#FFFFFF'}
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
                    size={normalize(20)}
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
    paddingHorizontal: normalize(15),
    paddingVertical: normalize(10),
    borderBottomWidth: 1,
  },
  participantInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  participantAvatar: {
    width: normalize(36),
    height: normalize(36),
    borderRadius: normalize(18),
    marginRight: normalize(10),
    backgroundColor: '#ddd',
  },
  fallbackAvatar: {
    width: normalize(36),
    height: normalize(36),
    borderRadius: normalize(18),
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: normalize(10),
  },
  participantName: {
    fontSize: normalize(16),
    fontWeight: '600',
  },

  // CHAT AREA
  chatContainer: { flex: 1 },
  messagesContent: { padding: normalize(15), paddingBottom: normalize(20) },

  // MESSAGES
  messageContainer: { marginBottom: normalize(10), flexDirection: 'row' },
  myMessage: { justifyContent: 'flex-end' },
  theirMessage: { justifyContent: 'flex-start' },

  messageBubble: {
    maxWidth: '80%',
    padding: normalize(10),
    paddingHorizontal: normalize(12),
    borderRadius: normalize(16),
  },
  myBubble: {
    borderBottomRightRadius: normalize(4),
  },
  theirBubble: {
    borderBottomLeftRadius: normalize(4),
  },

  messageText: { fontSize: normalize(16), lineHeight: normalize(22) },
  myMessageText: { color: '#ffffff' },

  metaContainer: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: normalize(4), alignItems: 'center' },
  metaContainerFloating: {
    position: 'absolute',
    bottom: -normalize(6),
    right: -normalize(4),
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'transparent'
  },
  messageTime: { fontSize: normalize(11), textAlign: 'right' },
  myMessageTime: { color: 'rgba(255,255,255,0.6)' },
  editedLabel: { fontSize: normalize(10), marginRight: normalize(4) },

  replyPreview: {
    borderLeftWidth: 2,
    paddingLeft: normalize(8),
    marginBottom: normalize(8),
    opacity: 0.8
  },
  replySender: { fontWeight: '600', fontSize: normalize(12), marginBottom: normalize(2) },
  replyText: { fontSize: normalize(12) },

  systemMessageContainer: { alignItems: 'center', marginVertical: normalize(15) },
  systemMessageText: {
    fontSize: normalize(12),
    backgroundColor: 'rgba(0,0,0,0.05)',
    paddingHorizontal: normalize(12),
    paddingVertical: normalize(4),
    borderRadius: normalize(10),
  },

  // DATE SEPARATOR
  dateSeparatorContainer: { alignItems: 'center', marginVertical: normalize(20) },
  dateSeparatorText: {
    fontSize: normalize(13),
    fontWeight: '600',
    backgroundColor: 'rgba(0,0,0,0.05)',
    paddingHorizontal: normalize(16),
    paddingVertical: normalize(6),
    borderRadius: normalize(12),
  },

  // ACTION BANNER
  actionBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: normalize(10),
    borderTopWidth: 1,
    borderBottomWidth: 1,
  },
  actionInfo: { flex: 1, paddingRight: normalize(10) },
  actionTitle: { fontWeight: '600', fontSize: normalize(12), marginBottom: normalize(2) },
  actionText: { fontSize: normalize(12) },
  closeAction: { padding: normalize(5) },

  // INPUT
  inputWrapper: {
    padding: normalize(10),
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    borderRadius: normalize(25),
    padding: normalize(5),
    borderWidth: 0,
  },
  textInput: {
    flex: 1,
    paddingHorizontal: normalize(15),
    paddingVertical: Platform.OS === 'ios' ? normalize(10) : normalize(8),
    fontSize: normalize(16),
    lineHeight: normalize(20),
    maxHeight: normalize(140), // ~6 lines (20 * 6 + padding)
    textAlignVertical: 'center',
    minHeight: normalize(40) // Standard touch target height
  },
  sendButton: {
    width: normalize(40),
    height: normalize(40),
    borderRadius: normalize(20),
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: normalize(2),
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },

  // BLOCK MODALS
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  alertBox: {
    width: '80%',
    maxWidth: normalize(400),
    padding: normalize(20),
    borderRadius: normalize(12),
  },
  alertTitle: {
    fontSize: normalize(18),
    fontWeight: '700',
    marginBottom: normalize(10),
    textAlign: 'center',
  },
  alertMessage: {
    fontSize: normalize(14),
    lineHeight: normalize(20),
    marginBottom: normalize(20),
    textAlign: 'center',
  },
  alertButtons: {
    flexDirection: 'row',
    gap: normalize(10),
  },
  alertButton: {
    flex: 1,
    paddingVertical: normalize(12),
    borderRadius: normalize(8),
    alignItems: 'center',
    justifyContent: 'center',
  },
  alertButtonText: {
    fontSize: normalize(16),
    fontWeight: '600',
  },

  // REASON SHEET (Slide Up)
  reasonSheet: {
    width: '100%',
    borderTopLeftRadius: normalize(20),
    borderTopRightRadius: normalize(20),
    padding: normalize(20),
    paddingBottom: normalize(40),
  },
  reasonHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: normalize(20),
  },
  reasonTitle: {
    fontSize: normalize(20),
    fontWeight: 'bold',
  },
  reasonItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: normalize(15),
    borderBottomWidth: 1,
  },
  reasonText: {
    fontSize: normalize(16),
  },
  label: { fontSize: normalize(14), marginBottom: normalize(8), fontWeight: '500' },
  inputContainerReason: {
    borderRadius: normalize(12),
    paddingHorizontal: normalize(12),
    paddingVertical: normalize(12),
    marginBottom: normalize(15),
  },
  input: { fontSize: normalize(16), minHeight: normalize(60), textAlignVertical: 'top' },
  submitButton: {
    borderRadius: normalize(12),
    paddingVertical: normalize(14),
    alignItems: 'center',
    marginTop: normalize(10),
  },
  submitButtonText: { fontSize: normalize(16), fontWeight: '600' },
});
