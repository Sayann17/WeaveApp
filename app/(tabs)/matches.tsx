import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Modal,
    Pressable,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    TouchableWithoutFeedback,
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

    // Blocking & Menu State
    const [menuVisible, setMenuVisible] = useState(false);
    const [selectedMatch, setSelectedMatch] = useState<any>(null);
    const [blockConfirmVisible, setBlockConfirmVisible] = useState(false);
    const [reasonModalVisible, setReasonModalVisible] = useState(false);
    const [customReason, setCustomReason] = useState('');

    const BLOCK_REASONS = [
        'Мошенничество (Скам)',
        'Неприемлемый контент',
        'Нецензурная брань'
    ];

    const isLight = themeType === 'light';

    useFocusEffect(
        useCallback(() => {
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
                Alert.alert("It's a Match!", `Вы и ${profile.name} лайкнули друг друга!`);
                setLikesYou(prev => prev.filter(p => p.id !== profile.id));
                const newMatch = {
                    ...profile,
                    id: profile.id,
                    name: profile.name || 'Пользователь',
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

    // Helper to render gender/zodiac/religion tags
    const renderBioTags = (profile: any) => {
        const items = [];

        // Gender
        if (profile.gender) {
            items.push(
                <View key="gender" style={[styles.tag, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
                    <Ionicons
                        name={profile.gender === 'male' ? 'male' : 'female'}
                        size={12}
                        color={theme.subText}
                    />
                </View>
            );
        }

        // Zodiac
        const zodiac = getZodiacSignById(profile.zodiac);
        if (zodiac) {
            items.push(
                <View key="zodiac" style={[styles.tag, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
                    <Text style={{ fontSize: 10 }}>{zodiac.emoji}</Text>
                    <Text style={[styles.tagText, { color: theme.subText }]}>{zodiac.name}</Text>
                </View>
            );
        }

        // Religion
        // Support array (new format) or string (old format)
        let relId = profile.religion;
        if (!relId && profile.religions && profile.religions.length > 0) {
            relId = profile.religions[0];
        }

        const religion = getReligionById(relId);
        if (religion) {
            items.push(
                <View key="religion" style={[styles.tag, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
                    <Text style={{ fontSize: 10 }}>{religion.emoji}</Text>
                    <Text style={[styles.tagText, { color: theme.subText, maxWidth: 80 }]} numberOfLines={1}>{religion.name}</Text>
                </View>
            );
        }

        return (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                {items}
            </View>
        );
    };


    // --- Actions ---

    const handleOpenProfile = () => {
        setMenuVisible(false);
        if (selectedMatch) {
            router.push(`/users/${selectedMatch.id}` as any);
        }
    };

    const handleBlockOptions = () => {
        setMenuVisible(false);
        setTimeout(() => {
            setBlockConfirmVisible(true);
        }, 100);
    };

    const confirmBlockInit = () => {
        setBlockConfirmVisible(false);
        setTimeout(() => {
            setReasonModalVisible(true);
        }, 100);
    };

    const submitBlock = async (reason: string) => {
        setReasonModalVisible(false);
        setCustomReason('');

        if (!selectedMatch) return;

        try {
            const blockedId = selectedMatch.id;
            setMatches(prev => prev.filter(m => m.id !== blockedId));

            if (yandexMatch.blockUser) {
                await yandexMatch.blockUser(blockedId, reason);
            }

            setLikesYou(prev => prev.filter(p => p.id !== blockedId));
            setYourLikes(prev => prev.filter(p => p.id !== blockedId));

        } catch (e) {
            Alert.alert('Ошибка', 'Не удалось заблокировать пользователя');
            console.error(e);
        }
    };

    return (
        <ThemedBackground>
            <StatusBar barStyle={isLight ? "dark-content" : "light-content"} />

            {/* --- Modals --- */}
            <Modal transparent visible={menuVisible} animationType="fade" onRequestClose={() => setMenuVisible(false)}>
                <TouchableWithoutFeedback onPress={() => setMenuVisible(false)}>
                    <View style={styles.modalOverlay}>
                        <TouchableWithoutFeedback>
                            <View style={[styles.menuModal, { backgroundColor: theme.cardBg }]}>
                                <Pressable style={styles.menuItem} onPress={handleOpenProfile}>
                                    <Ionicons name="person-outline" size={20} color={theme.text} />
                                    <Text style={[styles.menuText, { color: theme.text }]}>Открыть профиль</Text>
                                </Pressable>
                                <View style={[styles.divider, { backgroundColor: theme.border }]} />
                                <Pressable style={styles.menuItem} onPress={handleBlockOptions}>
                                    <Ionicons name="ban-outline" size={20} color="#ff4444" />
                                    <Text style={[styles.menuText, { color: "#ff4444" }]}>Заблокировать</Text>
                                </Pressable>
                            </View>
                        </TouchableWithoutFeedback>
                    </View>
                </TouchableWithoutFeedback>
            </Modal>

            {/* Block Confirmation Modal (omitted for brevity, assume similar structure or kept same logic) */}
            {/* Keeping the modals simplified in this view for clarity, but logic remains valid above */}
            {/* NOTE: Restoring Full Modal Logic Below to ensure no regression */}
            <Modal transparent visible={blockConfirmVisible} animationType="fade" onRequestClose={() => setBlockConfirmVisible(false)}>
                <View style={[styles.modalOverlay, { backgroundColor: 'rgba(0,0,0,0.7)' }]}>
                    <View style={[styles.alertBox, { backgroundColor: theme.cardBg }]}>
                        <Text style={[styles.alertTitle, { color: theme.text }]}>Заблокировать пользователя?</Text>
                        <Text style={[styles.alertMessage, { color: theme.subText }]}>
                            Это безвозвратное действие. Вы больше не увидите друг друга.
                        </Text>
                        <View style={styles.alertButtons}>
                            <Pressable style={[styles.alertButton, { backgroundColor: theme.cardBg, borderColor: theme.border, borderWidth: 1 }]} onPress={() => setBlockConfirmVisible(false)}>
                                <Text style={[styles.alertButtonText, { color: theme.text }]}>Нет</Text>
                            </Pressable>
                            <Pressable style={[styles.alertButton, { backgroundColor: '#ff4444' }]} onPress={confirmBlockInit}>
                                <Text style={[styles.alertButtonText, { color: '#ffffff' }]}>Да</Text>
                            </Pressable>
                        </View>
                    </View>
                </View>
            </Modal>

            <Modal transparent visible={reasonModalVisible} animationType="slide" onRequestClose={() => setReasonModalVisible(false)}>
                <TouchableWithoutFeedback onPress={() => setReasonModalVisible(false)}>
                    <View style={[styles.modalOverlay, { backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' }]}>
                        <TouchableWithoutFeedback>
                            <View style={[styles.reasonSheet, { backgroundColor: theme.cardBg }]}>
                                <View style={styles.reasonHeader}>
                                    <Text style={[styles.reasonTitle, { color: theme.text }]}>Укажите причину</Text>
                                    <Pressable onPress={() => setReasonModalVisible(false)}>
                                        <Ionicons name="close" size={24} color={theme.subText} />
                                    </Pressable>
                                </View>
                                {BLOCK_REASONS.map((reason) => (
                                    <Pressable key={reason} style={[styles.reasonItem, { borderBottomColor: theme.border }]} onPress={() => submitBlock(reason)}>
                                        <Text style={[styles.reasonText, { color: theme.text }]}>{reason}</Text>
                                        <Ionicons name="chevron-forward" size={20} color={theme.subText} />
                                    </Pressable>
                                ))}
                                <View style={{ marginTop: 20 }}>
                                    <Text style={[styles.label, { color: theme.subText }]}>Своя причина</Text>
                                    <View style={[styles.inputContainer, { backgroundColor: isLight ? '#f5f5f5' : '#2a2a2a' }]}>
                                        <TextInput
                                            style={[styles.input, { color: theme.text }]}
                                            value={customReason}
                                            onChangeText={setCustomReason}
                                            placeholder="Опишите..."
                                            placeholderTextColor={theme.subText}
                                            multiline
                                        />
                                    </View>
                                    <Pressable style={[styles.submitButton, { backgroundColor: customReason.trim() ? '#ff4444' : (isLight ? '#eee' : '#333') }]} disabled={!customReason.trim()} onPress={() => submitBlock(customReason.trim())}>
                                        <Text style={[styles.submitButtonText, { color: customReason.trim() ? '#fff' : theme.subText }]}>Подтвердить</Text>
                                    </Pressable>
                                </View>
                            </View>
                        </TouchableWithoutFeedback>
                    </View>
                </TouchableWithoutFeedback>
            </Modal>


            <View style={{ flex: 1 }}>
                {/* --- Tab Bar --- */}
                <View style={[styles.tabContainer, { paddingTop: getPlatformPadding(insets, isMobile, 78) }]}>
                    <Pressable style={[styles.tab, activeTab === 'matches' && { borderBottomColor: theme.text, borderBottomWidth: 2 }]} onPress={() => setActiveTab('matches')}>
                        <Text style={[styles.tabText, { color: activeTab === 'matches' ? theme.text : theme.subText }]}>Мэтчи ({matches.length})</Text>
                    </Pressable>
                    <Pressable style={[styles.tab, activeTab === 'likes' && { borderBottomColor: theme.text, borderBottomWidth: 2 }]} onPress={() => setActiveTab('likes')}>
                        <Text style={[styles.tabText, { color: activeTab === 'likes' ? theme.text : theme.subText }]}>Вас лайкнули ({likesYou.length})</Text>
                    </Pressable>
                    <Pressable style={[styles.tab, activeTab === 'sent' && { borderBottomColor: theme.text, borderBottomWidth: 2 }]} onPress={() => setActiveTab('sent')}>
                        <Text style={[styles.tabText, { color: activeTab === 'sent' ? theme.text : theme.subText }]}>Вы лайкнули ({yourLikes.length})</Text>
                    </Pressable>
                </View>

                {/* --- Content List --- */}
                <ScrollView contentContainerStyle={styles.list}>
                    {activeTab === 'matches' ? (
                        matches.length > 0 ? (
                            matches.map((match) => (
                                <View
                                    key={match.id}
                                    style={[styles.card, { backgroundColor: theme.cardBg, flexDirection: 'column', alignItems: 'flex-start' }]}
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
                                            <View style={styles.info}>
                                                <Text style={[styles.name, { color: theme.text }]} numberOfLines={1}>
                                                    {(match.name || 'Пользователь')}{match.age ? `, ${match.age}` : ''}
                                                </Text>
                                                {renderBioTags(match)}
                                            </View>
                                        </Pressable>

                                        {/* Menu Button */}
                                        <Pressable
                                            style={{ padding: 10 }}
                                            onPress={() => {
                                                setSelectedMatch(match);
                                                setMenuVisible(true);
                                            }}
                                        >
                                            <Ionicons name="menu" size={24} color={theme.subText} />
                                        </Pressable>
                                    </View>

                                    {/* Bottom Row: Message / Hook */}
                                    <Pressable
                                        style={{ width: '100%', marginTop: 10 }}
                                        onPress={() => router.push({ pathname: '/chat/[id]', params: { id: match.chatId, participantId: match.id } })}
                                    >
                                        <Text
                                            style={{
                                                fontSize: 14,
                                                color: match.hasUnread ? theme.text : (match.lastMessage ? theme.subText : theme.subText),
                                                fontWeight: match.hasUnread ? '700' : '400',
                                                fontStyle: !match.lastMessage ? 'italic' : 'normal',
                                                lineHeight: 20
                                            }}
                                            numberOfLines={2}
                                        >
                                            {match.lastMessage || 'Какое сплетение создаст ваш Узор... Проверим?'}
                                        </Text>
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
                                            {renderBioTags(profile)}
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
                                            {renderBioTags(profile)}
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

    // Bio Tags (Minimal)
    tag: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 6,
        borderWidth: 1,
        gap: 4
    },
    tagText: { fontSize: 10, fontWeight: '500' },

    // Keeping these for modal compatibility as they were not part of the card redesign per-se
    actionColumn: { alignItems: 'flex-end', justifyContent: 'center', gap: 8, minWidth: 100 },
    actionButton: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 12 },
    chatButton: {},
    blockButton: { backgroundColor: 'transparent' },
    actionButtonText: { fontSize: 14, fontWeight: '600' },
    unreadDot: { position: 'absolute', top: -2, right: -2, width: 8, height: 8, borderRadius: 4, backgroundColor: '#ff4444', borderWidth: 1.5 },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
    menuModal: { width: 250, backgroundColor: '#fff', borderRadius: 16, padding: 5, elevation: 5 },
    menuItem: { flexDirection: 'row', alignItems: 'center', padding: 15, gap: 12 },
    menuText: { fontSize: 16, fontWeight: '500' },
    divider: { height: 1, width: '100%', backgroundColor: '#eee' },
    alertBox: { width: '85%', padding: 20, borderRadius: 20, alignItems: 'center' },
    alertTitle: { fontSize: 18, fontWeight: '700', marginBottom: 10, textAlign: 'center' },
    alertMessage: { fontSize: 15, textAlign: 'center', marginBottom: 20, lineHeight: 22 },
    alertButtons: { flexDirection: 'row', gap: 15, width: '100%' },
    alertButton: { flex: 1, padding: 12, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    alertButtonText: { fontSize: 16, fontWeight: '600' },
    reasonSheet: { width: '100%', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 40, maxHeight: '90%' },
    reasonHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    reasonTitle: { fontSize: 20, fontWeight: '700' },
    reasonItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 16, borderBottomWidth: 1 },
    reasonText: { fontSize: 17, fontWeight: '500' },
    label: { fontSize: 14, marginBottom: 8, fontWeight: '600' },
    inputContainer: { borderRadius: 12, padding: 12, marginBottom: 15 },
    input: { fontSize: 16, minHeight: 60, textAlignVertical: 'top' },
    submitButton: { padding: 15, borderRadius: 15, alignItems: 'center', marginTop: 10 },
    submitButtonText: { fontSize: 16, fontWeight: '700' }
});


