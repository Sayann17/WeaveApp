import AsyncStorage from '@react-native-async-storage/async-storage';

const ZEN_KEY = 'zen_last_seen_date';

export const ZenService = {
    /**
     * Checks if the user should see the Zen screen (Day Pause).
     * Returns true if it has been more than 24 hours since the last view, or if never viewed.
     */
    shouldShowZen: async (): Promise<boolean> => {
        try {
            const lastSeen = await AsyncStorage.getItem(ZEN_KEY);
            if (!lastSeen) return true;

            const lastDate = new Date(parseInt(lastSeen, 10));
            const now = new Date();

            // Calculate difference in milliseconds
            const diff = now.getTime() - lastDate.getTime();
            const hours = diff / (1000 * 60 * 60);

            return hours >= 24;
        } catch (error) {
            console.error('Error checking Zen status:', error);
            // In case of error, show it to be safe (or hide it to avoid annoying people)
            // Let's safe default to false to not block users if storage fails, 
            // but for a feature like this true is probably better for discovery.
            return true;
        }
    },

    /**
     * Marks the Zen screen as seen for now.
     */
    markZenSeen: async (): Promise<void> => {
        try {
            const now = Date.now().toString();
            await AsyncStorage.setItem(ZEN_KEY, now);
        } catch (error) {
            console.error('Error marking Zen seen:', error);
        }
    },

    /**
     * Debug helper to reset the timer
     */
    resetZen: async (): Promise<void> => {
        await AsyncStorage.removeItem(ZEN_KEY);
    }
};
