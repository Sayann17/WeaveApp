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
import { useTheme } from '../context/ThemeContext';
import { enhancedMatchService } from '../services/head_match';
import { religions } from '../utils/basic_info';
import { ethnicityGroups } from '../utils/ethnicities';

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

import { yandexAuth } from '../services/yandex/AuthService';
import { YandexUserService } from '../services/yandex/UserService';

const userService = new YandexUserService();

export default function ExploreScreen() {
    const router = useRouter();
    const { theme, themeType } = useTheme();
    const insets = useSafeAreaInsets();

    // Data States
    const [currentUser, setCurrentUser] = useState<any>(null);
    const [profiles, setProfiles] = useState<UserProfile[]>([]);
    const [currentProfileIndex, setCurrentProfileIndex] = useState(0);
    const [isLoading, setIsLoading] = useState(true);

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

    useFocusEffect(
        useCallback(() => {
            loadData();
        }, [filters]) // Reload when filters change
    );

    const loadData = async () => {
        setIsLoading(true);
        try {
            const userData = await userService.getCurrentUser();
            if (userData) {
                setCurrentUser(userData);
                // Set default gender filter on first load
                if (filters.gender === 'all') {
                    const defaultGender = userData.gender === 'male' ? 'female' : userData.gender === 'female' ? 'male' : 'all';
                    setFilters(prev => ({ ...prev, gender: defaultGender }));
                    setTempFilters(prev => ({ ...prev, gender: defaultGender }));
                }
                await loadProfiles(userData, filters, 'smart'); // Always use smart mode
            }
        } catch (error) {
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    };

    const loadProfiles = async (currentUserData: any, currentFilters: Filters, mode: 'smart' | 'custom') => {
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
            const matches = await userService.getPotentialMatches(currentUserId, {
                minAge,
                maxAge,
                gender: targetGender,
                ethnicity: targetEth,
                religion: targetRel
            });

            // Cultural Sort
            const ranked = enhancedMatchService.sortProfilesByCulturalScore(currentUserData, matches);
            setProfiles(ranked);
            setCurrentProfileIndex(0);

        } catch (error) {
            console.error(error);
        }
    };

    const handleAction = async (action: 'like' | 'pass') => {
        if (profiles.length === 0) return;
        const profile = profiles[currentProfileIndex];

        if (action === 'pass') {
            await enhancedMatchService.dislikeUser(profile.id);
        } else {
            const res = await enhancedMatchService.likeUser(profile.id);
            if (res.type === 'match') {
                Alert.alert('Мэтч!', `Вы понравились ${profile.name}!`);
            }
        }

        if (currentProfileIndex < profiles.length - 1) {
            setCurrentProfileIndex(prev => prev + 1);
        } else {
            setProfiles([]);
        }
    };

    const applyFilters = () => {
        setFilters(tempFilters);
        setShowFilters(false);
        loadData(); // Reload with new filters
    };

    const openFilters = () => {
        setTempFilters(filters);
        setShowFilters(true);
    };

    const isLight = themeType === 'light';

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
                <View style={[styles.safeArea, { paddingTop: insets.top + 85 }]}>
                    <StatusBar barStyle={isLight ? "dark-content" : "light-content"} />

                    <View style={[styles.center, { paddingHorizontal: 30, flex: 1, paddingBottom: 100 }]}>
                        <Ionicons name="earth-outline" size={80} color={theme.subText} />
                        <Text style={[styles.emptyText, { color: theme.text, textAlign: 'center', lineHeight: 28 }]}>
                            Мы пока не нашли подходящих людей. Попробуйте изменить фильтры или заглянуть позже!
                        </Text>

                        <Pressable style={[styles.actionBtn, { backgroundColor: '#00b894', marginTop: 30 }]} onPress={openFilters}>
                            <Text style={styles.actionBtnText}>Изменить фильтры</Text>
                        </Pressable>

                        <Pressable style={[styles.actionBtnOutline, { borderColor: '#00b894', marginTop: 15 }]} onPress={() => router.push('/(tabs)/profile')}>
                            <Text style={[styles.actionBtnText, { color: '#00b894' }]}>Редактировать профиль</Text>
                        </Pressable>
                    </View>

                    {/* Floating Filter Button */}
                    <Pressable
                        style={[styles.floatingFilterBtn, { backgroundColor: '#00b894' }, isLight ? styles.lightShadow : styles.darkShadow]}
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
            <View style={[styles.safeArea, { paddingTop: insets.top + 78 }]}>
                <StatusBar barStyle={isLight ? "dark-content" : "light-content"} />

                {/* 🔥 ПОЛНЫЙ ПРОСМОТР ПРОФИЛЯ */}
                <View style={{ flex: 1 }}>
                    <ProfileView userData={profile} isOwnProfile={false} />
                </View>

                {/* 🔥 ПЛАВАЮЩИЕ КНОПКИ ДЕЙСТВИЙ */}
                <View style={[styles.floatingActions, isLight ? styles.lightShadow : styles.darkShadow]}>
                    <Pressable style={[styles.btn, styles.filterBtnFloating, { backgroundColor: '#00b894' }]} onPress={openFilters}>
                        <Ionicons name="options" size={22} color="#fff" />
                    </Pressable>
                    <Pressable style={[styles.btn, styles.passBtn]} onPress={() => handleAction('pass')}>
                        <Ionicons name="arrow-redo" size={26} color={isLight ? "#555" : "#fff"} />
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
                    <View style={[styles.modalContainer, { backgroundColor: theme.background }]}>
                        <View style={styles.modalHeader}>
                            <Text style={[styles.modalTitle, { color: theme.text }]}>Фильтры</Text>
                            <Pressable onPress={() => setShowFilters(false)} style={styles.closeBtn}>
                                <Ionicons name="close" size={24} color={theme.text} />
                            </Pressable>
                        </View>

                        <ScrollView style={{ padding: 20 }}>
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
                                            { color: tempFilters.gender === g ? '#fff' : theme.subText }
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
                    </View>
                </View>
            </Modal>
        );
    }
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    safeArea: { flex: 1 },
    center: { justifyContent: 'center', alignItems: 'center', gap: 20 },


    modeSwitcher: {
        flexDirection: 'row',
        borderRadius: 12,
        padding: 4,
        alignSelf: 'flex-start',
        marginBottom: 8
    },
    modeBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 8,
        gap: 6
    },
    modeText: { fontWeight: '600', fontSize: 13 },
    modeDesc: { fontSize: 12, marginLeft: 5 },

    filterBtn: { padding: 8, borderRadius: 12 },

    emptyText: { fontSize: 16 },

    // Actions
    actionBtn: { width: '100%', paddingVertical: 15, borderRadius: 12, alignItems: 'center' },
    actionBtnOutline: { width: '100%', paddingVertical: 15, borderRadius: 12, alignItems: 'center', borderWidth: 1 },
    actionBtnText: { fontSize: 16, fontWeight: 'bold', color: '#fff' },

    // Floating Buttons
    floatingActions: { position: 'absolute', bottom: 30, alignSelf: 'center', flexDirection: 'row', gap: 20, zIndex: 100 },
    btn: { width: 60, height: 60, borderRadius: 30, justifyContent: 'center', alignItems: 'center' },
    filterBtnFloating: { backgroundColor: '#00b894' },
    passBtn: { backgroundColor: 'rgba(255,255,255,0.1)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
    likeBtn: { backgroundColor: '#fff' },
    floatingFilterBtn: { position: 'absolute', bottom: 30, right: 30, width: 60, height: 60, borderRadius: 30, justifyContent: 'center', alignItems: 'center', zIndex: 100 },
    lightShadow: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4 },
    darkShadow: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 6 },

    // Modal
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    modalContainer: { height: '80%', borderTopLeftRadius: 20, borderTopRightRadius: 20 },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20 },
    modalTitle: { fontSize: 24, fontWeight: 'bold' },
    closeBtn: { padding: 5 },
    modalFooter: { padding: 20, borderTopWidth: 1 },

    // Filter Button
    filterButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 20,
        borderRadius: 12,
        gap: 8,
        marginTop: 10,
    },
    filterButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },

    // Filter Elements
    filterLabel: { fontSize: 16, fontWeight: '600', marginBottom: 10 },
    genderRow: { flexDirection: 'row', gap: 10 },
    genderBtn: { flex: 1, paddingVertical: 10, borderWidth: 1, borderRadius: 10, alignItems: 'center' },
    genderText: { fontWeight: '600' },

    // Age Range
    ageRow: { flexDirection: 'row', alignItems: 'center', gap: 15 },
    ageLabel: { fontSize: 12, marginBottom: 5, fontWeight: '500' },
    ageInput: { borderWidth: 1, borderRadius: 10, padding: 12, fontSize: 16, textAlign: 'center' },
    ageSeparator: { fontSize: 20, fontWeight: '300', marginTop: 20 },

    // Chips for ethnicity/religion
    chipContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    chip: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 12,
        borderWidth: 1,
        gap: 6,
    },
    chipEmoji: { fontSize: 16 },
    chipText: { fontSize: 14, fontWeight: '500' },

    row: { flexDirection: 'row', alignItems: 'center' },
    input: { borderWidth: 1, borderRadius: 10, padding: 12, fontSize: 16 },
    applyBtn: { paddingVertical: 16, borderRadius: 12, alignItems: 'center' },
    applyBtnText: { color: '#fff', fontSize: 18, fontWeight: 'bold' }
});