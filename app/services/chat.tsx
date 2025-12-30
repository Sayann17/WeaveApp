// services/chat.tsx
import {
  addDoc,
  collection,
  doc,
  DocumentData,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch
} from 'firebase/firestore';
import { auth, firestore } from '../config/firebase';

export interface Message {
  id: string;
  text: string;
  senderId: string;
  receiverId: string;
  timestamp: Date;
  read: boolean;
  type: 'text' | 'image' | 'system';
}

export interface Chat {
  id: string;
  participants: string[];
  lastMessage?: string;
  lastMessageTime?: Date;
  unreadCount: { [userId: string]: number };
  createdAt: Date;
  isMatchChat: boolean;
  // Полезные поля для UI (заполняются отдельно)
  otherUserId?: string; 
  otherUserName?: string;
  otherUserPhoto?: string;
}

class ChatService {
  private readonly MAX_RETRIES = 3;

  /**
   * Возвращает ID собеседника для текущего пользователя
   */
  getChatPartnerId(currentUserId: string, participants: string[]): string | null {
    return participants.find(id => id !== currentUserId) || null;
  }

  /**
   * Создание или получение чата (для обычного общения)
   */
  async getOrCreateChat(participantId: string): Promise<string> {
    const currentUser = auth.currentUser;
    if (!currentUser) throw new Error('User not authenticated');

    const participants = [currentUser.uid, participantId].sort();
    const chatId = participants.join('_');

    let retries = 0;
    while (retries < this.MAX_RETRIES) {
      try {
        return await runTransaction(firestore, async (transaction) => {
          const chatRef = doc(firestore, 'chats', chatId);
          const chatDoc = await transaction.get(chatRef);

          if (!chatDoc.exists()) {
            const chatData = {
              participants: participants,
              createdAt: serverTimestamp(),
              lastMessage: '',
              lastMessageTime: serverTimestamp(),
              unreadCount: {
                [currentUser.uid]: 0,
                [participantId]: 0
              },
              isMatchChat: false
            };
            transaction.set(chatRef, chatData);
          }
          return chatId;
        });
      } catch (error: any) {
        retries++;
        if (retries >= this.MAX_RETRIES) throw error;
        await this.delay(Math.pow(2, retries) * 100);
      }
    }
    throw new Error('Max retries exceeded');
  }

  /**
   * Создание чата при Мэтче (вызывается из MatchService)
   */
  async createMatchChat(userId1: string, userId2: string): Promise<string> {
    const participants = [userId1, userId2].sort();
    const chatId = participants.join('_');

    try {
      const chatRef = doc(firestore, 'chats', chatId);
      const chatDoc = await getDoc(chatRef);

      if (!chatDoc.exists()) {
        await setDoc(chatRef, {
          participants: participants,
          createdAt: serverTimestamp(),
          lastMessage: '💕 Вы понравились друг другу!',
          lastMessageTime: serverTimestamp(),
          unreadCount: {
            [userId1]: 1,
            [userId2]: 1
          },
          isMatchChat: true
        });
        
        // Системное сообщение о начале диалога
        await this.sendSystemMessage(chatId, '💕 Вы понравились друг другу!');
      }
      return chatId;
    } catch (error) {
      console.error('❌ Error creating match chat:', error);
      throw error;
    }
  }

  /**
   * Отправка сообщения
   */
  async sendMessage(chatId: string, text: string, receiverId: string): Promise<string> {
    const currentUser = auth.currentUser;
    if (!currentUser) throw new Error('User not authenticated');
    if (!text.trim()) throw new Error('Message cannot be empty');

    // Гарантируем существование чата
    await this.ensureChatExists(chatId);

    let retries = 0;
    while (retries < this.MAX_RETRIES) {
      try {
        return await runTransaction(firestore, async (transaction) => {
          const messagesRef = collection(firestore, 'chats', chatId, 'messages');
          const chatRef = doc(firestore, 'chats', chatId);
          const chatDoc = await transaction.get(chatRef);

          if (!chatDoc.exists()) throw new Error(`Chat ${chatId} not found`);

          const newMessageRef = doc(messagesRef);
          
          transaction.set(newMessageRef, {
            text: text.trim(),
            senderId: currentUser.uid,
            receiverId: receiverId,
            timestamp: serverTimestamp(),
            read: false,
            type: 'text'
          });

          // Обновляем последнее сообщение и счетчик
          const currentUnread = chatDoc.data()?.unreadCount?.[receiverId] || 0;
          transaction.update(chatRef, {
            lastMessage: text.trim(),
            lastMessageTime: serverTimestamp(),
            [`unreadCount.${receiverId}`]: currentUnread + 1
          });

          return newMessageRef.id;
        });
      } catch (error: any) {
        retries++;
        if (retries >= this.MAX_RETRIES) throw error;
        await this.delay(Math.pow(2, retries) * 100);
      }
    }
    throw new Error('Max retries exceeded');
  }

