import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ThemedBackground } from './components/ThemedBackground';
import { useNotifications } from './context/NotificationContext';
import { useTheme } from './context/ThemeContext';

export default function NotificationsScreen() {
    const router = useRouter();
    const { theme, themeType } = useTheme();
    const insets = useSafeAreaInsets(); // 🔥 Get safe area insets
    // We need to request these from context. Currently context only returns counts.
    // I will update context in the next step to return the IDs/Objects.
    // For now, I'll assumme the hook returns them or fetch them here locally for MVP.
    // Actually, fetching locally here is safer to avoid Context complexity for now.
    const { unreadMessagesCount, newLikesCount } = useNotifications();

    const [loading, setLoading] = useState(true);
    const [notifications, setNotifications] = useState<any[]>([]);

    // Temporarily fetching data here until context is updated if needed.
    // But since we want to show meaningful info, we need the actual chat objects and user objects.

    useEffect(() => {
        loadNotifications();
    }, [unreadMessagesCount, newLikesCount]);

    const loadNotifications = async () => {
        setLoading(true);
        try {
            const items: any[] = [];

            // 1. Get Unread Chats
            // This is a bit inefficient to re-fetch, but fine for now.
            // We can reuse the subscription from service if we want, but a simple fetch is okay.
            // Actually enhancedChatService.subscribeToUserChats is a stream.
            // Let's just use the fact that we know we have unread messages.
            // ideally we pass the "unread chats" from context.
            // For this step, I will just display a generic "You have X unread messages" if I can't get details easily,
            // BUT user wants to see "Who".

            // Let's rely on the Context update I will do next.
            // effectively: const { unreadChats, incomingLikes } = useNotifications();

            // Placeholder for now
            if (unreadMessagesCount > 0) {
                items.push({ type: 'header', title: 'Сообщения' });
                items.push({ type: 'message_info', count: unreadMessagesCount });
            }

            if (newLikesCount > 0) {
                items.push({ type: 'header', title: 'Симпатии' });
                items.push({ type: 'like_info', count: newLikesCount });
            }

            setNotifications(items);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const isLight = themeType === 'light';

    const renderItem = ({ item }: { item: any }) => {
        if (item.type === 'header') {
            return <Text style={[styles.sectionTitle, { color: theme.text }]}>{item.title}</Text>
        }

        if (item.type === 'message_info') {
            return (
                <TouchableOpacity style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.border }]} onPress={() => router.push('/(tabs)/chats')}>
                    <View style={styles.iconContainer}>
                        <Ionicons name="chatbubble-ellipses" size={24} color="#e1306c" />
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={[styles.cardTitle, { color: theme.text }]}>Непрочитанные сообщения</Text>
                        <Text style={[styles.cardSubtitle, { color: theme.subText }]}>У вас {item.count} новых сообщений</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color={theme.subText} />
                </TouchableOpacity>
            )
        }

        if (item.type === 'like_info') {
            return (
                <TouchableOpacity style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.border }]} onPress={() => router.push('/(tabs)/matches')}>
                    <View style={styles.iconContainer}>
                        <Ionicons name="heart" size={24} color="#e1306c" />
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={[styles.cardTitle, { color: theme.text }]}>Новые симпатии</Text>
                        <Text style={[styles.cardSubtitle, { color: theme.subText }]}>У вас {item.count} новых лайков</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color={theme.subText} />
                </TouchableOpacity>
            )
        }

        return null;
    };

    return (
        <ThemedBackground>
            <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color={theme.text} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: theme.text }]}>Уведомления</Text>
            </View>

            {notifications.length === 0 && !loading ? (
                <View style={styles.emptyContainer}>
                    <Ionicons name="notifications-off-outline" size={64} color={theme.subText} />
                    <Text style={[styles.emptyText, { color: theme.subText }]}>Нет новых уведомлений</Text>
                </View>
            ) : (
                <FlatList
                    data={notifications}
                    renderItem={renderItem}
                    keyExtractor={(item, index) => index.toString()}
                    contentContainerStyle={styles.listContent}
                />
            )}
        </ThemedBackground>
    );
}

const styles = StyleSheet.create({
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingTop: 10,
        paddingBottom: 20,
    },
    backButton: {
        marginRight: 15,
    },
    headerTitle: {
        fontSize: 22,
        fontWeight: 'bold',
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '600',
        marginTop: 20,
        marginBottom: 10,
        marginLeft: 4
    },
    listContent: {
        paddingHorizontal: 20,
    },
    card: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderRadius: 16,
        borderWidth: 1,
        marginBottom: 10,
    },
    iconContainer: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(225, 48, 108, 0.1)',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 15,
    },
    cardTitle: {
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 2,
    },
    cardSubtitle: {
        fontSize: 14,
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 100
    },
    emptyText: {
        marginTop: 10,
        fontSize: 16
    }
});
