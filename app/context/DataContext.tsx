
import React, { createContext, useContext, useEffect, useState } from 'react';
import { eventService, WeaveEvent } from '../services/EventService';
import { yandexAuth } from '../services/yandex/AuthService';
import { YandexUserService } from '../services/yandex/UserService';

interface DataContextType {
    userProfile: any | null;
    discoveryProfiles: any[];
    events: WeaveEvent[];
    isLoading: boolean;
    refreshData: () => Promise<void>;
}

const DataContext = createContext<DataContextType>({
    userProfile: null,
    discoveryProfiles: [],
    events: [],
    isLoading: true,
    refreshData: async () => { },
});

export const useData = () => useContext(DataContext);

const userService = new YandexUserService();

export const DataProvider = ({ children }: { children: React.ReactNode }) => {
    const [userProfile, setUserProfile] = useState<any>(null);
    const [discoveryProfiles, setDiscoveryProfiles] = useState<any[]>([]);
    const [events, setEvents] = useState<WeaveEvent[]>([]);
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
            const [profile, eventsData] = await Promise.all([
                userService.getCurrentUser(), // or yandexAuth.getCurrentUser() but userService might have more details
                eventService.getEvents()
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

        } catch (e) {
            console.error('DataProvider load error:', e);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        // Listen for auth changes to trigger load
        const unsubscribe = yandexAuth.onAuthStateChanged((u) => {
            if (u) {
                loadAll();
            } else {
                setUserProfile(null);
                setDiscoveryProfiles([]);
                setEvents([]);
            }
        });
        return unsubscribe;
    }, []);

    return (
        <DataContext.Provider value={{
            userProfile,
            discoveryProfiles,
            events,
            isLoading,
            refreshData: loadAll
        }}>
            {children}
        </DataContext.Provider>
    );
};
