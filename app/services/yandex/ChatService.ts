import AsyncStorage from '@react-native-async-storage/async-storage';

const API_URL = 'https://d5dg37j92h7tg2f7sf87.o2p3jdjj.apigw.yandexcloud.net';
const WS_URL = 'wss://d5dg37j92h7tg2f7sf87.o2p3jdjj.apigw.yandexcloud.net/ws'; // Definitive path for explicit path-level extensions

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
// ... existing Chat interface ...

class YandexChatService {
    // ... existing properties ...
    private messageListeners: ((message: Message, eventType?: 'newMessage' | 'messageEdited') => void)[] = [];

    async connect(): Promise<void> {
        // ... existing connect logic ...
        // ... in socket.onmessage ...
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
                    timestamp: new Date(data.message.timestamp || Date.now()), // Fallback if not sent
                    editedAt: new Date(data.message.editedAt)
                };
                this.messageListeners.forEach(listener => listener(message, 'messageEdited'));
            }
        };
        // ... existing error logging ...
    }

    // ... disconnect ...

    onMessage(callback: (message: Message, eventType?: 'newMessage' | 'messageEdited') => void) {
        this.messageListeners.push(callback);
        return () => {
            this.messageListeners = this.messageListeners.filter(l => l !== callback);
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
        // ... existing getChats ...
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
            chatId: m.chat_id || m.chatId, // Handle both cases just in case
            text: m.text,
            senderId: m.sender_id || m.senderId,
            timestamp: new Date(m.timestamp),
            type: m.type as 'text' | 'system' | 'image',
            replyToId: m.replyToId,
            isEdited: m.isEdited,
            editedAt: m.editedAt ? new Date(m.editedAt) : undefined
        }));
    }
}
}

export const yandexChat = new YandexChatService();
