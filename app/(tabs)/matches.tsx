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
import { useData } from '../context/DataContext';
import { useNotifications } from '../context/NotificationContext';
import { useTelegram } from '../context/TelegramProvider';
import { useTheme } from '../context/ThemeContext';
import { yandexAuth } from '../services/yandex/AuthService';
import { yandexMatch } from '../services/yandex/MatchService';
import { getReligionById, getZodiacSignById } from '../utils/basic_info';
import { formatMessageTime } from '../utils/date';
import { normalize } from '../utils/normalize';
import { getPlatformPadding } from '../utils/platformPadding';

const ETHNICITY_MAP: Record<string, string> = {
    slavic: 'Славянские', asian: 'Азиатские', caucasian: 'Кавказские',
    finno_ugric: 'Финно-угорские', european: 'Европейские', african: 'Африканские',
    latin: 'Латиноамериканские', arab: 'Арабские', jewish: 'Еврейские',
    indian: 'Индийские', native_american: 'Коренные', pacific: 'Тихоокеанские',
    middle_eastern: 'Ближневосточные', turkic: 'Тюркские',
    indo_european: 'Индоевропейские корни', world_citizen: 'Человек мира'
};

export default function MatchesScreen() {
    const router = useRouter();
    const { theme, themeType } = useTheme();
    const { resetNewLikes } = useNotifications();
    const {
        matches: preloadedMatches,
        likesYou: preloadedLikes,
        yourLikes: preloadedSent,
        isLoading: isContextLoading
    } = useData();

    const [matches, setMatches] = useState<any[]>([]);
    const [likesYou, setLikesYou] = useState<any[]>([]);
    const [yourLikes, setYourLikes] = useState<any[]>([]);
    const [activeTab, setActiveTab] = useState<'matches' | 'likes' | 'sent'>('matches');
    const [processingId, setProcessingId] = useState<string | null>(null); // Prevent double-clicks

    const insets = useSafeAreaInsets();
    const { isMobile, hideBackButton } = useTelegram();



    const isLight = themeType === 'light';

    useFocusEffect(
        useCallback(() => {
            // Logic to run when the screen comes into focus
            hideBackButton();
        }, [])
    );

    useFocusEffect(
        useCallback(() => {
            resetNewLikes();
        }, [])
    );

    // Sync with preloaded data
    React.useEffect(() => {
        if (!isContextLoading) {
            setMatches(preloadedMatches);
            setLikesYou(preloadedLikes);
            setYourLikes(preloadedSent);
        }
    }, [isContextLoading, preloadedMatches, preloadedLikes, preloadedSent]);

    if (isContextLoading) {
        return (
            <View style={{ flex: 1, backgroundColor: theme.background, justifyContent: 'center', alignItems: 'center' }}>
                <ActivityIndicator color={theme.text} />
            </View>
        );
    }

    const handleLikeBack = async (profile: any) => {
        if (processingId === profile.id) return; // Prevent double-click
        setProcessingId(profile.id);
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
        } finally {
            setProcessingId(null);
        }
    };

    const handleDislike = async (profile: any) => {
        if (processingId === profile.id) return; // Prevent double-click
        setProcessingId(profile.id);
        try {
            await yandexMatch.dislikeUser(profile.id);
            setLikesYou(prev => prev.filter(p => p.id !== profile.id));
        } catch (e) {
            console.error(e);
        } finally {
            setProcessingId(null);
        }
    };

    // Helper to render bio details as pill chips (heritage + gender, zodiac, religion)
    const renderBioDetails = (profile: any) => {
        const chips: { label: string; isHeritage?: boolean }[] = [];

        // 1. Этнические корни (macroGroups)
        if (profile.macroGroups && Array.isArray(profile.macroGroups) && profile.macroGroups.length > 0) {
            const groups = [...profile.macroGroups];
            const wcIdx = groups.indexOf('world_citizen');
            if (wcIdx !== -1) {
                chips.push({ label: 'Человек мира', isHeritage: true });
                groups.splice(wcIdx, 1);
            }
            if (groups.length > 0) {
                const names = groups.map((g: string) => ETHNICITY_MAP[g] || g).join(', ');
                chips.push({ label: `${names} корни`, isHeritage: true });
            }
        }

        // 2. Национальность (ethnicity)
        if (profile.ethnicity) {
            chips.push({ label: profile.ethnicity.charAt(0).toUpperCase() + profile.ethnicity.slice(1).toLowerCase(), isHeritage: true });
        }

        // 3. Пол
        if (profile.gender) {
            chips.push({ label: profile.gender === 'female' ? 'Женщина' : 'Мужчина' });
        }

        // 4. Зодиак
        if (profile.zodiac && profile.zodiac !== '[]') {
            const zodiac = getZodiacSignById(profile.zodiac);
            if (zodiac) chips.push({ label: `${zodiac.emoji} ${zodiac.name}` });
        }

        // 5. Религия
        const getReligions = () => {
            if (profile.religions && Array.isArray(profile.religions) && profile.religions.length > 0) {
                return profile.religions.map((id: string) => {
                    const rel = getReligionById(id);
                    return rel ? rel.name : id;
                }).join(', ');
            } else if (profile.religion && profile.religion !== '[]') {
                const rel = getReligionById(profile.religion);
                return rel ? rel.name : profile.religion;
            }
            return null;
        };
        const religionsText = getReligions();
        if (religionsText) chips.push({ label: religionsText });

        if (chips.length === 0) return null;

        // Chip styles per theme
        const getChipBg = (isHeritage?: boolean) => {
            if (themeType === 'light') return isHeritage ? 'rgba(0,0,0,0.06)' : '#fff';
            if (themeType === 'wine') return isHeritage ? 'rgba(251,218,201,0.15)' : 'rgba(255,255,255,0.1)';
            return isHeritage ? 'rgba(74,222,128,0.08)' : 'rgba(255,255,255,0.07)';
        };
        const getChipBorder = (isHeritage?: boolean) => {
            if (themeType === 'light') return isHeritage ? 'rgba(0,0,0,0.12)' : '#d0d0d0';
            if (themeType === 'wine') return isHeritage ? 'rgba(251,218,201,0.4)' : 'rgba(255,255,255,0.25)';
            return isHeritage ? 'rgba(74,222,128,0.25)' : 'rgba(255,255,255,0.18)';
        };
        const getChipText = (isHeritage?: boolean) => {
            if (themeType === 'light') return isHeritage ? '#1c1c1e' : '#555555';
            if (themeType === 'wine') return isHeritage ? '#fbdac9' : 'rgba(255,255,255,0.9)';
            return isHeritage ? '#4ade80' : '#E2E8F0';
        };

        return (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: normalize(6), marginTop: normalize(6) }}>
                {chips.map((chip, idx) => (
                    <View
                        key={idx}
                        style={{
                            backgroundColor: getChipBg(chip.isHeritage),
                            borderWidth: 1,
                            borderColor: getChipBorder(chip.isHeritage),
                            borderRadius: normalize(20),
                            paddingHorizontal: normalize(10),
                            paddingVertical: normalize(4),
                        }}
                    >
                        <Text style={{ fontSize: normalize(12), color: getChipText(chip.isHeritage), fontWeight: '500' }}>
                            {chip.label}
                        </Text>
                    </View>
                ))}
            </View>
        );
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
                {/* Таб-бар (Chip Style) */}
                <View style={{ paddingTop: getPlatformPadding(insets, isMobile, 102), marginBottom: 5 }}>
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={{ paddingHorizontal: normalize(20), gap: normalize(2) }}
                    >
                        <Pressable
                            style={[
                                styles.tabChip,
                                {
                                    backgroundColor: activeTab === 'matches' ? theme.text : 'transparent',
                                    borderColor: theme.border,
                                }
                            ]}
                            onPress={() => setActiveTab('matches')}
                        >
                            <Text style={[
                                styles.tabChipText,
                                { color: activeTab === 'matches' ? theme.background : theme.subText }
                            ]}>
                                Мэтчи ({matches.length})
                            </Text>
                        </Pressable>
                        <Pressable
                            style={[
                                styles.tabChip,
                                {
                                    backgroundColor: activeTab === 'likes' ? theme.text : 'transparent',
                                    borderColor: theme.border,
                                }
                            ]}
                            onPress={() => setActiveTab('likes')}
                        >
                            <Text style={[
                                styles.tabChipText,
                                { color: activeTab === 'likes' ? theme.background : theme.subText }
                            ]}>
                                Вас лайкнули ({likesYou.length})
                            </Text>
                        </Pressable>
                        <Pressable
                            style={[
                                styles.tabChip,
                                {
                                    backgroundColor: activeTab === 'sent' ? theme.text : 'transparent',
                                    borderColor: theme.border,
                                }
                            ]}
                            onPress={() => setActiveTab('sent')}
                        >
                            <Text style={[
                                styles.tabChipText,
                                { color: activeTab === 'sent' ? theme.background : theme.subText }
                            ]}>
                                Вы лайкнули ({yourLikes.length})
                            </Text>
                        </Pressable>
                    </ScrollView>
                </View>

                <ScrollView contentContainerStyle={[styles.list, { paddingBottom: normalize(120) }]}>
                    {activeTab === 'matches' ? (
                        matches.length > 0 ? (
                            matches.map((match) => (
                                <View
                                    key={match.id}
                                    style={[styles.card, { backgroundColor: themeType === 'wine' ? 'rgba(79, 17, 28, 0.65)' : theme.cardBg, borderWidth: 1, borderColor: theme.border, flexDirection: 'column', alignItems: 'flex-start' }]}
                                >
                                    {/* Top Row: Avatar, Name, Menu Button */}
                                    <View style={{ flexDirection: 'row', alignItems: 'center', width: '100%' }}>
                                        <Pressable
                                            style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}
                                            onPress={() => router.push({ pathname: '/chat/[id]', params: { id: match.chatId, participantId: match.id } })}
                                        >
                                            <Image
                                                source={{ uri: Array.isArray(match.photos) ? match.photos[0] : (match.photo || match.photos) }}
                                                style={styles.avatar}
                                                contentFit="cover"
                                                transition={200}
                                            />
                                            <View style={[styles.info, { flex: 1 }]}>
                                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                                                    <Text style={[styles.name, { color: theme.text, flex: 1, marginRight: normalize(8) }]} numberOfLines={1}>
                                                        {(match.name || 'Пользователь')}{match.age ? `, ${match.age}` : ''}
                                                    </Text>
                                                    <Text style={{ fontSize: normalize(12), color: theme.subText }}>
                                                        {formatMessageTime(match.lastMessageTime) || ''}
                                                    </Text>
                                                </View>
                                                {renderBioDetails(match)}
                                            </View>

                                        </Pressable>
                                    </View>

                                    {/* Separator Line */}
                                    <View style={{ height: 1, backgroundColor: themeType === 'light' ? 'rgba(0,0,0,0.15)' : 'rgba(255,255,255,0.2)', marginTop: normalize(8), width: '100%' }} />

                                    {/* Bottom Row: Message Preview */}
                                    <View style={{ width: '100%', marginTop: normalize(10) }}>
                                        <Pressable
                                            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
                                            onPress={() => router.push({ pathname: '/chat/[id]', params: { id: match.chatId, participantId: match.id } })}
                                        >
                                            <View style={{ flex: 1, marginRight: normalize(10) }}>
                                                <Text
                                                    style={{
                                                        fontSize: normalize(14),
                                                        color: match.hasUnread ? theme.text : (match.lastMessage ? theme.subText : theme.subText),
                                                        fontWeight: match.hasUnread ? '700' : '400',
                                                        fontStyle: !match.lastMessage ? 'italic' : 'normal',
                                                        lineHeight: normalize(20)
                                                    }}
                                                    numberOfLines={1}
                                                >
                                                    {match.lastMessage || 'Сплетем узор? Напиши первое сообщение!'}
                                                </Text>
                                            </View>

                                            {/* Right Column: Badge OR Ticks */}
                                            <View style={{ justifyContent: 'center', marginRight: normalize(0) }}>
                                                {match.isOwnMessage ? (
                                                    <Ionicons
                                                        name={match.isRead ? "checkmark-done" : "checkmark"}
                                                        size={normalize(16)}
                                                        color={match.isRead ? '#4ade80' : (themeType === 'light' ? theme.subText : 'rgba(255,255,255,0.5)')}
                                                    />
                                                ) : (
                                                    (match.unreadCount > 0 || match.hasUnread) && (
                                                        <View style={{
                                                            backgroundColor: themeType === 'light' ? (theme.accent || '#00b894') : '#fff',
                                                            borderRadius: normalize(10),
                                                            paddingHorizontal: normalize(6),
                                                            paddingVertical: normalize(2),
                                                            minWidth: normalize(18),
                                                            alignItems: 'center',
                                                            justifyContent: 'center'
                                                        }}>
                                                            <Text style={{ color: themeType === 'light' ? '#fff' : '#000', fontSize: normalize(10), fontWeight: 'bold' }}>
                                                                {match.unreadCount || 1}
                                                            </Text>
                                                        </View>
                                                    )
                                                )}
                                            </View>
                                        </Pressable>

                                        {/* Кнопка "Открыть чат" - слева под превью */}
                                        <Pressable
                                            style={{
                                                backgroundColor: isLight ? '#000' : '#fff',
                                                paddingHorizontal: normalize(12),
                                                paddingVertical: normalize(6),
                                                borderRadius: normalize(12),
                                                alignSelf: 'flex-start',
                                                marginTop: normalize(8)
                                            }}
                                            onPress={() => router.push({ pathname: '/chat/[id]', params: { id: match.chatId, participantId: match.id } })}
                                        >
                                            <Text style={{
                                                color: isLight ? '#fff' : '#000',
                                                fontSize: normalize(12),
                                                fontWeight: '600'
                                            }}>
                                                Открыть чат
                                            </Text>
                                        </Pressable>
                                    </View>
                                </View>
                            ))
                        ) : (
                            <View style={styles.emptyContainer}>
                                <Text style={[styles.emptyTitle, { color: theme.text }]}>Пока нет совпадений 😔</Text>
                                <Text style={[styles.emptySubtitle, { color: theme.subText }]}>
                                    Давай отредактируем твой профиль или посмотрим анкеты? :)
                                </Text>
                                <Text style={[styles.emptyTips, { color: theme.subText }]}>
                                    Советы:{"\n"}
                                    1. Добавьте 2-3 ваших реальных фотографий — людям важно увидеть настоящего тебя{"\n"}
                                    2. Заполните необязательные вопросы, раскрывающие вашу личность{"\n"}
                                    3. Проявите инициативу! Поставьте лайки понравившимся анкетам :)
                                </Text>
                                <View style={[styles.emptyButtons, { flexDirection: 'column' }]}>
                                    <Pressable
                                        style={[styles.emptyButton, { backgroundColor: isLight ? '#000' : '#fff' }]}
                                        onPress={() => router.push('/profile/edit')}
                                    >
                                        <Text style={[styles.emptyButtonText, { color: isLight ? '#fff' : '#000' }]}>Редактировать профиль</Text>
                                    </Pressable>
                                    <Pressable
                                        style={[styles.emptyButton, { backgroundColor: isLight ? '#000' : '#fff' }]}
                                        onPress={() => router.push('/(tabs)/search')}
                                    >
                                        <Text style={[styles.emptyButtonText, { color: isLight ? '#fff' : '#000' }]}>Поиск</Text>
                                    </Pressable>
                                </View>
                            </View>
                        )
                    ) : activeTab === 'likes' ? (
                        likesYou.length > 0 ? (
                            likesYou.map((profile) => (
                                <View
                                    key={profile.id}
                                    style={[styles.card, { backgroundColor: themeType === 'wine' ? 'rgba(79, 17, 28, 0.65)' : theme.cardBg, borderWidth: 1, borderColor: theme.border }]}
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
                                            {renderBioDetails(profile)}
                                        </View>
                                    </Pressable>

                                    {/* Action Buttons for Likes */}
                                    <View style={{ flexDirection: 'row', gap: normalize(10) }}>
                                        <Pressable
                                            style={[styles.iconBtn, {
                                                backgroundColor: isLight ? '#fff0f0' : 'rgba(255,0,0,0.1)',
                                                opacity: processingId === profile.id ? 0.5 : 1
                                            }]}
                                            disabled={processingId === profile.id}
                                            onPress={() => handleDislike(profile)}
                                        >
                                            <Ionicons name="close" size={20} color="#ff4444" />
                                        </Pressable>
                                        <Pressable
                                            style={[styles.iconBtn, {
                                                backgroundColor: isLight ? '#f0f8ff' : 'rgba(0,100,255,0.1)',
                                                opacity: processingId === profile.id ? 0.5 : 1
                                            }]}
                                            disabled={processingId === profile.id}
                                            onPress={() => handleLikeBack(profile)}
                                        >
                                            <Ionicons name="heart" size={20} color="#e1306c" />
                                        </Pressable>
                                    </View>
                                </View>
                            ))
                        ) : (
                            <View style={styles.emptyContainer}>
                                <Text style={[styles.emptyTitle, { color: theme.text }]}>Вас пока никто не лайкнул 😔</Text>
                                <Text style={[styles.emptySubtitle, { color: theme.subText }]}>
                                    Возможно вы не полностью заполнили свой профиль
                                </Text>
                                <Text style={[styles.emptyTips, { color: theme.subText }]}>
                                    Советы:{"\n"}
                                    1. Добавьте 2-3 ваших реальных фотографий — людям важно увидеть настоящего тебя{"\n"}
                                    2. Заполните необязательные вопросы, раскрывающие вашу личность{"\n"}
                                    3. Проявите инициативу! Поставьте лайки понравившимся анкетам :)
                                </Text>
                                <View style={[styles.emptyButtons, { flexDirection: 'column' }]}>
                                    <Pressable
                                        style={[styles.emptyButton, { backgroundColor: isLight ? '#000' : '#fff' }]}
                                        onPress={() => router.push('/profile/edit')}
                                    >
                                        <Text style={[styles.emptyButtonText, { color: isLight ? '#fff' : '#000' }]}>Редактировать профиль</Text>
                                    </Pressable>
                                </View>
                            </View>
                        )
                    ) : (
                        yourLikes.length > 0 ? (
                            yourLikes.map((profile) => (
                                <View
                                    key={profile.id}
                                    style={[styles.card, { backgroundColor: themeType === 'wine' ? 'rgba(79, 17, 28, 0.65)' : theme.cardBg, borderWidth: 1, borderColor: theme.border }]}
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
                                            {renderBioDetails(profile)}
                                        </View>
                                    </Pressable>
                                </View>
                            ))
                        ) : (
                            <View style={styles.emptyContainer}>
                                <Text style={[styles.emptyTitle, { color: theme.text }]}>Вы пока никого не лайкнули 😔</Text>
                                <Text style={[styles.emptySubtitle, { color: theme.subText }]}>
                                    Чтобы случился Мэтч, нужно поставить лайк анкете, которая вам понравилась!{"\n"}
                                    Но ты наверняка об этом уже знаешь :){"\n"}{"\n"}
                                    Пойдем искать?
                                </Text>
                                <View style={[styles.emptyButtons, { flexDirection: 'column' }]}>
                                    <Pressable
                                        style={[styles.emptyButton, { backgroundColor: isLight ? '#000' : '#fff' }]}
                                        onPress={() => router.push('/(tabs)/search')}
                                    >
                                        <Text style={[styles.emptyButtonText, { color: isLight ? '#fff' : '#000' }]}>Поиск</Text>
                                    </Pressable>
                                </View>
                            </View>
                        )
                    )}
                </ScrollView>
            </View >
        </ThemedBackground >
    );
}

