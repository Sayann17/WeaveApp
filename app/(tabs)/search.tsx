import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Dimensions,
    Modal,
    Pressable,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ProfileView } from '../components/ProfileView';
import { ThemedBackground } from '../components/ThemedBackground';
import { useData } from '../context/DataContext';
import { useTelegram } from '../context/TelegramProvider';
import { useTheme } from '../context/ThemeContext';
import { enhancedMatchService } from '../services/head_match';
import { yandexAuth } from '../services/yandex/AuthService';
import { YandexUserService } from '../services/yandex/UserService';
import { religions } from '../utils/basic_info';
import { ethnicityGroups } from '../utils/ethnicities';
import { normalize } from '../utils/normalize';
import { getPlatformPadding } from '../utils/platformPadding';

const userService = new YandexUserService();

interface UserProfile {
    id: string;
    name: string;
    age: number;
    photos: string[];
    bio?: string;
    gender: string;
    macroGroups: string[];
    customEthnicity?: string;
    zodiac?: string;
    religions?: string[];
    profileCompleted: boolean;
    score?: number;
}

interface Filters {
    gender: 'male' | 'female' | 'all';
    minAge: string;
    maxAge: string;
    ethnicity: string;
    religion: string;
}

const { width } = Dimensions.get('window');


export default function ExploreScreen() {
    const router = useRouter();
    const { theme, isLight, themeType } = useTheme();
    const insets = useSafeAreaInsets();
    const { isMobile, hideBackButton } = useTelegram();

    useFocusEffect(
        useCallback(() => {
            hideBackButton();
        }, [])
    );

    // Data States
    const [currentUser, setCurrentUser] = useState<any>(null);
    const [profiles, setProfiles] = useState<UserProfile[]>([]);
    const [currentProfileIndex, setCurrentProfileIndex] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const { discoveryProfiles: preloadedProfiles, isLoading: isContextLoading, addToYourLikes } = useData();

    // UI States
    const [showFilters, setShowFilters] = useState(false);

    // Custom Filter State - default gender is opposite of current user
    const getDefaultGender = (): 'male' | 'female' | 'all' => {
        if (!currentUser) return 'all';
        return currentUser.gender === 'male' ? 'female' : currentUser.gender === 'female' ? 'male' : 'all';
    };

    const [filters, setFilters] = useState<Filters>({
        gender: 'all', // Will be updated after currentUser loads
        minAge: '18',
        maxAge: '50',
        ethnicity: '',
        religion: ''
    });

    // Temp state for filter modal (to confirm changes only on "Apply")
    const [tempFilters, setTempFilters] = useState<Filters>(filters);
    const [filtersInitialized, setFiltersInitialized] = useState(false);

    useFocusEffect(
        useCallback(() => {
            loadData();
        }, [filters]) // Reload when filters change
    );

    const loadData = async () => {
        // isLoading is initialized to true, so we don't need to set it here again
        // This prevents the spinner from showing every time the tab is focused (silent refresh)
        try {
            const userData = await userService.getCurrentUser();
            if (userData) {
                setCurrentUser(userData);

                // Set default gender filter ONLY on first load
                if (!filtersInitialized) {
                    const defaultGender = userData.gender === 'male' ? 'female' : userData.gender === 'female' ? 'male' : 'all';
                    setFiltersInitialized(true);

                    // Only update if different from current
                    if (filters.gender !== defaultGender) {
                        setFilters(prev => ({ ...prev, gender: defaultGender }));
                        setTempFilters(prev => ({ ...prev, gender: defaultGender }));
                        // The effect will trigger a reload with new filters, so we stop here
                        setIsLoading(false);
                        return;
                    }
                }

                await loadProfiles(userData, filters, 'custom');
            }
        } catch (error) {
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    };

    // Preload Effect
    React.useEffect(() => {
        if (!filtersInitialized && preloadedProfiles.length > 0 && offset === 0) {
            console.log('[Explore] Using preloaded profiles');
            setProfiles(preloadedProfiles);
            setIsLoading(false);
        }
    }, [preloadedProfiles, filtersInitialized]);

    // Offset for pagination
    const offset = profiles.length;

    const loadProfiles = async (currentUserData: any, currentFilters: Filters, mode: 'smart' | 'custom', offset: number = 0) => {
        try {
            const currentUserId = yandexAuth.getCurrentUser()?.uid;
            if (!currentUserId) {
                setIsLoading(false);
                return;
            }

            // Determine effective filters based on mode
            let minAge = 18;
            let maxAge = 100;
            let targetGender: 'male' | 'female' | 'all' = 'all';
            let targetEth = '';
            let targetRel = '';

            if (mode === 'smart') {
                const prefs = currentUserData.preferences || {};
                minAge = prefs.ageRange?.[0] || 18;
                maxAge = prefs.ageRange?.[1] || 40;

                if (currentUserData.gender === 'male') targetGender = 'female';
                else if (currentUserData.gender === 'female') targetGender = 'male';

            } else {
                minAge = parseInt(currentFilters.minAge) || 18;
                maxAge = parseInt(currentFilters.maxAge) || 100;
                targetGender = currentFilters.gender;
                targetEth = currentFilters.ethnicity;
                targetRel = currentFilters.religion;
            }

            // 🔥 USE SERVICE ABSTRACTION
            // Now supports offset for pagination
            const matches = await userService.getPotentialMatches(currentUserId, {
                minAge,
                maxAge,
                gender: targetGender,
                ethnicity: targetEth,
                religion: targetRel,
                offset // Pass offset to backend
            });

            // DEBUG: Log
            console.log(`[Explore] Loaded ${matches.length} profiles (Offset: ${offset})`);

            if (offset === 0) {
                setProfiles(matches);
                setCurrentProfileIndex(0);
            } else {
                // Append new batch
                setProfiles(prev => [...prev, ...matches]);
            }

        } catch (error) {
            console.error(error);
        }
    };

    const handleAction = async (action: 'like' | 'pass') => {
        if (profiles.length === 0) return;
        const profile = profiles[currentProfileIndex];

        // Pre-fetch next batch if we are near the end
        if (currentProfileIndex === profiles.length - 5) {
            console.log('[Explore] Near end of list, fetching next batch...');
            await loadProfiles(currentUser, filters, 'custom', profiles.length);
        }

        try {
            console.log(`[Explore] Action: ${action} for user:`, profile.id);

            if (action === 'pass') {
                await enhancedMatchService.dislikeUser(profile.id);
                console.log('[Explore] Dislike successful');
            } else {
                console.log('[Explore] Sending like...');
                const res = await enhancedMatchService.likeUser(profile.id);
                console.log('[Explore] Like response:', res);

                // Optimistically add to "Your Likes" list
                addToYourLikes(profile);

                if (res.type === 'match') {
                    Alert.alert('Мэтч!', `Вы понравились ${profile.name}!`);
                } else if (res.type === 'like') {
                    console.log('[Explore] Like sent successfully (no match yet)');
                }
            }

            // Move to next profile
            if (currentProfileIndex < profiles.length - 1) {
                setCurrentProfileIndex(prev => prev + 1);
            } else {
                // If we ran out (should be rare with pre-fetching), try to reload
                console.log('[Explore] Stack empty, reloading...');
                setProfiles([]);
                await loadProfiles(currentUser, filters, 'custom', 0);
            }
        } catch (error) {
            console.error('[Explore] Action failed:', error);
            Alert.alert('Ошибка', `Не удалось ${action === 'like' ? 'поставить лайк' : 'пропустить'}. Попробуйте ещё раз.`);
            // Don't move to next profile on error
        }
    };

    const applyFilters = () => {
        setIsLoading(true); // Trigger explicit loading for filter change
        setFilters(tempFilters);
        setShowFilters(false);
    };

    const openFilters = () => {
        setTempFilters(filters);
        setShowFilters(true);
    };



    if (isLoading) {
        return (
            <View style={[styles.container, styles.center, { backgroundColor: theme.background }]}>
                <ActivityIndicator color={theme.text} />
            </View>
        );
    }

    // EMPTY STATE
    if (profiles.length === 0) {
        return (
            <ThemedBackground>
                <View style={[styles.safeArea, { paddingTop: getPlatformPadding(insets, isMobile) }]}>
                    <StatusBar barStyle={isLight ? "dark-content" : "light-content"} />

                    <View style={[styles.center, { paddingHorizontal: 30, flex: 1, paddingBottom: 20 }]}>
                        <Ionicons name="earth-outline" size={80} color={theme.subText} />
                        <Text style={[styles.emptyText, { color: theme.text, textAlign: 'center', lineHeight: 28 }]}>
                            Мы пока не нашли подходящих людей. Попробуйте изменить фильтры или заглянуть позже!
                        </Text>

                        <Pressable style={[styles.actionBtn, { backgroundColor: isLight ? '#000' : '#fff', marginTop: 30 }]} onPress={openFilters}>
                            <Text style={[styles.actionBtnText, { color: isLight ? '#fff' : '#000' }]}>Изменить фильтры</Text>
                        </Pressable>

                        <Pressable style={[styles.actionBtn, { backgroundColor: isLight ? '#000' : '#fff', marginTop: 15 }]} onPress={() => router.push('/profile/edit')}>
                            <Text style={[styles.actionBtnText, { color: isLight ? '#fff' : '#000' }]}>Редактировать профиль</Text>
                        </Pressable>
                    </View>

                    {/* Floating Filter Button */}
                    <Pressable
                        style={[
                            styles.floatingFilterBtn,
                            { backgroundColor: '#00b894' },
                            isLight ? styles.lightShadow : styles.darkShadow,
                            { bottom: 20 }
                        ]}
                        onPress={openFilters}
                    >
                        <Ionicons name="options" size={24} color="#fff" />
                    </Pressable>

                </View>

                {renderFilterModal()}
            </ThemedBackground>
        );
    }

    const profile = profiles[currentProfileIndex];

    return (
        <ThemedBackground>
            <View style={[styles.safeArea, { paddingTop: getPlatformPadding(insets, isMobile) }]}>
                <StatusBar barStyle={isLight ? "dark-content" : "light-content"} />

                {/* 🔥 ПОЛНЫЙ ПРОСМОТР ПРОФИЛЯ */}
                <View style={{ flex: 1 }}>
                    <ProfileView userData={profile} isOwnProfile={false} bottomPadding={normalize(150)} />
                </View>

                {/* 🔥 ПЛАВАЮЩИЕ КНОПКИ ДЕЙСТВИЙ */}
                <View style={[
                    styles.floatingActions,
                    isLight ? styles.lightShadow : styles.darkShadow
                ]}>
                    <Pressable style={[styles.btn, styles.filterBtnFloating, { backgroundColor: '#00b894' }]} onPress={openFilters}>
                        <Ionicons name="options" size={22} color="#fff" />
                    </Pressable>
                    <Pressable style={[styles.btn, styles.passBtn]} onPress={() => handleAction('pass')}>
                        <Ionicons name="close" size={32} color={isLight ? "#555" : "#fff"} />
                    </Pressable>
                    <Pressable style={[styles.btn, styles.likeBtn]} onPress={() => handleAction('like')}>
                        <Ionicons name="heart" size={28} color="#E07A5F" />
                    </Pressable>
                </View>

                {/* Модалка фильтров */}
                {renderFilterModal()}

            </View>
        </ThemedBackground>
    );

    function renderFilterModal() {
        return (
            <Modal visible={showFilters} animationType="slide" transparent>
                <View style={styles.modalOverlay}>
                    <View style={[
                        styles.modalContainer,
                        { backgroundColor: theme.type === 'space' ? 'transparent' : theme.background }
                    ]}>
                        <ThemedBackground>
                            <View style={styles.modalHeader}>
                                <Text style={[styles.modalTitle, { color: theme.text }]}>Фильтры</Text>
                                <Pressable onPress={() => setShowFilters(false)} style={styles.closeBtn}>
                                    <Ionicons name="close" size={24} color={theme.text} />
                                </Pressable>
                            </View>

                            <ScrollView style={{ padding: 20 }} contentContainerStyle={{ paddingBottom: normalize(120) }}>
                                {/* ПОЛ */}
                                <Text style={[styles.filterLabel, { color: theme.text }]}>Кого искать?</Text>
                                <View style={styles.genderRow}>
                                    {(['all', 'male', 'female'] as const).map(g => (
                                        <Pressable
                                            key={g}
                                            style={[
                                                styles.genderBtn,
                                                tempFilters.gender === g && { backgroundColor: theme.accent || '#00b894', borderColor: theme.accent || '#00b894' },
                                                tempFilters.gender !== g && { borderColor: theme.border }
                                            ]}
                                            onPress={() => setTempFilters({ ...tempFilters, gender: g })}
                                        >
                                            <Text style={[
                                                styles.genderText,
                                                { color: tempFilters.gender === g ? (theme.accentText || '#fff') : theme.subText }
                                            ]}>
                                                {g === 'all' ? 'Всех' : g === 'male' ? 'Мужчин' : 'Женщин'}
                                            </Text>
                                        </Pressable>
                                    ))}
                                </View>

                                {/* ВОЗРАСТ */}
                                <Text style={[styles.filterLabel, { color: theme.text, marginTop: 20 }]}>Возраст</Text>
                                <View style={styles.ageRow}>
                                    <View style={{ flex: 1 }}>
                                        <Text style={[styles.ageLabel, { color: theme.subText }]}>От</Text>
                                        <TextInput
                                            style={[styles.ageInput, { color: theme.text, borderColor: theme.border, backgroundColor: theme.cardBg }]}
                                            value={tempFilters.minAge}
                                            onChangeText={(t: string) => setTempFilters({ ...tempFilters, minAge: t })}
                                            keyboardType="numeric"
                                            placeholder="18"
                                            placeholderTextColor={theme.subText}
                                            selectionColor={theme.selectionColor}
                                            cursorColor={theme.selectionColor}
                                        />
                                    </View>
                                    <Text style={[styles.ageSeparator, { color: theme.subText }]}>—</Text>
                                    <View style={{ flex: 1 }}>
                                        <Text style={[styles.ageLabel, { color: theme.subText }]}>До</Text>
                                        <TextInput
                                            style={[styles.ageInput, { color: theme.text, borderColor: theme.border, backgroundColor: theme.cardBg }]}
                                            value={tempFilters.maxAge}
                                            onChangeText={(t: string) => setTempFilters({ ...tempFilters, maxAge: t })}
                                            keyboardType="numeric"
                                            placeholder="50"
                                            placeholderTextColor={theme.subText}
                                            selectionColor={theme.selectionColor}
                                            cursorColor={theme.selectionColor}
                                        />
                                    </View>
                                </View>

                                {/* ЭТНОС */}
                                <Text style={[styles.filterLabel, { color: theme.text, marginTop: 20 }]}>Этническая группа</Text>
                                <View style={styles.chipContainer}>
                                    {ethnicityGroups.map(group => (
                                        <Pressable
                                            key={group.id}
                                            style={[
                                                styles.chip,
                                                { borderColor: theme.border, backgroundColor: theme.cardBg },
                                                tempFilters.ethnicity === group.id && { backgroundColor: '#00b894', borderColor: '#00b894' }
                                            ]}
                                            onPress={() => setTempFilters({ ...tempFilters, ethnicity: tempFilters.ethnicity === group.id ? '' : group.id })}
                                        >
                                            <Text style={styles.chipEmoji}>{group.emoji}</Text>
                                            <Text style={[
                                                styles.chipText,
                                                { color: tempFilters.ethnicity === group.id ? '#fff' : theme.text }
                                            ]}>
                                                {group.name}
                                            </Text>
                                        </Pressable>
                                    ))}
                                </View>

                                {/* РЕЛИГИЯ */}
                                <Text style={[styles.filterLabel, { color: theme.text, marginTop: 20 }]}>Религия</Text>
                                <View style={styles.chipContainer}>
                                    {religions.map(rel => (
                                        <Pressable
                                            key={rel.id}
                                            style={[
                                                styles.chip,
                                                { borderColor: theme.border, backgroundColor: theme.cardBg },
                                                tempFilters.religion === rel.id && { backgroundColor: '#00b894', borderColor: '#00b894' }
                                            ]}
                                            onPress={() => setTempFilters({ ...tempFilters, religion: tempFilters.religion === rel.id ? '' : rel.id })}
                                        >
                                            <Text style={styles.chipEmoji}>{rel.emoji}</Text>
                                            <Text style={[
                                                styles.chipText,
                                                { color: tempFilters.religion === rel.id ? '#fff' : theme.text }
                                            ]}>
                                                {rel.name}
                                            </Text>
                                        </Pressable>
                                    ))}
                                </View>

                                <View style={{ height: 40 }} />
                            </ScrollView>

                            <View style={[styles.modalFooter, { borderTopColor: theme.border }]}>
                                <Pressable style={[styles.applyBtn, { backgroundColor: '#00b894' }]} onPress={applyFilters}>
                                    <Text style={styles.applyBtnText}>Применить</Text>
                                </Pressable>
                            </View>
                        </ThemedBackground>
                    </View>
                </View>
            </Modal>
        );
    }
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    safeArea: { flex: 1 },
    center: { justifyContent: 'center', alignItems: 'center', gap: normalize(20) },


    modeSwitcher: {
        flexDirection: 'row',
        borderRadius: normalize(12),
        padding: normalize(4),
        alignSelf: 'flex-start',
        marginBottom: normalize(8)
    },
    modeBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: normalize(6),
        paddingHorizontal: normalize(12),
        borderRadius: normalize(8),
        gap: normalize(6)
    },
    modeText: { fontWeight: '600', fontSize: normalize(13) },
    modeDesc: { fontSize: normalize(12), marginLeft: normalize(5) },

    filterBtn: { padding: normalize(8), borderRadius: normalize(12) },

    emptyText: { fontSize: normalize(16) },

    // Actions
    actionBtn: { width: '100%', paddingVertical: normalize(15), borderRadius: normalize(12), alignItems: 'center' },
    actionBtnOutline: { width: '100%', paddingVertical: normalize(15), borderRadius: normalize(12), alignItems: 'center', borderWidth: 1 },
    actionBtnText: { fontSize: normalize(16), fontWeight: 'bold', color: '#fff' },

    // Floating Buttons
    // Floating Buttons
    floatingActions: { position: 'absolute', bottom: normalize(130), alignSelf: 'center', flexDirection: 'row', gap: normalize(20), zIndex: 100 },
    btn: { width: normalize(60), height: normalize(60), borderRadius: normalize(30), justifyContent: 'center', alignItems: 'center' },
    filterBtnFloating: { backgroundColor: '#00b894' },
    passBtn: { backgroundColor: 'rgba(255,255,255,0.1)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
    likeBtn: { backgroundColor: '#fff' },
    floatingFilterBtn: { position: 'absolute', bottom: normalize(130), right: normalize(30), width: normalize(60), height: normalize(60), borderRadius: normalize(30), justifyContent: 'center', alignItems: 'center', zIndex: 100 },
    lightShadow: { shadowColor: '#000', shadowOffset: { width: 0, height: normalize(2) }, shadowOpacity: 0.1, shadowRadius: 4 },
    darkShadow: { shadowColor: '#000', shadowOffset: { width: 0, height: normalize(2) }, shadowOpacity: 0.3, shadowRadius: 6 },

    // Modal
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    modalContainer: { height: '80%', borderTopLeftRadius: normalize(20), borderTopRightRadius: normalize(20), overflow: 'hidden' }, // Added overflow: hidden
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: normalize(20) },
    modalTitle: { fontSize: normalize(24), fontWeight: 'bold' },
    closeBtn: { padding: normalize(5) },
    modalFooter: { padding: normalize(20), borderTopWidth: 1 },

    // Filter Button
    filterButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: normalize(12),
        paddingHorizontal: normalize(20),
        borderRadius: normalize(12),
        gap: normalize(8),
        marginTop: normalize(10),
    },
    filterButtonText: {
        color: '#fff',
        fontSize: normalize(16),
        fontWeight: '600',
    },

    // Filter Elements
    filterLabel: { fontSize: normalize(16), fontWeight: '600', marginBottom: normalize(10) },
    genderRow: { flexDirection: 'row', gap: normalize(10) },
    genderBtn: { flex: 1, paddingVertical: normalize(10), borderWidth: 1, borderRadius: normalize(10), alignItems: 'center' },
    genderText: { fontWeight: '600' },

    // Age Range
    ageRow: { flexDirection: 'row', alignItems: 'center', gap: normalize(15) },
    ageLabel: { fontSize: normalize(12), marginBottom: normalize(5), fontWeight: '500' },
    ageInput: { borderWidth: 1, borderRadius: normalize(10), padding: normalize(12), fontSize: normalize(16), textAlign: 'center' },
    ageSeparator: { fontSize: normalize(20), fontWeight: '300', marginTop: normalize(20) },

    // Chips for ethnicity/religion
    chipContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: normalize(10) },
    chip: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: normalize(12),
        paddingVertical: normalize(8),
        borderRadius: normalize(12),
        borderWidth: 1,
        gap: normalize(6),
    },
    chipEmoji: { fontSize: normalize(16) },
    chipText: { fontSize: normalize(14), fontWeight: '500' },

    row: { flexDirection: 'row', alignItems: 'center' },
    input: { borderWidth: 1, borderRadius: normalize(10), padding: normalize(12), fontSize: normalize(16) },
    applyBtn: { paddingVertical: normalize(16), borderRadius: normalize(12), alignItems: 'center' },
    applyBtnText: { color: '#fff', fontSize: normalize(18), fontWeight: 'bold' }
});