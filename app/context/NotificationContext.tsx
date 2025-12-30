// app/context/NotificationContext.tsx
import React, { createContext, useContext, useEffect, useState } from 'react';
import { User } from '../services/interfaces/IAuthService';
import { yandexAuth } from '../services/yandex/AuthService';

interface NotificationContextType {
    unreadMessagesCount: number;
    newLikesCount: number;
    unreadChatIds: string[];
    incomingLikesUserIds: string[];
}

const NotificationContext = createContext<NotificationContextType>({
    unreadMessagesCount: 0,
    newLikesCount: 0,
    unreadChatIds: [],
    incomingLikesUserIds: []
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

    // TODO: Migrate chat and likes notifications to Yandex Cloud
    // For now, notifications are disabled until Firestore is fully migrated
    useEffect(() => {
        if (!user) {
            setUnreadMessagesCount(0);
            setNewLikesCount(0);
            setUnreadChatIds([]);
            setIncomingLikesUserIds([]);
            return;
        }

        // Placeholder for future Yandex Cloud implementation
        // Will implement real-time notifications once backend supports it
    }, [user]);

    return (
        <NotificationContext.Provider value={{
            unreadMessagesCount,
            newLikesCount,
            unreadChatIds,
            incomingLikesUserIds
        }}>
            {children}
        </NotificationContext.Provider>
    );
};