const styles = StyleSheet.create({
    tabContainer: { flexDirection: 'row', paddingHorizontal: normalize(20), marginBottom: normalize(10), marginTop: normalize(10) },
    tab: { paddingVertical: normalize(10), marginRight: normalize(20) },
    tabText: { fontSize: normalize(16), fontWeight: '500' },

    // Chip-style tabs
    tabChip: {
        paddingHorizontal: normalize(12),
        paddingVertical: normalize(8),
        borderRadius: normalize(20),
        borderWidth: 1.5,
        alignItems: 'center',
        justifyContent: 'center',
    },
    tabChipText: {
        fontSize: normalize(13),
        fontWeight: '600',
    },

    list: { padding: normalize(20) },
    card: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: normalize(15),
        borderRadius: normalize(20),
        marginBottom: normalize(15),
        elevation: 2,
        shadowColor: '#000',
        shadowOpacity: 0.1,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: normalize(5) }
    },
    avatar: { width: normalize(60), height: normalize(60), borderRadius: normalize(30), backgroundColor: '#ccc', overflow: 'hidden' },
    info: { flex: 1, marginLeft: normalize(15) },
    name: { fontSize: normalize(18), fontWeight: '600' },
    details: { fontSize: normalize(14), marginTop: normalize(4) },
    iconBtn: { padding: normalize(10), borderRadius: normalize(20) },

    empty: { alignItems: 'center', marginTop: normalize(50) },
    emptyText: { fontSize: normalize(16) },

    actionColumn: {
        alignItems: 'flex-end',
        justifyContent: 'center',
        gap: normalize(8),
        minWidth: normalize(100)
    },
    actionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: normalize(8),
        paddingHorizontal: normalize(12),
        borderRadius: normalize(12),
    },
    chatButton: {
        // backgroundColor handled dynamically
    },
    blockButton: {
        backgroundColor: 'transparent',
    },
    actionButtonText: {
        fontSize: normalize(14),
        fontWeight: '600'
    },
    unreadDot: {
        position: 'absolute',
        top: -2,
        right: -2,
        width: normalize(8),
        height: normalize(8),
        borderRadius: normalize(4),
        backgroundColor: '#ff4444',
        borderWidth: 1.5,
    },

    // Modal Styles
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center'
    },
    menuModal: {
        width: normalize(250),
        backgroundColor: '#fff',
        borderRadius: normalize(16),
        padding: normalize(5),
        elevation: 5
    },
    menuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: normalize(15),
        gap: normalize(12)
    },
    menuText: {
        fontSize: normalize(16),
        fontWeight: '500'
    },
    divider: {
        height: 1,
        width: '100%',
        backgroundColor: '#eee'
    },
    alertBox: {
        width: '85%',
        padding: normalize(20),
        borderRadius: normalize(20),
        alignItems: 'center'
    },
    alertTitle: {
        fontSize: normalize(18),
        fontWeight: '700',
        marginBottom: normalize(10),
        textAlign: 'center'
    },
    alertMessage: {
        fontSize: normalize(15),
        textAlign: 'center',
        marginBottom: normalize(20),
        lineHeight: normalize(22)
    },
    alertButtons: {
        flexDirection: 'row',
        gap: normalize(15),
        width: '100%'
    },
    alertButton: {
        flex: 1,
        padding: normalize(12),
        borderRadius: normalize(12),
        alignItems: 'center',
        justifyContent: 'center'
    },
    alertButtonText: {
        fontSize: normalize(16),
        fontWeight: '600'
    },
    reasonSheet: {
        width: '100%',
        borderTopLeftRadius: normalize(20),
        borderTopRightRadius: normalize(20),
        padding: normalize(20),
        paddingBottom: normalize(40),
        maxHeight: '90%'
    },
    reasonHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: normalize(20)
    },
    reasonTitle: {
        fontSize: normalize(20),
        fontWeight: '700'
    },
    reasonItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: normalize(16),
        borderBottomWidth: 1,
    },
    reasonText: {
        fontSize: normalize(17),
        fontWeight: '500'
    },
    label: {
        fontSize: normalize(14),
        marginBottom: normalize(8),
        fontWeight: '600'
    },
    inputContainer: {
        borderRadius: normalize(12),
        padding: normalize(12),
        marginBottom: normalize(15)
    },
    input: {
        fontSize: normalize(16),
        minHeight: normalize(60),
        textAlignVertical: 'top'
    },
    submitButton: {
        padding: normalize(15),
        borderRadius: normalize(15),
        alignItems: 'center',
        marginTop: normalize(10)
    },
    submitButtonText: {
        fontSize: normalize(16),
        fontWeight: '700'
    },

    // Empty State Styles
    emptyContainer: {
        alignItems: 'center',
        paddingHorizontal: normalize(20),
        paddingTop: normalize(40),
    },
    emptyTitle: {
        fontSize: normalize(20),
        fontWeight: '700',
        textAlign: 'center',
        marginBottom: normalize(12),
    },
    emptySubtitle: {
        fontSize: normalize(15),
        textAlign: 'center',
        lineHeight: normalize(22),
        marginBottom: normalize(16),
    },
    emptyTips: {
        fontSize: normalize(14),
        textAlign: 'left',
        lineHeight: normalize(22),
        marginBottom: normalize(24),
    },
    emptyButtons: {
        flexDirection: 'row',
        gap: normalize(12),
        width: '100%',
    },
    emptyButton: {
        flex: 1,
        paddingVertical: normalize(14),
        borderRadius: normalize(12),
        alignItems: 'center',
    },
    emptyButtonText: {
        color: '#fff',
        fontSize: normalize(15),
        fontWeight: '600',
    },
    emptyButtonOutline: {
        flex: 1,
        paddingVertical: normalize(14),
        borderRadius: normalize(12),
        alignItems: 'center',
        borderWidth: 2,
        backgroundColor: 'transparent',
    },
    emptyButtonTextOutline: {
        fontSize: normalize(15),
        fontWeight: '600',
    },
});