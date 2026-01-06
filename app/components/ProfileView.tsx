// app/components/ProfileView.tsx
import { FontAwesome, Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    Dimensions,
    FlatList,
    Modal,
    NativeScrollEvent,
    NativeSyntheticEvent,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { Colors } from '../constants/colors';
import { useTelegram } from '../context/TelegramProvider';
import { useTheme } from '../context/ThemeContext';
import { getReligionById, getZodiacSignById } from '../utils/basic_info';

const { width } = Dimensions.get('window');

// Размеры фото (4:5)
const PHOTO_WIDTH = width - 32;
const PHOTO_HEIGHT = PHOTO_WIDTH * 1.25;

const GREEN_ACCENT = '#4ADE80';

const HOOK_COLORS = {
    bio: '#EAE2D6',
    loveLanguage: '#FFB5A7',
    familyMemory: '#B7E4C7',
    culturePride: '#F4D35E',
    stereotypeTrue: '#81B29A',
    stereotypeFalse: '#E07A5F',
    petPeeve: '#E2F0CB',
    perfectSunday: '#C7CEEA',
    dreamDinner: '#FFDAC1',
};

const ETHNICITY_MAP: Record<string, string> = {
    slavic: 'Славянские',
    asian: 'Азиатские',
    caucasian: 'Кавказские', // Fixed ID from 'caucasus' to 'caucasian'
    finno_ugric: 'Финно-угорские',
    european: 'Европейские',
    african: 'Африканские',
    latin: 'Латиноамериканские',
    arab: 'Арабские',
    jewish: 'Еврейские',
    indian: 'Индийские',
    native_american: 'Коренные американские',
    pacific: 'Тихоокеанские',
    middle_eastern: 'Ближневосточные',
    turkic: 'Тюркские',
};

interface ProfileViewProps {
    userData: any;
    isOwnProfile?: boolean;
}

export const ProfileView = ({ userData, isOwnProfile = false }: ProfileViewProps) => {
    const { themeType } = useTheme();
    const { showBackButton, hideBackButton, setBackButtonHandler } = useTelegram();
    const [currentCarouselIndex, setCurrentCarouselIndex] = useState(0);
    const [activePhotoIndex, setActivePhotoIndex] = useState(0);
    const [isFullScreenPhoto, setIsFullScreenPhoto] = useState(false);

    const isLight = themeType === 'light';
    const textColor = isLight ? '#1a1a1a' : Colors.text;
    const subTextColor = isLight ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.6)';

    // --- Хелперы ---
    const capitalizeFirst = (str: string) => {
        if (!str || typeof str !== 'string') return '';
        return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
    };

    const getFullHeritageString = () => {
        if (!userData?.macroGroups || !Array.isArray(userData.macroGroups)) return null;
        const macroNames = userData.macroGroups.map((g: string) => ETHNICITY_MAP[g] || capitalizeFirst(g));
        let rootsPart = macroNames.length > 0 ? `${macroNames.join(', ')} корни` : '';
        let nationalityPart = userData?.ethnicity ? capitalizeFirst(userData.ethnicity) : '';

        if (rootsPart && nationalityPart) return `${rootsPart} • ${nationalityPart}`;
        if (rootsPart) return rootsPart;
        if (nationalityPart) return nationalityPart;
        return null;
    };

    const getZodiacName = (id: string) => {
        try {
            // @ts-ignore
            const sign = typeof getZodiacSignById === 'function' ? getZodiacSignById(id) : null;
            return sign ? `${sign.emoji} ${sign.name}` : id;
        } catch (e) { return id; }
    };

    const getReligionName = (id: string) => {
        try {
            // @ts-ignore
            const rel = typeof getReligionById === 'function' ? getReligionById(id) : null;
            return rel ? rel.name : id;
        } catch (e) { return id; }
    };

    const getAllReligions = () => {
        if (!userData?.religions || !Array.isArray(userData.religions) || userData.religions.length === 0) return null;
        return userData.religions.map((id: string) => getReligionName(id)).join(', ');
    };

    const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
        const slideSize = event.nativeEvent.layoutMeasurement.width;
        const index = event.nativeEvent.contentOffset.x / slideSize;
        const roundIndex = Math.round(index);
        setCurrentCarouselIndex(roundIndex);
    };

    const openFullScreen = (index: number) => {
        setActivePhotoIndex(index);
        setIsFullScreenPhoto(true);
    };

    const closeFullScreen = () => {
        setIsFullScreenPhoto(false);
    };

    const router = useRouter(); // Ensure useRouter is imported from 'expo-router'

    // Manage Telegram BackButton for photo viewer
    useEffect(() => {
        if (isFullScreenPhoto) {
            setBackButtonHandler(closeFullScreen);
            showBackButton();
        } else {
            // If not in full screen mode:
            if (!isOwnProfile) {
                // If it's a foreign profile (stack navigation), we want the Back button to go back
                setBackButtonHandler(() => router.back());
                showBackButton();
            } else {
                // If it's our own profile (tab root), hide the button
                setBackButtonHandler(null);
                hideBackButton();
            }
        }
    }, [isFullScreenPhoto, isOwnProfile]);

    const handleNextPhotoLightbox = () => {
        if (userData?.photos && Array.isArray(userData.photos)) {
            setActivePhotoIndex((prev) => (prev + 1) % userData.photos.length);
        }
    };
    const handlePrevPhotoLightbox = () => {
        if (userData?.photos && Array.isArray(userData.photos)) {
            setActivePhotoIndex((prev) => (prev - 1 + userData.photos.length) % userData.photos.length);
        }
    };

    const photos = Array.isArray(userData?.photos) ? userData.photos : [];

    // --- HookItem ---
    const HookItem = ({ title, text, color, icon }: any) => {
        const containerStyle = isLight
            ? { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e5e5e5' }
            : {
                backgroundColor: themeType === 'space' ? 'rgba(18, 22, 40, 0.9)' : 'rgba(20, 20, 20, 0.7)',
                borderWidth: 1,
                borderColor: 'rgba(255,255,255,0.08)'
            };

        const titleColor = isLight ? '#222' : color;
        const textColorHook = isLight ? '#333' : '#f4f4f5';
        const iconBg = isLight ? color + '30' : color + '20';

        return (
            <View style={[styles.hookContainer, containerStyle]}>
                <View style={styles.hookHeader}>
                    <View style={[styles.iconCircle, { backgroundColor: iconBg }]}>
                        <Ionicons name={icon} size={16} color={color} />
                    </View>
                    <Text style={[styles.hookTitle, { color: titleColor }]}>{title}</Text>
                </View>
                <Text style={[styles.hookText, { color: textColorHook }]}>{text}</Text>
            </View>
        );
    };

    const PhotoPlaceholder = () => (
        <View style={[styles.photoPlaceholder, isLight && { backgroundColor: '#e5e5e5', borderColor: '#ccc' }]}>
            <Ionicons name="image-outline" size={50} color={isLight ? "#999" : "rgba(255,255,255,0.2)"} />
            <Text style={[styles.placeholderText, isLight && { color: '#666' }]}>Нет фото</Text>
        </View>
    );

    return (
        <>
            <ScrollView
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                {/* КАРУСЕЛЬ */}
                <View style={styles.carouselContainer}>
                    {photos.length > 0 ? (
                        <>
                            <FlatList
                                data={photos}
                                horizontal
                                pagingEnabled
                                showsHorizontalScrollIndicator={false}
                                onScroll={handleScroll}
                                keyExtractor={(_, i) => i.toString()}
                                renderItem={({ item, index }) => (
                                    <TouchableOpacity
                                        activeOpacity={0.95}
                                        onPress={() => openFullScreen(index)}
                                        style={styles.photoSlide}
                                    >
                                        <Image
                                            source={{ uri: item }}
                                            style={styles.photoImage}
                                            contentFit="cover"
                                            onError={(e) => console.log('Carousel Image Load Error:', e.error || e)}
                                        />
                                    </TouchableOpacity>
                                )}
                            />

                            {photos.length > 1 && (
                                <View style={styles.dotsContainer}>
                                    {photos.map((_: any, index: number) => (
                                        <View
                                            key={index}
                                            style={[
                                                styles.dot,
                                                currentCarouselIndex === index ? styles.dotActive : { backgroundColor: isLight ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.2)' },
                                                currentCarouselIndex === index && isLight && { backgroundColor: '#000' }
                                            ]}
                                        />
                                    ))}
                                </View>
                            )}
                        </>
                    ) : (
                        <PhotoPlaceholder />
                    )}
                </View>

                {/* ИНФО */}
                <View style={styles.infoBlock}>
                    <View style={styles.nameRow}>
                        <Text style={[styles.nameText, { color: textColor }]}>
                            {userData?.name}, {userData?.age}
                        </Text>
                    </View>

                    {getFullHeritageString() && (
                        <Text style={[styles.rootsText, { color: GREEN_ACCENT }]}>
                            {getFullHeritageString()}
                        </Text>
                    )}

                    <View style={styles.statusRow}>
                        <Text style={[styles.statusText, { color: subTextColor }]}>
                            {userData?.gender === 'female' ? 'Женщина' : 'Мужчина'}
                        </Text>
                        <View style={[styles.statusDot, { backgroundColor: subTextColor }]} />
                        <Text style={[styles.statusText, { color: subTextColor }]}>
                            {getZodiacName(userData?.zodiac || '')}
                        </Text>
                        {getAllReligions() && (
                            <>
                                <View style={[styles.statusDot, { backgroundColor: subTextColor }]} />
                                <Text style={[styles.statusText, { color: subTextColor }]}>
                                    {getAllReligions()}
                                </Text>
                            </>
                        )}
                        {/* 4. ГОРОД */}
                        {userData?.city && (
                            <>
                                <View style={[styles.statusDot, { backgroundColor: subTextColor }]} />
                                <Text style={[styles.statusText, { color: subTextColor }]}>
                                    {userData.city}
                                </Text>
                            </>
                        )}
                    </View>

                    {/* СОЦСЕТИ */}
                    {(userData?.socialTelegram || userData?.socialVk || userData?.socialInstagram) && (
                        <View style={styles.socialStack}>
                            {userData.socialTelegram ? (
                                <View style={styles.socialItem}>
                                    <Ionicons name="paper-plane" size={16} color={isLight ? '#229ED9' : '#2AABEE'} />
                                    <Text style={[styles.socialText, { color: textColor }]}>
                                        {userData.socialTelegram}
                                    </Text>
                                </View>
                            ) : null}
                            {userData.socialVk ? (
                                <View style={styles.socialItem}>
                                    <FontAwesome name="vk" size={16} color={isLight ? '#0077FF' : '#4a8eff'} />
                                    <Text style={[styles.socialText, { color: textColor }]}>
                                        {userData.socialVk}
                                    </Text>
                                </View>
                            ) : null}
                            {userData.socialInstagram ? (
                                <View style={styles.socialItem}>
                                    <Ionicons name="logo-instagram" size={16} color={isLight ? '#E1306C' : '#E4405F'} />
                                    <Text style={[styles.socialText, { color: textColor }]}>
                                        {userData.socialInstagram}
                                    </Text>
                                </View>
                            ) : null}
                        </View>
                    )}
                </View>

                <View style={[styles.divider, { backgroundColor: isLight ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.1)' }]} />

                {/* ХУКИ */}
                <View style={styles.hooksContainer}>
                    {(userData?.bio || userData?.about) && <HookItem title="ОБО МНЕ" text={userData.bio || userData.about} color={HOOK_COLORS.bio} icon="person" />}
                    {(userData?.loveLanguage || userData?.love_language) && <HookItem title="МОЙ ЯЗЫК ЛЮБВИ" text={userData.loveLanguage || userData.love_language} color={HOOK_COLORS.loveLanguage} icon="heart" />}
                    {(userData?.familyMemory || userData?.family_memory) && <HookItem title="МОЕ ЛЮБИМОЕ ВОСПОМИНАНИЕ" text={userData.familyMemory || userData.family_memory} color={HOOK_COLORS.familyMemory} icon="book" />}
                    {(userData?.culturePride || userData?.culture_pride) && <HookItem title="ЧЕМ Я ГОРЖУСЬ В СВОЕЙ КУЛЬТУРЕ" text={userData.culturePride || userData.culture_pride} color={HOOK_COLORS.culturePride} icon="ribbon" />}
                    {(userData?.stereotypeTrue || userData?.stereotype_true) && <HookItem title="ЧТО ДЛЯ ТЕБЯ ЗНАЧИТ НАСТОЯЩАЯ БЛИЗОСТЬ?" text={userData.stereotypeTrue || userData.stereotype_true} color={HOOK_COLORS.stereotypeTrue} icon="heart" />}
                    {(userData?.stereotypeFalse || userData?.stereotype_false) && <HookItem title="ЧЕМ ТЫ ЗАНИМАЕШЬСЯ, КОГДА ХОЧЕШЬ ПЕРЕЗАГРУЗИТЬСЯ?" text={userData.stereotypeFalse || userData.stereotype_false} color={HOOK_COLORS.stereotypeFalse} icon="refresh" />}

                    {/* Остальные хуки */}
                </View>

                {/* ИНТЕРЕСЫ */}
                {userData?.interests && Array.isArray(userData.interests) && userData.interests.length > 0 && (
                    <View style={styles.sectionContainer}>
                        <Text style={[styles.sectionTitle, { color: subTextColor }]}>Интересы</Text>
                        <View style={styles.interestsCloud}>
                            {userData.interests.map((item: string, i: number) => (
                                <View
                                    key={i}
                                    style={[
                                        styles.tagBox,
                                        isLight && { backgroundColor: '#fff', borderWidth: 1, borderColor: '#ccc' },
                                        themeType === 'space' && { backgroundColor: 'rgba(18, 22, 40, 0.9)' }
                                    ]}
                                >
                                    <Text style={[styles.tagText, isLight && { color: '#333' }]}>{item}</Text>
                                </View>
                            ))}
                        </View>
                    </View>
                )}

                <View style={{ height: 120 }} />
            </ScrollView>

            {/* ЛАЙТБОКС */}
            <Modal
                visible={isFullScreenPhoto}
                transparent={true}
                animationType="fade"
                onRequestClose={closeFullScreen}
            >
                <View style={styles.lightboxContainer}>
                    {/* Telegram BackButton handles closing */}

                    {userData?.photos && userData.photos.length > 0 && (
                        <Pressable style={styles.lightboxImageContainer} onPress={handleNextPhotoLightbox}>
                            <Image
                                source={{ uri: userData.photos[activePhotoIndex] }}
                                style={styles.lightboxImage}
                                contentFit="contain"
                                onError={(e) => console.log('Lightbox Image Load Error:', e.error || e)}
                            />
                        </Pressable>
                    )}

                    {userData?.photos && userData.photos.length > 1 && (
                        <>
                            <TouchableOpacity style={styles.navArrowLeft} onPress={handlePrevPhotoLightbox} hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}>
                                <Ionicons name="chevron-back" size={50} color="rgba(255,255,255,0.7)" />
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.navArrowRight} onPress={handleNextPhotoLightbox} hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}>
                                <Ionicons name="chevron-forward" size={50} color="rgba(255,255,255,0.7)" />
                            </TouchableOpacity>
                        </>
                    )}
                </View>
            </Modal>
        </>
    );
};

