import AsyncStorage from '@react-native-async-storage/async-storage';

const API_URL = 'https://d5dg37j92h7tg2f7sf87.o2p3jdjj.apigw.yandexcloud.net';
const WS_URL = 'wss://d5dg37j92h7tg2f7sf87.o2p3jdjj.apigw.yandexcloud.net/ws';

// Base64 decode function for React Native
function base64Decode(str: string): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
    let output = '';

    str = str.replace(/=+$/, '');

    for (let i = 0; i < str.length;) {
        const enc1 = chars.indexOf(str.charAt(i++));
        const enc2 = chars.indexOf(str.charAt(i++));
        const enc3 = chars.indexOf(str.charAt(i++));
        const enc4 = chars.indexOf(str.charAt(i++));

        const chr1 = (enc1 << 2) | (enc2 >> 4);
        const chr2 = ((enc2 & 15) << 4) | (enc3 >> 2);
        const chr3 = ((enc3 & 3) << 6) | enc4;

        output += String.fromCharCode(chr1);

        if (enc3 !== 64) {
            output += String.fromCharCode(chr2);
        }
        if (enc4 !== 64) {
            output += String.fromCharCode(chr3);
        }
    }

    return decodeURIComponent(escape(output));
}

export interface Message {
    id: string;
    chatId: string;
    text: string;
    senderId: string;
    timestamp: Date;
    type: 'text' | 'system' | 'image';
    replyToId?: string | null;
    isRead?: boolean;
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

                this.socket.onmessage = async (event) => {
                    console.log('[ChatService] Message received (raw):', typeof event.data, event.data);
                    try {
                        let data;

                        let messageText: string;

                        // Handle different data types
                        if (typeof event.data === 'string') {
                            messageText = event.data;
                        } else if (event.data instanceof Blob) {
                            // Handle Blob (React Native WebSocket returns Blob)
                            console.log('[ChatService] Received Blob, reading as text...');
                            messageText = await event.data.text();
                            console.log('[ChatService] Blob text:', messageText);
                        } else {
                            console.error('[ChatService] Unexpected data type:', typeof event.data);
                            return;
                        }

                        // Try to parse as JSON first (in case it's already a JSON string)
                        try {
                            data = JSON.parse(messageText);
                            console.log('[ChatService] Message parsed as JSON directly');
                        } catch {
                            // If JSON parse fails, try base64 decode
                            try {
                                const decodedData = base64Decode(messageText);
                                console.log('[ChatService] Message decoded from base64:', decodedData);
                                data = JSON.parse(decodedData);
                            } catch (e2) {
                                console.error('[ChatService] Failed to decode base64:', e2);
                                return;
                            }
                        }

                        console.log('[ChatService] Parsed data:', data);

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
            isRead: m.is_read || m.isRead || false,
            isEdited: m.isEdited,
            editedAt: m.editedAt ? new Date(m.editedAt) : undefined
        }));
    }

    async getUnreadMessagesCount(): Promise<number> {
        const token = await AsyncStorage.getItem('auth_token');
        if (!token) return 0;
        try {
            const response = await fetch(`${API_URL}/notifications/messages`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!response.ok) return 0;
            const data = await response.json();
            return data.unreadMessages || 0;
        } catch (e) {
            console.error('Failed to fetch unread messages count', e);
            return 0;
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
