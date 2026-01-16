import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Pressable,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ThemedBackground } from '../components/ThemedBackground';
import { useNotifications } from '../context/NotificationContext';
import { useTelegram } from '../context/TelegramProvider';
import { useTheme } from '../context/ThemeContext';
import { yandexAuth } from '../services/yandex/AuthService';
import { yandexMatch } from '../services/yandex/MatchService';
import { getPlatformPadding } from '../utils/platformPadding';

export default function MatchesScreen() {
    const router = useRouter();
    const { theme, themeType } = useTheme();
    const { resetNewLikes } = useNotifications();
    const [matches, setMatches] = useState<any[]>([]);
    const [likesYou, setLikesYou] = useState<any[]>([]);
    const [yourLikes, setYourLikes] = useState<any[]>([]);
    const [activeTab, setActiveTab] = useState<'matches' | 'likes' | 'sent'>('matches');
    const [loading, setLoading] = useState(true);
    const insets = useSafeAreaInsets();
    const { isMobile, hideBackButton } = useTelegram(); // Added hideBackButton

    const isLight = themeType === 'light';

    useFocusEffect(
        useCallback(() => {
            // Logic to run when the screen comes into focus
            hideBackButton();
        }, [])
    );

    useFocusEffect(
        useCallback(() => {
            loadMatches();
            resetNewLikes();
        }, [])
    );

    const loadMatches = async () => {
        try {
            const user = yandexAuth.getCurrentUser();
            if (!user) {
                setLoading(false);
                return;
            }
            const [matchesData, likesData, sentLikesData] = await Promise.all([
                yandexMatch.getMatches(),
                yandexMatch.getLikesYou(),
                yandexMatch.getYourLikes()
            ]);
            setMatches(matchesData || []);
            setLikesYou(likesData || []);
            setYourLikes(sentLikesData || []);
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

    const handleLikeBack = async (profile: any) => {
        try {
            const result = await yandexMatch.likeUser(profile.id);
            if (result.type === 'match') {
                // Show Match Alert
                Alert.alert("It's a Match!", `Вы и ${profile.name} лайкнули друг друга!`);

                // Remove from Likes You
                setLikesYou(prev => prev.filter(p => p.id !== profile.id));

                // Add to Matches (optimistic)
                const newMatch = {
                    ...profile,
                    id: profile.id, // Ensure ID is explicit
                    name: profile.name || 'Пользователь',
                    chatId: result.chatId || [yandexAuth.getCurrentUser()?.uid, profile.id].sort().join('_')
                };

                // Validate fields to prevent "User not found"
                if (!newMatch.id) {
                    console.error('[Matches] Created match with missing ID! Profile:', profile);
                }

                setMatches(prev => [newMatch, ...prev]);
            } else {
                // If they liked us, remove from "Likes You" list
                setLikesYou(prev => prev.filter(p => p.id !== profile.id));
            }
        } catch (e) {
            console.error(e);
            Alert.alert('Ошибка', 'Не удалось лайкнуть пользователя');
        }
    };

    const handleDislike = async (profile: any) => {
        try {
            await yandexMatch.dislikeUser(profile.id);
            setLikesYou(prev => prev.filter(p => p.id !== profile.id));
        } catch (e) {
            console.error(e);
        }
    };

    // Helper to format roots
    const getHeritageString = (profile: any) => {
        const ETHNICITY_MAP: Record<string, string> = {
            slavic: 'Славянские', asian: 'Азиатские', caucasian: 'Кавказские',
            finno_ugric: 'Финно-угорские', european: 'Европейские', african: 'Африканские',
            latin: 'Латиноамериканские', arab: 'Арабские', jewish: 'Еврейские',
            indian: 'Индийские', native_american: 'Коренные', pacific: 'Тихоокеанские',
            middle_eastern: 'Ближневосточные', turkic: 'Тюркские',
            indo_european: 'Индоевропейские корни', world_citizen: 'Человек мира'
        };
        const parts = [];
        if (profile.macroGroups && Array.isArray(profile.macroGroups) && profile.macroGroups.length > 0) {
            const groups = [...profile.macroGroups];
            const worldCitizenIndex = groups.indexOf('world_citizen');
            let worldCitizenPart = '';

            if (worldCitizenIndex !== -1) {
                worldCitizenPart = 'Человек мира';
                groups.splice(worldCitizenIndex, 1);
            }

            const otherRoots = groups.map((g: string) => ETHNICITY_MAP[g] || g).join(', ');
            const otherRootsPart = otherRoots ? `${otherRoots} корни` : '';

            // Combine
            const combinedRoots = [worldCitizenPart, otherRootsPart].filter(Boolean).join(', ');
            if (combinedRoots) parts.push(combinedRoots);
        }
        if (profile.ethnicity) {
            parts.push(profile.ethnicity.charAt(0).toUpperCase() + profile.ethnicity.slice(1).toLowerCase());
        }
        return parts.join(' • ');
    };

    return (
        <ThemedBackground>
            <StatusBar barStyle={isLight ? "dark-content" : "light-content"} />
            <View style={{ flex: 1 }}>
                {/* Таб-бар */}
                <View style={[styles.tabContainer, { paddingTop: getPlatformPadding(insets, isMobile, 78) }]}>
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
                    <Pressable
                        style={[styles.tab, activeTab === 'sent' && { borderBottomColor: theme.text, borderBottomWidth: 2 }]}
                        onPress={() => setActiveTab('sent')}
                    >
                        <Text style={[styles.tabText, { color: activeTab === 'sent' ? theme.text : theme.subText }]}>Вы лайкнули ({yourLikes.length})</Text>
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
                                        style={{ flexDirection: 'row', alignItems: 'center', flex: 1, paddingRight: 10 }}
                                        onPress={() => router.push({ pathname: '/chat/[id]', params: { id: match.chatId, participantId: match.id } })}
                                    >
                                        <Image
                                            source={{ uri: Array.isArray(match.photos) ? match.photos[0] : (match.photo || match.photos) }}
                                            style={styles.avatar}
                                            contentFit="cover"
                                            transition={200}
                                        />
                                        <View style={styles.info}>
                                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <Text style={[styles.name, { color: theme.text }]} numberOfLines={1}>
                                                    {(match.name || 'Пользователь')}{match.age ? `, ${match.age}` : ''}
                                                </Text>
                                            </View>

                                            <Text
                                                style={{
                                                    marginTop: 2,
                                                    fontSize: 14,
                                                    color: match.hasUnread ? theme.text : (match.lastMessage ? theme.subText : theme.subText),
                                                    fontWeight: match.hasUnread ? '700' : '400',
                                                    fontStyle: !match.lastMessage ? 'italic' : 'normal'
                                                }}
                                                numberOfLines={1}
                                            >
                                                {match.lastMessage || 'Сделай первый шаг! 💬'}
                                            </Text>
                                        </View>
                                    </Pressable>

                                    {/* Action Buttons */}
                                    <View style={styles.actionColumn}>
                                        <Pressable
                                            style={[styles.actionButton, styles.blockButton]}
                                            onPress={() => { }}
                                        >
                                            <Ionicons name="ban-outline" size={16} color="#ff4444" style={{ marginRight: 4 }} />
                                            {/* <Text style={[styles.actionButtonText, { color: '#ff4444' }]}></Text> */}
                                        </Pressable>
                                    </View>
                                </View>
                            ))
                        ) : (
                            <View style={styles.empty}>
                                <Text style={[styles.emptyText, { color: theme.subText }]}>Пока нет совпадений</Text>
                            </View>
                        )
                    ) : activeTab === 'likes' ? (
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
                                            <Text style={[styles.details, { color: '#4ade80' }]} numberOfLines={1}>
                                                {getHeritageString(profile)}
                                            </Text>
                                        </View>
                                    </Pressable>

                                    {/* Action Buttons for Likes */}
                                    <View style={{ flexDirection: 'row', gap: 10 }}>
                                        <Pressable
                                            style={[styles.iconBtn, { backgroundColor: isLight ? '#fff0f0' : 'rgba(255,0,0,0.1)' }]}
                                            onPress={() => handleDislike(profile)}
                                        >
                                            <Ionicons name="close" size={20} color="#ff4444" />
                                        </Pressable>
                                        <Pressable
                                            style={[styles.iconBtn, { backgroundColor: isLight ? '#f0f8ff' : 'rgba(0,100,255,0.1)' }]}
                                            onPress={() => handleLikeBack(profile)}
                                        >
                                            <Ionicons name="heart" size={20} color="#e1306c" />
                                        </Pressable>
                                    </View>
                                </View>
                            ))
                        ) : (
                            <View style={styles.empty}>
                                <Text style={[styles.emptyText, { color: theme.subText }]}>Вас пока никто не лайкнул</Text>
                            </View>
                        )
                    ) : (
                        yourLikes.length > 0 ? (
                            yourLikes.map((profile) => (
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
                                            <Text style={[styles.details, { color: '#4ade80' }]} numberOfLines={1}>
                                                {getHeritageString(profile)}
                                            </Text>
                                        </View>
                                    </Pressable>
                                </View>
                            ))
                        ) : (
                            <View style={styles.empty}>
                                <Text style={[styles.emptyText, { color: theme.subText }]}>Вы пока никого не лайкнули</Text>
                            </View>
                        )
                    )}
                </ScrollView>
            </View >
        </ThemedBackground >
    );
}

const styles = StyleSheet.create({
    tabContainer: { flexDirection: 'row', paddingHorizontal: 20, marginBottom: 10, marginTop: 10 },
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
    emptyText: { fontSize: 16 },

    actionColumn: {
        alignItems: 'flex-end',
        justifyContent: 'center',
        gap: 8,
        minWidth: 100
    },
    actionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 12,
    },
    chatButton: {
        // backgroundColor handled dynamically
    },
    blockButton: {
        backgroundColor: 'transparent',
    },
    actionButtonText: {
        fontSize: 14,
        fontWeight: '600'
    },
    unreadDot: {
        position: 'absolute',
        top: -2,
        right: -2,
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#ff4444',
        borderWidth: 1.5,
    }
});


