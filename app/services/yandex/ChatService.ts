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
    matchId?: string;
    name?: string;
    age?: number;
    ethnicity?: string;
    macroGroups?: string[];
    photo?: string;
    isOwnMessage?: boolean;
}

class YandexChatService {
    private socket: WebSocket | null = null;
    private messageListeners: ((message: Message, eventType?: 'newMessage' | 'messageEdited') => void)[] = [];
    private likeListeners: ((fromUserId: string) => void)[] = [];

    private manuallyClosed = false;
    private reconnectTimer: NodeJS.Timeout | null = null;
    private keepAliveTimer: NodeJS.Timeout | null = null;

    // Polling for new messages
    private pollingInterval: NodeJS.Timeout | null = null;
    private lastMessageTimestamps: Map<string, number> = new Map();
    private currentChatId: string | null = null;

    async connect(): Promise<void> {
        if (this.socket && (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)) return;

        this.manuallyClosed = false;
        const token = await AsyncStorage.getItem('auth_token');
        if (!token) throw new Error('Not authenticated');

        console.log('[ChatService] Connecting to WebSocket...', WS_URL);

        return new Promise((resolve, reject) => {
            try {
                this.socket = new WebSocket(`${WS_URL}?token=${token}`);

                this.socket.onopen = () => {
                    console.log('[ChatService] WebSocket Connected');
                    this.startKeepAlive();
                    resolve();
                };

                this.socket.onmessage = (event) => {
                    console.log('[ChatService] Message received:', event.data);
                    try {
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
                        } else if (data.type === 'newLike' || data.type === 'newMatch') {
                            this.likeListeners.forEach(listener => listener(data.fromUserId));
                        }
                    } catch (e) {
                        console.error('[ChatService] Failed to parse message:', e);
                    }
                };

                this.socket.onerror = (e) => {
                    console.error('[ChatService] WebSocket Error:', e);
                };

                this.socket.onclose = (event) => {
                    console.log(`[ChatService] WebSocket Closed, code=${event.code}`);
                    this.stopKeepAlive();
                    this.socket = null;
                    if (!this.manuallyClosed) {
                        this.scheduleReconnect();
                    }
                };
            } catch (err) {
                console.error('[ChatService] Connection error:', err);
                this.scheduleReconnect();
                reject(err);
            }
        });
    }

    private scheduleReconnect() {
        if (this.reconnectTimer) return;
        console.log('[ChatService] Scheduling reconnect in 3s...');
        this.reconnectTimer = setTimeout(() => {
            this.reconnectTimer = null;
            this.connect().catch(() => { });
        }, 3000);
    }

    private startKeepAlive() {
        this.stopKeepAlive();
        this.keepAliveTimer = setInterval(() => {
            if (this.socket?.readyState === WebSocket.OPEN) {
                this.socket.send(JSON.stringify({ action: 'ping' }));
            }
        }, 30000); // Send ping every 30s to keep connection alive
    }

    private stopKeepAlive() {
        if (this.keepAliveTimer) {
            clearInterval(this.keepAliveTimer);
            this.keepAliveTimer = null;
        }
    }

    disconnect() {
        this.stopKeepAlive();
        this.stopPolling();
        if (this.socket) {
            this.socket.close();
            this.socket = null;
        }
    }

    startPolling(chatId: string) {
        this.stopPolling();
        this.currentChatId = chatId;

        this.pollingInterval = setInterval(async () => {
            if (!this.currentChatId) return;

            const lastTimestamp = this.lastMessageTimestamps.get(this.currentChatId) || Date.now();

            try {
                const token = await AsyncStorage.getItem('authToken');
                if (!token) return;

                const response = await fetch(
                    `${API_URL}/messages/new?chatId=${this.currentChatId}&after=${lastTimestamp}`,
                    { headers: { 'Authorization': `Bearer ${token}` } }
                );

                if (response.ok) {
                    const data = await response.json();
                    if (data.messages && data.messages.length > 0) {
                        const latestMessage = data.messages[data.messages.length - 1];
                        this.lastMessageTimestamps.set(this.currentChatId, new Date(latestMessage.timestamp).getTime());

                        data.messages.forEach((msg: any) => {
                            const message: Message = {
                                id: msg.id,
                                chatId: this.currentChatId!,
                                senderId: msg.senderId,
                                text: msg.text,
                                timestamp: new Date(msg.timestamp),
                                type: msg.type || 'text',
                                replyToId: msg.replyToId,
                                isEdited: msg.isEdited,
                                editedAt: msg.editedAt ? new Date(msg.editedAt) : undefined
                            };
                            this.messageListeners.forEach(listener => listener(message, 'newMessage'));
                        });
                    }
                }
            } catch (error) {
                console.error('[Polling] Error:', error);
            }
        }, 2500);
    }

    stopPolling() {
        if (this.pollingInterval) {
            clearInterval(this.pollingInterval);
            this.pollingInterval = null;
        }
        this.currentChatId = null;
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
            lastMessage: c.lastMessage,
            lastMessageTime: c.lastMessageTime ? new Date(c.lastMessageTime) : undefined,
            isMatchChat: true, // All chats from /chats are match chats
            matchId: c.matchId,
            name: c.name,
            age: c.age,
            ethnicity: c.ethnicity,
            macroGroups: c.macroGroups,
            photo: c.photo,
            isOwnMessage: c.isOwnMessage
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