const styles = StyleSheet.create({
    scrollContent: { paddingBottom: 100, alignItems: 'center' },

    // --- ФОТО ---
    carouselContainer: {
        height: PHOTO_HEIGHT,
        marginTop: 10,
        marginBottom: 20,
        width: PHOTO_WIDTH,
    },
    photoSlide: {
        width: PHOTO_WIDTH,
        height: PHOTO_HEIGHT,
        marginHorizontal: 0,
        borderRadius: 24,
        overflow: 'hidden',
        backgroundColor: '#1c1c1e',
        shadowColor: "#000", shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.5, shadowRadius: 15, elevation: 10,
    },
    photoImage: { width: '100%', height: '100%', resizeMode: 'cover' },

    photoPlaceholder: {
        width: PHOTO_WIDTH,
        height: PHOTO_HEIGHT,
        borderRadius: 24,
        backgroundColor: '#1c1c1e',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    placeholderText: {
        color: 'rgba(255,255,255,0.4)',
        fontSize: 16,
        marginTop: 10,
        fontWeight: '500',
    },

    dotsContainer: {
        flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 12, gap: 6
    },
    dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.2)' },
    dotActive: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#fff' },

    // --- ИНФО ---
    infoBlock: { width: '100%', paddingHorizontal: 20, alignItems: 'flex-start', marginBottom: 20 },
    nameRow: { flexDirection: 'row', alignItems: 'center' },
    nameText: { fontSize: 28, fontWeight: 'bold' },

    rootsText: { fontSize: 15, fontWeight: '600', marginTop: 4, marginBottom: 12 },

    statusRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
    statusText: { fontSize: 15, fontWeight: '400' },
    statusDot: { width: 3, height: 3, borderRadius: 1.5, marginHorizontal: 8 },

    socialStack: { flexDirection: 'column', gap: 6, marginTop: 12 },
    socialItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    socialText: { fontSize: 14, fontWeight: '500' },

    divider: { width: width - 40, height: 1, marginBottom: 25 },

    // --- HOOKS ---
    hooksContainer: { width: '100%', paddingHorizontal: 20, gap: 20, marginBottom: 30 },
    hookContainer: {
        borderRadius: 16,
        padding: 16,
    },
    hookHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
    iconCircle: { width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
    hookTitle: { fontSize: 11, fontWeight: 'bold', letterSpacing: 0.5, textTransform: 'uppercase', flex: 1, lineHeight: 16 },
    hookText: { fontSize: 16, lineHeight: 24 },

    // --- INTERESTS ---
    sectionContainer: { width: '100%', paddingHorizontal: 20, marginBottom: 30 },
    sectionTitle: { fontSize: 12, fontWeight: 'bold', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 1 },
    interestsCloud: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    tagBox: {
        backgroundColor: 'rgba(255,255,255,0.08)',
        paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    },
    tagText: { color: '#e4e4e7', fontSize: 14, fontWeight: '500' },

    // --- LIGHTBOX ---
    lightboxContainer: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'center', alignItems: 'center' },
    lightboxImageContainer: { width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' },
    lightboxImage: { width: '100%', height: '100%' },
    navArrowLeft: { position: 'absolute', left: 0, top: '40%', bottom: '40%', width: 60, justifyContent: 'center', alignItems: 'center', zIndex: 50 },
    navArrowRight: { position: 'absolute', right: 0, top: '40%', bottom: '40%', width: 60, justifyContent: 'center', alignItems: 'center', zIndex: 50 },
});
