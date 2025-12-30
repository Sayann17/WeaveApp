import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
    ActivityIndicator,
    Pressable,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ThemedBackground } from '../components/ThemedBackground';
import { useTheme } from '../context/ThemeContext';
import { yandexAuth } from '../services/yandex/AuthService';
import { yandexMatch } from '../services/yandex/MatchService';

export default function MatchesScreen() {
    const router = useRouter();
    const { theme, themeType } = useTheme();
    const [matches, setMatches] = useState<any[]>([]);
    const [likesYou, setLikesYou] = useState<any[]>([]);
    const [activeTab, setActiveTab] = useState<'matches' | 'likes'>('matches');
    const [loading, setLoading] = useState(true);
    const insets = useSafeAreaInsets();

    const isLight = themeType === 'light';

    useFocusEffect(
        useCallback(() => {
            loadMatches();
        }, [])
    );

    const loadMatches = async () => {
        try {
            const user = yandexAuth.getCurrentUser();
            if (!user) {
                setLoading(false);
                return;
            }
            const [matchesData, likesData] = await Promise.all([
                yandexMatch.getMatches(),
                yandexMatch.getLikesYou()
            ]);
            setMatches(matchesData || []);
            setLikesYou(likesData || []);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <View style={{ flex: 1, backgroundColor: theme.background, justifyContent: 'center', alignItems: 'center' }}>
                <ActivityIndicator color={theme.text} />
            </View>
        );
    }

    return (
        <ThemedBackground>
            <StatusBar barStyle={isLight ? "dark-content" : "light-content"} />
            <View style={{ flex: 1, paddingTop: insets.top }}>
                <View style={styles.header}>
                    <Text style={[styles.title, { color: theme.text }]}>Ваши пары</Text>
                </View>

                {/* Таб-бар */}
                <View style={styles.tabContainer}>
                    <Pressable
                        style={[styles.tab, activeTab === 'matches' && { borderBottomColor: theme.text, borderBottomWidth: 2 }]}
                        onPress={() => setActiveTab('matches')}
                    >
                        <Text style={[styles.tabText, { color: activeTab === 'matches' ? theme.text : theme.subText }]}>Мэтчи ({matches.length})</Text>
                    </Pressable>
                    <Pressable
                        style={[styles.tab, activeTab === 'likes' && { borderBottomColor: theme.text, borderBottomWidth: 2 }]}
                        onPress={() => setActiveTab('likes')}
                    >
                        <Text style={[styles.tabText, { color: activeTab === 'likes' ? theme.text : theme.subText }]}>Лайкнули ({likesYou.length})</Text>
                    </Pressable>
                </View>

                <ScrollView contentContainerStyle={styles.list}>
                    {activeTab === 'matches' ? (
                        matches.length > 0 ? (
                            matches.map((match) => (
                                <View
                                    key={match.id}
                                    style={[styles.card, { backgroundColor: theme.cardBg }]}
                                >
                                    <Pressable
                                        style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}
                                        onPress={() => router.push(`/users/${match.id}` as any)}
                                    >
                                        <Image
                                            source={{ uri: Array.isArray(match.photos) ? match.photos[0] : (match.photo || match.photos) }}
                                            style={styles.avatar}
                                            contentFit="cover"
                                            transition={200}
                                        />
                                        <View style={styles.info}>
                                            <Text style={[styles.name, { color: theme.text }]} numberOfLines={1}>
                                                {(match.name || 'Пользователь')}{match.age ? `, ${match.age}` : ''}
                                            </Text>
                                            <Text style={[styles.details, { color: theme.subText }]} numberOfLines={1}>
                                                {match.ethnicity || ''}
                                            </Text>
                                        </View>
                                    </Pressable>

                                    <Pressable
                                        style={[styles.iconBtn, { backgroundColor: isLight ? '#f5f5f5' : 'rgba(255,255,255,0.1)' }]}
                                        onPress={() => router.push({ pathname: '/chat/[id]', params: { id: match.chatId, participantId: match.id } })}
                                    >
                                        <Ionicons name="chatbubble-outline" size={20} color={theme.text} />
                                    </Pressable>
                                </View>
                            ))
                        ) : (
                            <View style={styles.empty}>
                                <Text style={[styles.emptyText, { color: theme.subText }]}>Пока нет совпадений</Text>
                            </View>
                        )
                    ) : (
                        likesYou.length > 0 ? (
                            likesYou.map((profile) => (
                                <View
                                    key={profile.id}
                                    style={[styles.card, { backgroundColor: theme.cardBg }]}
                                >
                                    <Pressable
                                        style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}
                                        onPress={() => router.push(`/users/${profile.id}` as any)}
                                    >
                                        <Image
                                            source={{ uri: Array.isArray(profile.photos) ? profile.photos[0] : (profile.photo || profile.photos) }}
                                            style={styles.avatar}
                                            contentFit="cover"
                                            transition={200}
                                        />
                                        <View style={styles.info}>
                                            <Text style={[styles.name, { color: theme.text }]} numberOfLines={1}>
                                                {(profile.name || 'Пользователь')}{profile.age ? `, ${profile.age}` : ''}
                                            </Text>
                                            <Text style={[styles.details, { color: theme.subText }]} numberOfLines={1}>
                                                {profile.ethnicity || ''}
                                            </Text>
                                        </View>
                                    </Pressable>
                                    {/* No chat button for likes - they need to match first */}
                                </View>
                            ))
                        ) : (
                            <View style={styles.empty}>
                                <Text style={[styles.emptyText, { color: theme.subText }]}>Пока никто не лайкнул</Text>
                            </View>
                        )
                    )}
                </ScrollView>
            </View>
        </ThemedBackground>
    );
}

const styles = StyleSheet.create({
    header: { paddingHorizontal: 20, paddingVertical: 10, paddingTop: 10 },
    title: { fontSize: 28, fontWeight: '300' },

    tabContainer: { flexDirection: 'row', paddingHorizontal: 20, marginBottom: 10 },
    tab: { paddingVertical: 10, marginRight: 20 },
    tabText: { fontSize: 16, fontWeight: '500' },

    list: { padding: 20 },
    card: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 15,
        borderRadius: 20,
        marginBottom: 15,
        elevation: 2,
        shadowColor: '#000',
        shadowOpacity: 0.1,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 5 }
    },
    avatar: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#ccc', overflow: 'hidden' },
    info: { flex: 1, marginLeft: 15 },
    name: { fontSize: 18, fontWeight: '600' },
    details: { fontSize: 14, marginTop: 4 },
    iconBtn: { padding: 10, borderRadius: 20 },

    empty: { alignItems: 'center', marginTop: 50 },
    emptyText: { fontSize: 16 }
});