  async sendSystemMessage(chatId: string, text: string): Promise<void> {
    try {
      await this.ensureChatExists(chatId);
      const messagesRef = collection(firestore, 'chats', chatId, 'messages');
      await addDoc(messagesRef, {
        text: text,
        senderId: 'system',
        receiverId: 'all',
        timestamp: serverTimestamp(),
        read: true,
        type: 'system'
      });
    } catch (error) {
      console.error('❌ Error sending system message:', error);
    }
  }

  /**
   * Слушатель сообщений в чате
   */
  subscribeToChatMessages(
    chatId: string, 
    callback: (messages: Message[]) => void,
    errorCallback?: (error: any) => void
  ): () => void {
    const messagesRef = collection(firestore, 'chats', chatId, 'messages');
    const q = query(messagesRef, orderBy('timestamp', 'asc')); // Сортировка: старые сверху

    return onSnapshot(q, 
      (snapshot) => {
        const messages = snapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            text: data.text,
            senderId: data.senderId,
            receiverId: data.receiverId,
            timestamp: data.timestamp?.toDate() || new Date(),
            read: data.read || false,
            type: data.type || 'text'
          } as Message;
        });
        callback(messages);
      },
      (error) => {
        if (errorCallback) errorCallback(error);
      }
    );
  }

  /**
   * Отметить сообщения прочитанными
   */
  async markMessagesAsRead(chatId: string): Promise<void> {
    const currentUser = auth.currentUser;
    if (!currentUser) return;

    try {
      const chatRef = doc(firestore, 'chats', chatId);
      
      // 1. Сбрасываем счетчик в чате
      await updateDoc(chatRef, {
        [`unreadCount.${currentUser.uid}`]: 0
      });

      // 2. Помечаем конкретные сообщения
      const messagesRef = collection(firestore, 'chats', chatId, 'messages');
      const unreadQuery = query(
        messagesRef, 
        where('receiverId', '==', currentUser.uid),
        where('read', '==', false)
      );
      
      const snapshot = await getDocs(unreadQuery);
      if (snapshot.size > 0) {
        const batch = writeBatch(firestore);
        snapshot.docs.forEach(doc => {
          batch.update(doc.ref, { read: true });
        });
        await batch.commit();
      }
    } catch (error) {
      console.error('❌ Error marking read:', error);
    }
  }

  /**
   * Слушатель списка чатов пользователя
   */
  subscribeToUserChats(
    callback: (chats: Chat[]) => void,
    errorCallback?: (error: any) => void
  ): () => void {
    const currentUser = auth.currentUser;
    if (!currentUser) return () => {};

    const chatsRef = collection(firestore, 'chats');
    const q = query(
      chatsRef, 
      where('participants', 'array-contains', currentUser.uid)
    );

    return onSnapshot(q, 
      (snapshot) => {
        const chats = snapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            participants: data.participants || [],
            lastMessage: data.lastMessage,
            lastMessageTime: data.lastMessageTime?.toDate(),
            unreadCount: data.unreadCount || {},
            createdAt: data.createdAt?.toDate() || new Date(),
            isMatchChat: data.isMatchChat || false
          } as Chat;
        });

        // Сортировка: новые чаты (по последнему сообщению) сверху
        chats.sort((a, b) => {
          const timeA = a.lastMessageTime?.getTime() || a.createdAt.getTime();
          const timeB = b.lastMessageTime?.getTime() || b.createdAt.getTime();
          return timeB - timeA;
        });

        callback(chats);
      },
      (error) => {
        if (errorCallback) errorCallback(error);
      }
    );
  }

  async getUserData(userId: string): Promise<DocumentData | null> {
    try {
      const userDoc = await getDoc(doc(firestore, 'users', userId));
      return userDoc.exists() ? userDoc.data() : null;
    } catch (error) {
      console.error('Error fetching user:', error);
      return null;
    }
  }

  // --- Хелперы ---
  private async ensureChatExists(chatId: string): Promise<void> {
    const chatRef = doc(firestore, 'chats', chatId);
    const chatDoc = await getDoc(chatRef);

    if (!chatDoc.exists()) {
      const participants = chatId.split('_');
      if (participants.length === 2) {
        await setDoc(chatRef, {
          participants: participants,
          createdAt: serverTimestamp(),
          lastMessage: '',
          lastMessageTime: serverTimestamp(),
          unreadCount: { [participants[0]]: 0, [participants[1]]: 0 },
          isMatchChat: false
        });
      }
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export const enhancedChatService = new ChatService();