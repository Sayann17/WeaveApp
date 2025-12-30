// app/users/[id].tsx
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    SafeAreaView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { ProfileView } from '../components/ProfileView';
import { ThemedBackground } from '../components/ThemedBackground';
import { useTheme } from '../context/ThemeContext';
import { YandexUserService } from '../services/yandex/UserService';

const userService = new YandexUserService();

export default function UserProfileScreen() {
    const { id } = useLocalSearchParams();
    const router = useRouter();
    const { theme } = useTheme();

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

    if (loading) {
        return (
            <ThemedBackground>
                <View style={styles.center}>
                    <ActivityIndicator size="large" color={theme.text} />
                </View>
            </ThemedBackground>
        );
    }

    if (error || !userData) {
        return (
            <ThemedBackground>
                <SafeAreaView style={{ flex: 1 }}>
                    <View style={styles.header}>
                        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                            <Ionicons name="chevron-back" size={28} color={theme.text} />
                        </TouchableOpacity>
                    </View>
                    <View style={styles.center}>
                        <Text style={{ color: theme.text }}>{error || 'User not found'}</Text>
                    </View>
                </SafeAreaView>
            </ThemedBackground>
        );
    }

    return (
        <ThemedBackground>
            <SafeAreaView style={{ flex: 1 }}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                        <Ionicons name="chevron-back" size={28} color={theme.text} />
                    </TouchableOpacity>
                </View>
                <ProfileView userData={userData} isOwnProfile={false} />
            </SafeAreaView>
        </ThemedBackground>
    );
}

const styles = StyleSheet.create({
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    header: {
        paddingHorizontal: 10,
        paddingTop: 10,
        paddingBottom: 5,
        zIndex: 10,
        flexDirection: 'row',
        justifyContent: 'flex-start',
    },
    backButton: {
        padding: 5,
        justifyContent: 'center',
        alignItems: 'center',
    },
});
