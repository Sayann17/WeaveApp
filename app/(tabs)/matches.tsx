// @ts-nocheck
// app/(tabs)/matches.tsx
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Pressable,
    StatusBar,
    StyleSheet,
    Text,
    View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ThemedBackground } from '../components/ThemedBackground';
import { useTelegram } from '../context/TelegramProvider';
import { useTheme } from '../context/ThemeContext';
import { yandexAuth } from '../services/yandex/AuthService';
import { yandexMatch } from '../services/yandex/MatchService';
import { getPlatformPadding } from '../utils/platformPadding';

// Telegram UI Imports
import { List, Section, Cell } from '@telegram-apps/telegram-ui';

export default function MatchesScreen() {
    const router = useRouter();
    const { theme, themeType } = useTheme();
    const [matches, setMatches] = useState<any[]>([]);
    const [likesYou, setLikesYou] = useState<any[]>([]);
    const [yourLikes, setYourLikes] = useState<any[]>([]);
    const [activeTab, setActiveTab] = useState<'matches' | 'likes' | 'sent'>('matches');
    const [loading, setLoading] = useState(true);
    const insets = useSafeAreaInsets();
    const { isMobile } = useTelegram();

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

    const handleLikeBack = async (profile: any) => {
        try {
            const result = await yandexMatch.likeUser(profile.id);
            if (result.type === 'match') {
                Alert.alert("It's a Match!", `Вы и ${profile.name} лайкнули друг друга!`);
                setLikesYou(prev => prev.filter(p => p.id !== profile.id));
                const newMatch = {
                    ...profile,
                    chatId: result.chatId || [yandexAuth.getCurrentUser()?.uid, profile.id].sort().join('_')
                };
                setMatches(prev => [newMatch, ...prev]);
            } else {
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

    const getHeritageString = (profile: any) => {
        const ETHNICITY_MAP: Record<string, string> = {
            slavic: 'Славянские', asian: 'Азиатские', caucasian: 'Кавказские',
            finno_ugric: 'Финно-угорские', european: 'Европейские', african: 'Африканские',
            latin: 'Латиноамериканские', arab: 'Арабские', jewish: 'Еврейские',
            indian: 'Индийские', native_american: 'Коренные', pacific: 'Тихоокеанские',
            middle_eastern: 'Ближневосточные', turkic: 'Тюркские'
        };
        const parts = [];
        if (profile.macroGroups && Array.isArray(profile.macroGroups) && profile.macroGroups.length > 0) {
            const roots = profile.macroGroups.map((g: string) => ETHNICITY_MAP[g] || g).join(', ');
            parts.push(`${roots} корни`);
        }
        if (profile.ethnicity) {
            parts.push(profile.ethnicity.charAt(0).toUpperCase() + profile.ethnicity.slice(1).toLowerCase());
        }
        return parts.join(' • ');
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
            <View style={{ flex: 1 }}>
                {/* Custom Tabs placed over the background */}
                <View style={[styles.tabContainer, { paddingTop: getPlatformPadding(insets, isMobile, 20) }]}>
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

                {/* Content List */}
                <List style={{ flex: 1, backgroundColor: 'transparent' }}>
                    {activeTab === 'matches' && (
                        <Section header="Ваши Мэтчи">
                            {matches.length > 0 ? matches.map((match) => (
                                <Cell
                                    key={match.id}
                                    before={
                                        <Image
                                            source={{ uri: Array.isArray(match.photos) ? match.photos[0] : (match.photo || match.photos) }}
                                            style={styles.avatar}
                                            contentFit="cover"
                                        />
                                    }
                                    after={
                                        <Pressable
                                            onPress={(e) => {
                                                e.stopPropagation();
                                                router.push({ pathname: '/chat/[id]', params: { id: match.chatId, participantId: match.id } });
                                            }}
                                            style={{ padding: 8 }}
                                        >
                                            <Ionicons name="chatbubble-outline" size={24} color={theme.text} />
                                        </Pressable>
                                    }
                                    description={getHeritageString(match)}
                                    onClick={() => router.push(`/users/${match.id}` as any)}
                                >
                                    {match.name || 'Пользователь'}, {match.age}
                                </Cell>
                            )) : (
                                <View style={styles.empty}>
                                    <Text style={[styles.emptyText, { color: theme.subText }]}>Пока нет совпадений</Text>
                                </View>
                            )}
                        </Section>
                    )}

                    {activeTab === 'likes' && (
                        <Section header="Вас лайкнули">
                            {likesYou.length > 0 ? likesYou.map((profile) => (
                                <Cell
                                    key={profile.id}
                                    before={
                                        <Image
                                            source={{ uri: Array.isArray(profile.photos) ? profile.photos[0] : (profile.photo || profile.photos) }}
                                            style={styles.avatar}
                                            contentFit="cover"
                                        />
                                    }
                                    after={
                                        <View style={{ flexDirection: 'row', gap: 10 }}>
                                            <Pressable onPress={() => handleDislike(profile)} style={{ padding: 4 }}>
                                                <Ionicons name="close-circle" size={30} color="#ff4444" />
                                            </Pressable>
                                            <Pressable onPress={() => handleLikeBack(profile)} style={{ padding: 4 }}>
                                                <Ionicons name="heart-circle" size={30} color="#e1306c" />
                                            </Pressable>
                                        </View>
                                    }
                                    description={getHeritageString(profile)}
                                    onClick={() => router.push(`/users/${profile.id}` as any)}
                                >
                                    {profile.name || 'Пользователь'}, {profile.age}
                                </Cell>
                            )) : (
                                <View style={styles.empty}>
                                    <Text style={[styles.emptyText, { color: theme.subText }]}>Вас пока никто не лайкнул</Text>
                                </View>
                            )}
                        </Section>
                    )}

                    {activeTab === 'sent' && (
                        <Section header="Вы лайкнули">
                            {yourLikes.length > 0 ? yourLikes.map((profile) => (
                                <Cell
                                    key={profile.id}
                                    before={
                                        <Image
                                            source={{ uri: Array.isArray(profile.photos) ? profile.photos[0] : (profile.photo || profile.photos) }}
                                            style={styles.avatar}
                                            contentFit="cover"
                                        />
                                    }
                                    description={getHeritageString(profile)}
                                    onClick={() => router.push(`/users/${profile.id}` as any)}
                                >
                                    {profile.name || 'Пользователь'}, {profile.age}
                                </Cell>
                            )) : (
                                <View style={styles.empty}>
                                    <Text style={[styles.emptyText, { color: theme.subText }]}>Вы пока никого не лайкнули</Text>
                                </View>
                            )}
                        </Section>
                    )}
                </List>
            </View>
        </ThemedBackground>
    );
}

const styles = StyleSheet.create({
    tabContainer: { flexDirection: 'row', paddingHorizontal: 20, marginBottom: 10 },
    tab: { paddingVertical: 10, marginRight: 20 },
    tabText: { fontSize: 16, fontWeight: '500' },
    avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#ccc' },
    empty: { alignItems: 'center', padding: 20 },
    emptyText: { fontSize: 16 }
});