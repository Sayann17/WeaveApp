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
import { getReligionById, getZodiacSignById } from '../utils/basic_info';
import { formatMessageTime } from '../utils/date';
import { normalize } from '../utils/normalize';
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

    // Helper to render bio details (gender, zodiac, religion)
    const renderBioDetails = (profile: any) => {
        // Debug: check what data we're receiving
        console.log('[renderBioDetails] Profile data:', {
            id: profile.id,
            name: profile.name,
            gender: profile.gender,
            zodiac: profile.zodiac,
            religion: profile.religion,
            religions: profile.religions
        });

        const items = [];
        const dotColor = theme.subText;

        // 1. Gender (text)
        if (profile.gender) {
            const genderText = profile.gender === 'female' ? 'Женщина' : 'Мужчина';
            items.push(
                <Text key="gender" style={{ fontSize: normalize(13), color: theme.subText }}>
                    {genderText}
                </Text>
            );
        }

        // 2. Zodiac (emoji + name)
        if (profile.zodiac) {
            const zodiac = getZodiacSignById(profile.zodiac);
            if (zodiac) {
                items.push(
                    <Text key="zodiac" style={{ fontSize: normalize(13), color: theme.subText }}>
                        {zodiac.emoji} {zodiac.name}
                    </Text>
                );
            }
        }

        // 3. Religion (from array or single value)
        const getReligions = () => {
            if (profile.religions && Array.isArray(profile.religions) && profile.religions.length > 0) {
                return profile.religions.map((id: string) => {
                    const rel = getReligionById(id);
                    return rel ? rel.name : id;
                }).join(', ');
            } else if (profile.religion) {
                const rel = getReligionById(profile.religion);
                return rel ? rel.name : profile.religion;
            }
            return null;
        };

        const religionsText = getReligions();
        if (religionsText) {
            items.push(
                <Text key="religion" style={{ fontSize: normalize(13), color: theme.subText }}>
                    {religionsText}
                </Text>
            );
        }

        if (items.length === 0) return null;

        // Render items with dots between them
        return (
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: normalize(4), flexWrap: 'wrap' }}>
                {items.map((item, index) => (
                    <React.Fragment key={index}>
                        {item}
                        {index < items.length - 1 && (
                            <View
                                style={{
                                    width: normalize(3),
                                    height: normalize(3),
                                    borderRadius: normalize(1.5),
                                    backgroundColor: dotColor,
                                    marginHorizontal: normalize(6),
                                }}
                            />
                        )}
                    </React.Fragment>
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
                <View style={{ paddingTop: getPlatformPadding(insets, isMobile, 92), marginBottom: 15 }}>
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
                                    style={[styles.card, { backgroundColor: themeType === 'wine' ? '#4f111c' : theme.cardBg, flexDirection: 'column', alignItems: 'flex-start' }]}
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
                                                <Text style={[styles.details, { color: themeType === 'wine' ? '#ffd9d9' : '#4ade80' }]} numberOfLines={1}>
                                                    {getHeritageString(match)}
                                                </Text>
                                                {renderBioDetails(match)}
                                            </View>
                                        </Pressable>
                                    </View>

                                    {/* Separator Line */}
                                    <View style={{ height: 1, backgroundColor: themeType === 'light' ? '#E5E5EA' : 'rgba(255,255,255,0.15)', marginHorizontal: normalize(16), marginTop: normalize(8) }} />

                                    {/* Bottom Row: Message Preview */}
                                    <Pressable
                                        style={{ width: '100%', marginTop: normalize(10), flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
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
                                                {match.lastMessage || 'Какое сплетение создаст ваш Узор... Проверим?'}
                                            </Text>
                                        </View>

                                        {/* Right Column: Badge Only */}
                                        <View style={{ justifyContent: 'center', marginRight: normalize(0) }}>
                                            {(match.unreadCount > 0 || match.hasUnread) && (
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
                                            )}
                                        </View>
                                    </Pressable>
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
                                    style={[styles.card, { backgroundColor: themeType === 'wine' ? '#4f111c' : theme.cardBg }]}
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
                                            <Text style={[styles.details, { color: themeType === 'wine' ? '#ffd9d9' : '#4ade80' }]} numberOfLines={1}>
                                                {getHeritageString(profile)}
                                            </Text>
                                            {renderBioDetails(profile)}
                                        </View>
                                    </Pressable>

                                    {/* Action Buttons for Likes */}
                                    <View style={{ flexDirection: 'row', gap: normalize(10) }}>
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
                                    style={[styles.card, { backgroundColor: themeType === 'wine' ? '#4f111c' : theme.cardBg }]}
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
                                            <Text style={[styles.details, { color: themeType === 'wine' ? '#ffd9d9' : '#4ade80' }]} numberOfLines={1}>
                                                {getHeritageString(profile)}
                                            </Text>
                                            {renderBioDetails(profile)}
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
    }
});