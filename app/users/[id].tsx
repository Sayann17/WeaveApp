// app/users/[id].tsx
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    StyleSheet,
    Text,
    View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ProfileView } from '../components/ProfileView';
import { ThemedBackground } from '../components/ThemedBackground';
import { useTelegram } from '../context/TelegramProvider';
import { useTheme } from '../context/ThemeContext';
import { YandexUserService } from '../services/yandex/UserService';
import { getPlatformPadding } from '../utils/platformPadding';

const userService = new YandexUserService();

export default function UserProfileScreen() {
    const { id } = useLocalSearchParams();
    const router = useRouter();
    const { theme } = useTheme();
    const insets = useSafeAreaInsets();
    const { setBackButtonHandler, showBackButton, hideBackButton, isMobile } = useTelegram();

    const [userData, setUserData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        const loadUser = async () => {
            if (!id || typeof id !== 'string') {
                setError('Invalid user ID');
                setLoading(false);
                return;
            }

            try {
                const user = await userService.getUser(id);
                if (user) {
                    setUserData(user);
                } else {
                    setError('User not found');
                }
            } catch (err) {
                console.error(err);
                setError('Failed to load user profile');
            } finally {
                setLoading(false);
            }
        };

        loadUser();
    }, [id]);

    // Telegram BackButton handler
    useEffect(() => {
        showBackButton();
        setBackButtonHandler(() => {
            router.back();
        });

        return () => {
            hideBackButton();
            setBackButtonHandler(null);
        };
    }, []);

    if (loading) {
        return (
            <ThemedBackground>
                <View style={[styles.center, { paddingTop: getPlatformPadding(insets, isMobile) }]}>
                    <ActivityIndicator size="large" color={theme.text} />
                </View>
            </ThemedBackground>
        );
    }

    if (error || !userData) {
        return (
            <ThemedBackground>
                <View style={[styles.center, { paddingTop: getPlatformPadding(insets, isMobile) }]}>
                    <Text style={{ color: theme.text }}>{error || 'User not found'}</Text>
                </View>
            </ThemedBackground>
        );
    }

    return (
        <ThemedBackground>
            <View style={{ flex: 1, paddingTop: getPlatformPadding(insets, isMobile) }}>
                <ProfileView userData={userData} isOwnProfile={false} />
            </View>
        </ThemedBackground>
    );
}

const styles = StyleSheet.create({
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
});
