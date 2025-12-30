// Utility to clear all auth data - run this once to reset
import AsyncStorage from '@react-native-async-storage/async-storage';

export async function clearAllAuthData() {
    try {
        await AsyncStorage.removeItem('auth_token');
        await AsyncStorage.removeItem('app_theme');
        console.log('✅ All auth data cleared');
        return true;
    } catch (e) {
        console.error('❌ Failed to clear auth data:', e);
        return false;
    }
}
