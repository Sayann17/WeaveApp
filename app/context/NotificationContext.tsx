// app/context/NotificationContext.tsx
import React, { createContext, useContext, useEffect, useState } from 'react';
import { NotificationToast, NotificationType } from '../components/NotificationToast';
import { User } from '../services/interfaces/IAuthService';
import { yandexAuth } from '../services/yandex/AuthService';
import { yandexChat } from '../services/yandex/ChatService';

interface NotificationContextType {
    unreadMessagesCount: number;
    newLikesCount: number;
    unreadChatIds: string[];
    incomingLikesUserIds: string[];
    resetUnreadMessages: () => void;
    resetNewLikes: () => void;
}

const NotificationContext = createContext<NotificationContextType>({
    unreadMessagesCount: 0,
    newLikesCount: 0,
    unreadChatIds: [],
    incomingLikesUserIds: [],
    resetUnreadMessages: () => { },
    resetNewLikes: () => { },
});

export const useNotifications = () => useContext(NotificationContext);

export const NotificationProvider = ({ children }: { children: React.ReactNode }) => {
    const [unreadMessagesCount, setUnreadMessagesCount] = useState(0);
    const [newLikesCount, setNewLikesCount] = useState(0);
    const [incomingLikesUserIds, setIncomingLikesUserIds] = useState<string[]>([]);
    const [unreadChatIds, setUnreadChatIds] = useState<string[]>([]);
    const [user, setUser] = useState<User | null>(null);

    // Toast State
    const [toastVisible, setToastVisible] = useState(false);
    const [toastMessage, setToastMessage] = useState('');
    const [toastType, setToastType] = useState<NotificationType>('message');

    // Listen to Yandex Auth state changes
    useEffect(() => {
        const unsubscribe = yandexAuth.onAuthStateChanged((u) => {
            setUser(u);
        });
        return unsubscribe;
    }, []);

    const fetchStats = async () => {
        if (!user) return;
        try {
            const stats = await yandexChat.getNotificationsStats();
            setUnreadMessagesCount(stats.unreadMessages);
            setNewLikesCount(stats.newLikes);
        } catch (e) { console.error(e); }
    };

    useEffect(() => {
        if (!user) {
            setUnreadMessagesCount(0);
            setNewLikesCount(0);
            return;
        }

        // Initial Fetch
        fetchStats();

        yandexChat.connect().catch(console.error);

        const unsubscribeMessages = yandexChat.onMessage((msg, type) => {
            if (type === 'newMessage' && msg.senderId !== user.uid) {
                setUnreadMessagesCount(prev => prev + 1);
                showToast(msg.text, 'message');
            }
        });

        const unsubscribeLikes = yandexChat.onLike((fromUserId) => {
            setNewLikesCount(prev => prev + 1);
            showToast('Кому-то понравилась ваша анкета!', 'like');
        });

        return () => {
            unsubscribeMessages();
            unsubscribeLikes();
        };
    }, [user]);

    const showToast = (msg: string, type: NotificationType) => {
        setToastMessage(msg);
        setToastType(type);
        setToastVisible(true);
    };

    const resetUnreadMessages = () => setUnreadMessagesCount(0);
    const resetNewLikes = () => setNewLikesCount(0);

    return (
        <NotificationContext.Provider value={{
            unreadMessagesCount,
            newLikesCount,
            unreadChatIds,
            incomingLikesUserIds,
            resetUnreadMessages,
            resetNewLikes
        }}>
            {children}
            <NotificationToast
                visible={toastVisible}
                message={toastMessage}
                type={toastType}
                onClose={() => setToastVisible(false)}
            />
        </NotificationContext.Provider>
    );
};
