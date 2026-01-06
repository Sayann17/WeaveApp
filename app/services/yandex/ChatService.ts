import AsyncStorage from '@react-native-async-storage/async-storage';

const API_URL = 'https://d5dg37j92h7tg2f7sf87.o2p3jdjj.apigw.yandexcloud.net';
const WS_URL = 'wss://d5dg37j92h7tg2f7sf87.o2p3jdjj.apigw.yandexcloud.net/ws';

export interface Message {
    id: string;
    chatId: string;
    text: string;
    senderId: string;
    timestamp: Date;
    type: 'text' | 'system' | 'image';
    replyToId?: string | null;
    isEdited?: boolean;
    editedAt?: Date;
}

export interface Chat {
    id: string;
    participants: string[];
    lastMessage?: string;
    lastMessageTime?: Date;
    isMatchChat?: boolean;
}

class YandexChatService {
    private socket: WebSocket | null = null;
    private messageListeners: ((message: Message, eventType?: 'newMessage' | 'messageEdited') => void)[] = [];
    private likeListeners: ((fromUserId: string) => void)[] = [];

    async connect(): Promise<void> {
        if (this.socket && this.socket.readyState === WebSocket.OPEN) return;
        if (this.socket && this.socket.readyState === WebSocket.CONNECTING) {
            return new Promise((resolve, reject) => {
                const interval = setInterval(() => {
                    if (this.socket?.readyState === WebSocket.OPEN) {
                        clearInterval(interval);
                        resolve();
                    } else if (this.socket?.readyState === WebSocket.CLOSED) {
                        clearInterval(interval);
                        reject(new Error('WebSocket closed during connection'));
                    }
                }, 100);
            });
        }

        const token = await AsyncStorage.getItem('auth_token');
        if (!token) throw new Error('Not authenticated');

        console.log('[ChatService] Connecting to WebSocket...');

        return new Promise((resolve, reject) => {
            try {
                this.socket = new WebSocket(`${WS_URL}?token=${token}`);

                this.socket.onopen = () => {
                    console.log('[ChatService] WebSocket Connected');
                    resolve();
                };

                this.socket.onmessage = (event) => {
                    console.log('[ChatService] Message received:', event.data);
                    const data = JSON.parse(event.data);

                    if (data.type === 'newMessage') {
                        const message: Message = {
                            ...data.message,
                            timestamp: new Date(data.message.timestamp),
                            editedAt: data.message.editedAt ? new Date(data.message.editedAt) : undefined
                        };
                        this.messageListeners.forEach(listener => listener(message, 'newMessage'));
                    } else if (data.type === 'messageEdited') {
                        const message: Message = {
                            ...data.message,
                            timestamp: new Date(data.message.timestamp || Date.now()),
                            editedAt: new Date(data.message.editedAt)
                        };
                        this.messageListeners.forEach(listener => listener(message, 'messageEdited'));
                    } else if (data.type === 'newLike') {
                        this.likeListeners.forEach(listener => listener(data.fromUserId));
                    } else if (data.type === 'newMatch') {
                        // Treat matches as likes for badge purposes
                        this.likeListeners.forEach(listener => listener(data.fromUserId));
                    }
                };

                this.socket.onerror = (e) => {
                    console.error('[ChatService] WebSocket Error details:', e);
                    if (this.socket?.readyState !== WebSocket.OPEN) {
                        reject(new Error('WebSocket connection failed during handshake'));
                    }
                };

                this.socket.onclose = (event) => {
                    console.log(`[ChatService] WebSocket Closed: Code=${event.code}, Reason=${event.reason}`);
                    this.socket = null;
                };
            } catch (err) {
                console.error('[ChatService] Error creating WebSocket:', err);
                reject(err);
            }
        });
    }

    disconnect() {
        if (this.socket) {
            this.socket.close();
            this.socket = null;
        }
    }

    onMessage(callback: (message: Message, eventType?: 'newMessage' | 'messageEdited') => void) {
        this.messageListeners.push(callback);
        return () => {
            this.messageListeners = this.messageListeners.filter(l => l !== callback);
        };
    }

    onLike(callback: (fromUserId: string) => void) {
        this.likeListeners.push(callback);
        return () => {
            this.likeListeners = this.likeListeners.filter(l => l !== callback);
        };
    }

    async sendMessage(chatId: string, text: string, recipientId: string, replyToId?: string) {
        if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
            await this.connect();
        }

        const payload = {
            action: 'sendMessage',
            chatId,
            text,
            recipientId,
            replyToId
        };

        this.socket?.send(JSON.stringify(payload));
    }

    async editMessage(chatId: string, messageId: string, text: string, recipientId: string) {
        if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
            await this.connect();
        }

        const payload = {
            action: 'editMessage',
            chatId,
            messageId,
            text,
            recipientId
        };

        this.socket?.send(JSON.stringify(payload));
    }

    async getChats(): Promise<Chat[]> {
        const token = await AsyncStorage.getItem('auth_token');
        if (!token) throw new Error('No auth token found in storage');

        const response = await fetch(`${API_URL}/chats`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) {
            const errorBody = await response.text();
            console.error(`[ChatService] getChats failed: ${response.status} ${response.statusText}`, errorBody);
            throw new Error(`Failed to fetch chats: ${response.status} ${errorBody}`);
        }
        const data = await response.json();
        return data.chats.map((c: any) => ({
            id: c.id,
            participants: c.id.split('_'),
            lastMessage: c.last_message,
            lastMessageTime: c.last_message_time ? new Date(c.last_message_time) : undefined,
            isMatchChat: !!c.is_match_chat
        }));
    }

    async getHistory(chatId: string): Promise<Message[]> {
        const token = await AsyncStorage.getItem('auth_token');
        if (!token) throw new Error('No auth token found in storage');

        const response = await fetch(`${API_URL}/history?chatId=${chatId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) {
            const errorBody = await response.text();
            console.error(`[ChatService] getHistory failed: ${response.status} ${response.statusText}`, errorBody);
            throw new Error(`Failed to fetch history: ${response.status} ${errorBody}`);
        }
        const data = await response.json();
        return data.messages.map((m: any) => ({
            id: m.id,
            chatId: m.chat_id || m.chatId,
            text: m.text,
            senderId: m.sender_id || m.senderId,
            timestamp: new Date(m.timestamp),
            type: m.type as 'text' | 'system' | 'image',
            replyToId: m.replyToId,
            isEdited: m.isEdited,
            editedAt: m.editedAt ? new Date(m.editedAt) : undefined
        }));
    }

    async getNotificationsStats(): Promise<{ unreadMessages: number, newLikes: number }> {
        const token = await AsyncStorage.getItem('auth_token');
        if (!token) return { unreadMessages: 0, newLikes: 0 };

        try {
            const response = await fetch(`${API_URL}/notifications/stats`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!response.ok) return { unreadMessages: 0, newLikes: 0 };
            return await response.json();
        } catch (e) {
            console.error('Failed to fetch notification stats', e);
            return { unreadMessages: 0, newLikes: 0 };
        }
    }

    async markAsRead(chatId: string): Promise<void> {
        const token = await AsyncStorage.getItem('auth_token');
        if (!token) return;

        try {
            await fetch(`${API_URL}/mark-read`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ chatId })
            });
        } catch (e) {
            console.error('Failed to mark as read', e);
        }
    }
}

export const yandexChat = new YandexChatService();
