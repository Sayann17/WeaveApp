import AsyncStorage from '@react-native-async-storage/async-storage';

export interface WeaveEvent {
    id: string;
    title: string;
    description: string;
    date: string; // ISO string from backend
    imageKey: string;
    isGoing: boolean;
}

const API_URL = 'https://d5dg37j92h7tg2f7sf87.o2p3jdjj.apigw.yandexcloud.net';

class EventService {

    async getEvents(): Promise<WeaveEvent[]> {
        const token = await AsyncStorage.getItem('auth_token');
        if (!token) return [];

        try {
            const response = await fetch(`${API_URL}/events`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                return data.events || [];
            }
            return [];
        } catch (e) {
            console.error('[EventService] Failed to load events', e);
            return [];
        }
    }

    async attendEvent(eventId: string): Promise<boolean> {
        const token = await AsyncStorage.getItem('auth_token');
        if (!token) return false;

        try {
            const response = await fetch(`${API_URL}/events/attend`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ eventId })
            });

            return response.ok;
        } catch (e) {
            console.error('[EventService] Failed to attend event', e);
            return false;
        }
    }
}

export const eventService = new EventService();
