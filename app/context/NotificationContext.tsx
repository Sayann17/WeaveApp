// app/context/NotificationContext.tsx
import React, { createContext, useContext, useEffect, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { User } from '../services/interfaces/IAuthService';
import { yandexAuth } from '../services/yandex/AuthService';
import { yandexChat } from '../services/yandex/ChatService';
import { yandexMatch } from '../services/yandex/MatchService';

interface NotificationContextType {
    unreadMessagesCount: number;
    newLikesCount: number;
    unreadChatIds: string[];
    incomingLikesUserIds: string[];
    resetUnreadMessages: () => void;
    resetNewLikes: () => void;
    refreshNotifications: () => void;
}

const NotificationContext = createContext<NotificationContextType>({
    unreadMessagesCount: 0,
    newLikesCount: 0,
    unreadChatIds: [],
    incomingLikesUserIds: [],
    resetUnreadMessages: () => { },
    resetNewLikes: () => { },
    refreshNotifications: () => { },
});

export const useNotifications = () => useContext(NotificationContext);

export const NotificationProvider = ({ children }: { children: React.ReactNode }) => {
    const [unreadMessagesCount, setUnreadMessagesCount] = useState(0);
    const [newLikesCount, setNewLikesCount] = useState(0);
    const [incomingLikesUserIds, setIncomingLikesUserIds] = useState<string[]>([]);
    const [unreadChatIds, setUnreadChatIds] = useState<string[]>([]);
    const [user, setUser] = useState<User | null>(null);

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
            const [unreadMsg, newLikes] = await Promise.all([
                yandexChat.getUnreadMessagesCount(),
                yandexMatch.getNewLikesCount()
            ]);
            setUnreadMessagesCount(unreadMsg);
            setNewLikesCount(newLikes);
        } catch (e) {
            console.error('[NotificationContext] Failed to fetch stats:', e);
        }
    };

    // Refresh notifications when app comes to foreground
    useEffect(() => {
        const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
            if (nextAppState === 'active') {
                console.log('[NotificationContext] App became active, refreshing notifications');
                fetchStats();
            }
        });

        return () => {
            subscription.remove();
        };
    }, [user]);

    useEffect(() => {
        if (!user) {
            setUnreadMessagesCount(0);
            setNewLikesCount(0);
            return;
        }

        // Initial Fetch
        fetchStats();

        yandexChat.connect().catch(console.error);

        // Listen to WebSocket events for real-time badge updates
        const unsubscribeMessages = yandexChat.onMessage((msg, type) => {
            if (type === 'newMessage' && msg.senderId !== user.uid) {
                // Only increment badge, no toast
                setUnreadMessagesCount(prev => prev + 1);
                console.log('[NotificationContext] New message received, badge updated');
            }
        });

        const unsubscribeLikes = yandexChat.onLike((fromUserId) => {
            // Only increment badge, no toast
            setNewLikesCount(prev => prev + 1);
            console.log('[NotificationContext] New like received, badge updated');
        });

        return () => {
            unsubscribeMessages();
            unsubscribeLikes();
        };
    }, [user]);

    const resetUnreadMessages = () => setUnreadMessagesCount(0);
    const resetNewLikes = () => setNewLikesCount(0);

    return (
        <NotificationContext.Provider value={{
            unreadMessagesCount,
            newLikesCount,
            unreadChatIds,
            incomingLikesUserIds,
            resetUnreadMessages,
            resetNewLikes,
            refreshNotifications: fetchStats
        }}>
            {children}
        </NotificationContext.Provider>
    );
};
