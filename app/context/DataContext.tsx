
import React, { createContext, useContext, useEffect, useState } from 'react';
import { eventService, WeaveEvent } from '../services/EventService';
import { yandexAuth } from '../services/yandex/AuthService';
import { yandexChat } from '../services/yandex/ChatService';
import { yandexMatch } from '../services/yandex/MatchService';
import { YandexUserService } from '../services/yandex/UserService';

interface DataContextType {
    userProfile: any | null;
    discoveryProfiles: any[];
    events: WeaveEvent[];
    matches: any[];
    likesYou: any[];
    yourLikes: any[];
    isLoading: boolean;
    refreshData: () => Promise<void>;
}

const DataContext = createContext<DataContextType>({
    userProfile: null,
    discoveryProfiles: [],
    events: [],
    matches: [],
    likesYou: [],
    yourLikes: [],
    isLoading: true,
    refreshData: async () => { },
});

export const useData = () => useContext(DataContext);

const userService = new YandexUserService();

export const DataProvider = ({ children }: { children: React.ReactNode }) => {
    const [userProfile, setUserProfile] = useState<any>(null);
    const [discoveryProfiles, setDiscoveryProfiles] = useState<any[]>([]);
    const [events, setEvents] = useState<WeaveEvent[]>([]);
    const [matches, setMatches] = useState<any[]>([]);
    const [likesYou, setLikesYou] = useState<any[]>([]);
    const [yourLikes, setYourLikes] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const loadAll = async () => {
        setIsLoading(true);
        try {
            const currentUser = yandexAuth.getCurrentUser();
            if (!currentUser) {
                setIsLoading(false);
                return;
            }

            // Parallel fetching
            const [profile, eventsData, matchesData, likesData, sentLikesData] = await Promise.all([
                userService.getCurrentUser(),
                eventService.getEvents(),
                yandexMatch.getMatches(),
                yandexMatch.getLikesYou(),
                yandexMatch.getYourLikes()
            ]);

            if (profile) {
                setUserProfile(profile);

                // Fetch Discovery based on profile
                // Default filters or last used? 
                // search.tsx uses complex filter logic. 
                // For preloading, we can fetch with "smart" defaults or just minimal.
                // search.tsx loads profiles with `loadProfiles(userData, filters, 'custom')`.
                // Let's try to fetch a default batch.

                const defaultGender = profile.gender === 'male' ? 'female' : profile.gender === 'female' ? 'male' : 'all';
                const filters = {
                    gender: defaultGender,
                    minAge: '18',
                    maxAge: '50',
                    ethnicity: '',
                    religion: ''
                };

                // Note: enhancedMatchService.getDiscovery requires params.
                // We might duplicate some logic from search.tsx here or accept that search.tsx will re-fetch if filters differ.
                // But user wants it preloaded.
                // Let's attempt to fetch with basic inverse gender.

                try {
                    const discovery = await userService.getPotentialMatches(profile.id, {
                        gender: defaultGender,
                        minAge: 18,
                        maxAge: 50,
                        ethnicity: '',
                        religion: '',
                        offset: 0
                    });
                    setDiscoveryProfiles(discovery || []);
                } catch (e) {
                    console.error('Failed to preload discovery:', e);
                }
            }

            if (eventsData) {
                // Sort events
                eventsData.sort((a, b) => (a.sortOrder ?? 9999) - (b.sortOrder ?? 9999));
                setEvents(eventsData);
            }

            setMatches(matchesData || []);
            setLikesYou(likesData || []);
            setYourLikes(sentLikesData || []);

        } catch (e) {
            console.error('DataProvider load error:', e);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        // Listen for auth changes to trigger load
        const unsubscribeAuth = yandexAuth.onAuthStateChanged((u) => {
            if (u) {
                loadAll();
                yandexChat.connect().catch(() => { }); // Ensure chat connection
            } else {
                setUserProfile(null);
                setDiscoveryProfiles([]);
                setEvents([]);
                setMatches([]);
                setLikesYou([]);
                setYourLikes([]);
            }
        });

        // Real-time Chat Updates for Matches List
        const unsubscribeMsg = yandexChat.onMessage((msg, type) => {
            if (type === 'newMessage') {
                setMatches(prev => {
                    const index = prev.findIndex(m => m.chatId === msg.chatId);
                    if (index === -1) return prev;

                    const isMine = msg.senderId === yandexAuth.getCurrentUser()?.uid;
                    const updatedMatch = {
                        ...prev[index],
                        lastMessage: msg.text,
                        lastMessageTime: msg.timestamp,
                        isOwnMessage: isMine,
                        isRead: false, // New message is unread by default
                        unreadCount: isMine ? prev[index].unreadCount : (prev[index].unreadCount || 0) + 1,
                        hasUnread: !isMine
                    };

                    const newMatches = [...prev];
                    newMatches.splice(index, 1);
                    newMatches.unshift(updatedMatch);
                    return newMatches;
                });
            }
        });

        const unsubscribeRead = yandexChat.onRead((chatId, readerId) => {
            const myId = yandexAuth.getCurrentUser()?.uid;
            setMatches(prev => {
                return prev.map(m => {
                    if (m.chatId !== chatId) return m;

                    if (readerId === myId) {
                        // I read the chat (e.g. on another device/tab)
                        return { ...m, unreadCount: 0, hasUnread: false };
                    } else {
                        // Partner read the chat
                        if (m.isOwnMessage) {
                            return { ...m, isRead: true };
                        }
                        return m;
                    }
                });
            });
        });

        // Real-time Like/Match Updates - refetch data when notified
        const unsubscribeLike = yandexChat.onLike(async (fromUserId) => {
            console.log('[DataContext] Received new like/match notification from:', fromUserId);
            try {
                // Refetch both lists to ensure instant updates
                const [likesData, matchesData] = await Promise.all([
                    yandexMatch.getLikesYou(),
                    yandexMatch.getMatches()
                ]);
                setLikesYou(likesData || []);
                setMatches(matchesData || []);
                console.log('[DataContext] Refreshed likes and matches after notification');
            } catch (e) {
                console.error('[DataContext] Failed to refresh after like notification:', e);
            }
        });

        return () => {
            unsubscribeAuth();
            unsubscribeMsg();
            unsubscribeRead();
            unsubscribeLike();
        };
    }, []);

    return (
        <DataContext.Provider value={{
            userProfile,
            discoveryProfiles,
            events,
            matches,
            likesYou,
            yourLikes,
            isLoading,
            refreshData: loadAll
        }}>
            {children}
        </DataContext.Provider>
    );
};
