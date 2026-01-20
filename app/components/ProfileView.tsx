// app/components/ProfileView.tsx
import { FontAwesome, Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    Alert,
    Dimensions,
    FlatList,
    Modal,
    NativeScrollEvent,
    NativeSyntheticEvent,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { Colors } from '../constants/colors';
import { useTelegram } from '../context/TelegramProvider';
import { useTheme } from '../context/ThemeContext';
import { eventService } from '../services/EventService';
import { yandexAuth } from '../services/yandex/AuthService';
import { getReligionById, getZodiacSignById } from '../utils/basic_info';
import { normalize } from '../utils/normalize';

const ADMIN_ID = 'bf7ed056-a8e2-4f5f-9ed8-b9cbccfadc7c';

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
    caucasian: 'Кавказские',
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
    indo_european: 'Индоевропейские корни',
    world_citizen: 'Человек мира',
};

interface ProfileViewProps {
    userData: any;
    isOwnProfile?: boolean;
    isMatch?: boolean; // Is this user a match (mutual like)?
}

export const ProfileView = ({ userData, isOwnProfile = false, isMatch = false, bottomPadding = normalize(120) }: ProfileViewProps & { bottomPadding?: number }) => {
    const { theme, themeType } = useTheme();
    const { showBackButton, hideBackButton, setBackButtonHandler, isMobile, isDesktop, isWeb } = useTelegram();
    const [currentCarouselIndex, setCurrentCarouselIndex] = useState(0);
    const [eventSlideIndex, setEventSlideIndex] = useState(0); // For user events carousel
    const [localEvents, setLocalEvents] = useState<any[]>(userData?.events || []);

    useEffect(() => {
        if (userData?.events) {
            setLocalEvents(userData.events);
        }
    }, [userData]);

    const handleAttendEvent = async (eventId: string) => {
        const currentEvent = localEvents.find(e => e.id === eventId);
        const newIsGoing = !currentEvent?.isGoing;

        setLocalEvents(prev => prev.map(e => e.id === eventId ? { ...e, isGoing: newIsGoing } : e));

        // Only allow attending if it's own profile? Or if it's a social feature?
        // Assuming user can attend events seen on other profiles too if they are public events.
        const success = await eventService.attendEvent(eventId);
        if (!success) {
            setLocalEvents(prev => prev.map(e => e.id === eventId ? { ...e, isGoing: !newIsGoing } : e));
        }
    };

    const [activePhotoIndex, setActivePhotoIndex] = useState(0);
    const [isFullScreenPhoto, setIsFullScreenPhoto] = useState(false);
    const [showBanModal, setShowBanModal] = useState(false);
    const [banReason, setBanReason] = useState('');

    // Check dynamic admin flag
    const isAdmin = yandexAuth.user?.is_admin === true;

    const handleBanUser = async () => {
        if (!banReason.trim()) {
            Alert.alert('Ошибка', 'Укажите причину бана');
            return;
        }

        try {
            // Call API
            const response = await fetch(`https://d5dg37j92h7tg2f7sf87.o2p3jdjj.apigw.yandexcloud.net/admin/ban`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${await yandexAuth.getToken()}`
                },
                body: JSON.stringify({ userId: userData.uid || userData.id, reason: banReason })
            });

            if (response.ok) {
                Alert.alert('Успех', 'Пользователь забанен');
                setShowBanModal(false);
                if (router.canGoBack()) router.back();
            } else {
                Alert.alert('Ошибка', 'Не удалось забанить пользователя');
            }
        } catch (e) {
            Alert.alert('Ошибка', 'Произошла ошибка при бане');
        }
    };


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

        const groups = [...userData.macroGroups];
        const worldCitizenIndex = groups.indexOf('world_citizen');
        let worldCitizenPart = '';

        if (worldCitizenIndex !== -1) {
            worldCitizenPart = 'Человек мира';
            groups.splice(worldCitizenIndex, 1);
        }

        const macroNames = groups.map((g: string) => ETHNICITY_MAP[g] || capitalizeFirst(g));
        let otherRootsPart = macroNames.length > 0 ? `${macroNames.join(', ')} корни` : '';

        // Combine: Человек мира, [Остальные] корни
        let rootsPart = [worldCitizenPart, otherRootsPart].filter(Boolean).join(', ');

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
        // Allow fullscreen on mobile devices (Telegram Mobile App or Native App)
        // Block on Desktop and Web versions of Telegram
        if (isMobile || Platform.OS === 'ios' || Platform.OS === 'android') {
            setActivePhotoIndex(index);
            setIsFullScreenPhoto(true);
        }
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
        // Wine theme: sophisticated design with wine-toned accents
        const isWineTheme = themeType === 'wine';

        const containerStyle = isLight
            ? { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e5e5e5' }
            : isWineTheme
                ? {
                    backgroundColor: 'rgba(79, 17, 28, 0.65)', // Wine color with above-medium transparency
                    borderWidth: 1.5,
                    borderColor: 'rgba(139, 111, 71, 0.3)', // Wine-toned border
                    shadowColor: '#4a0e1c',
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.15,
                    shadowRadius: 12,
                    elevation: 6,
                }
                : {
                    backgroundColor: theme.cardBg,
                    borderWidth: 1,
                    borderColor: theme.border
                };

        // Wine theme: revert to original styling for icons and titles
        const wineAccentColor = '#8B6F47';
        const peachyAccent = '#fbdac9'; // Peachy accent for Passion theme
        const titleColor = isLight ? '#222' : (isWineTheme ? peachyAccent : color); // Peachy for wine theme
        const textColorHook = isLight ? '#333' : (isWineTheme ? '#ffffff' : '#f4f4f5');
        const iconColor = isWineTheme ? peachyAccent : color; // Peachy for wine theme
        const iconBg = isLight
            ? color + '30'
            : color + '20'; // Original: no special wine handling

        return (
            <View style={[
                styles.hookContainer,
                containerStyle,
                isWineTheme && {
                    paddingHorizontal: normalize(20),
                    paddingVertical: normalize(18),
                    borderRadius: normalize(20),
                }
            ]}>
                <View style={styles.hookHeader}>
                    <View style={[
                        styles.iconCircle,
                        { backgroundColor: iconBg },
                    ]}>
                        <Ionicons
                            name={icon}
                            size={16}
                            color={iconColor}
                        />
                    </View>
                    <Text style={[
                        styles.hookTitle,
                        { color: titleColor },
                    ]}>{title}</Text>
                </View>
                <Text style={[
                    styles.hookText,
                    { color: textColorHook },
                    isWineTheme && {
                        fontSize: normalize(15.5),
                        lineHeight: normalize(23),
                        fontWeight: '400',
                        letterSpacing: 0.2,
                    }
                ]}>{text}</Text>
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
                contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomPadding }]}
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
                        {/* ADMIN BAN BUTTON */}
                        {isAdmin && !isOwnProfile && (
                            <TouchableOpacity
                                onPress={() => setShowBanModal(true)}
                                style={{ marginLeft: 10, padding: 5 }}
                            >
                                <Ionicons name="shield-half" size={24} color="#FF3B30" />
                            </TouchableOpacity>
                        )}
                    </View>


                    {getFullHeritageString() && (
                        <Text style={[styles.rootsText, { color: themeType === 'wine' ? '#fbdac9' : GREEN_ACCENT }]}>
                            {getFullHeritageString()}
                        </Text>
                    )}

                    {/* Vitals Color Logic */}
                    {(() => {
                        const vitalsColor = isLight ? subTextColor : (themeType === 'wine' ? '#ffffff' : '#E2E8F0');
                        return (
                            <View style={styles.statusRow}>
                                <Text style={[styles.statusText, { color: vitalsColor }]}>
                                    {userData?.gender === 'female' ? 'Женщина' : 'Мужчина'}
                                </Text>
                                <View style={[styles.statusDot, { backgroundColor: vitalsColor }]} />
                                <Text style={[styles.statusText, { color: vitalsColor }]}>
                                    {getZodiacName(userData?.zodiac || '')}
                                </Text>
                                {getAllReligions() && (
                                    <>
                                        <View style={[styles.statusDot, { backgroundColor: vitalsColor }]} />
                                        <Text style={[styles.statusText, { color: vitalsColor }]}>
                                            {getAllReligions()}
                                        </Text>
                                    </>
                                )}
                                {/* 4. ГОРОД */}
                                {userData?.city && (
                                    <>
                                        <View style={[styles.statusDot, { backgroundColor: vitalsColor }]} />
                                        <Text style={[styles.statusText, { color: vitalsColor }]}>
                                            {userData.city}
                                        </Text>
                                    </>
                                )}
                            </View>
                        );
                    })()}

                    {/* СОЦСЕТИ - только для матчей или своего профиля */}
                    {(isOwnProfile || isMatch) && (userData?.socialTelegram || userData?.socialVk || userData?.socialInstagram) && (
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

                {/* EVENTS */}
                {/* EVENTS */}
                {localEvents && Array.isArray(localEvents) && localEvents.length > 0 && (
                    <View style={styles.sectionContainer}>
                        <Text style={[styles.sectionTitle, { color: subTextColor, marginBottom: 15 }]}>Мои события</Text>

                        {/* Custom Mini Carousel */}
                        <View>
                            <FlatList
                                data={localEvents}
                                horizontal
                                pagingEnabled
                                showsHorizontalScrollIndicator={false}
                                snapToAlignment="center"
                                snapToInterval={width - 40} // Full width minus padding? Or card width?
                                // Original design was a list of rows. 
                                // "Simply add possibility to swipe left right".
                                // So one card per "slide"? 
                                // "Сами карточки должны были остаться... просто добавить возможность свайпать".
                                // So Horizontal FlatList where each item is width = screenWidth - padding.
                                decelerationRate="fast"
                                contentContainerStyle={{ gap: 10 }} // Gap doesn't work well with pagingEnabled on old RN sometimes, but usually fine.
                                // If pagingEnabled, gap messes up calculation.
                                // Better to handle padding in renderItem.
                                keyExtractor={(item, index) => item.id || index.toString()}
                                renderItem={({ item }) => {
                                    let imageSource = null;
                                    if (item.imageKey === 'uzor_love') imageSource = require('../../assets/images/events/uzor_love.jpg');
                                    else if (item.imageKey === 'tuva_culture') imageSource = require('../../assets/images/events/tuva_culture.jpg');

                                    const eventContainerStyle = isLight
                                        ? { backgroundColor: '#fff', borderWidth: 1, borderColor: '#eee' }
                                        : {
                                            backgroundColor: themeType === 'space' ? 'rgba(255,255,255,0.08)' : theme.cardBg,
                                            borderWidth: 1,
                                            borderColor: themeType === 'space' ? 'transparent' : theme.border
                                        };

                                    return (
                                        <View style={[{
                                            width: width - 40, // Full width of container
                                            flexDirection: 'row',
                                            padding: 10,
                                            borderRadius: 20,
                                            alignItems: 'center',
                                            marginRight: 0 // No margin if paging
                                        }, eventContainerStyle]}>
                                            <View style={{
                                                width: 60, height: 60, borderRadius: 12,
                                                overflow: 'hidden', backgroundColor: '#eee', marginRight: 14
                                            }}>
                                                {imageSource ? (
                                                    <Image source={imageSource} style={{ width: '100%', height: '100%' }} contentFit="cover" />
                                                ) : (
                                                    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.primary }}>
                                                        <Ionicons name="calendar" size={24} color="white" />
                                                    </View>
                                                )}
                                            </View>

                                            <View style={{ flex: 1, paddingRight: 8 }}>
                                                <Text style={{
                                                    color: isLight ? '#1a1a1a' : '#E2E8F0',
                                                    fontWeight: '700', fontSize: 16, marginBottom: 4, letterSpacing: -0.5
                                                }} numberOfLines={1}>{item.title}</Text>
                                                <Text style={{ color: subTextColor, fontSize: 14, fontWeight: '500' }}>
                                                    {item.date ? new Date(item.date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' }) : 'Дата уточняется'}
                                                </Text>
                                            </View>
                                        </View>
                                    );
                                }}
                                // We need onScroll to update dots
                                onScroll={(e) => {
                                    const x = e.nativeEvent.contentOffset.x;
                                    const index = Math.round(x / (width - 40));
                                    setEventSlideIndex(index);
                                }}
                                scrollEventThrottle={16}
                            />
                        </View>

                        {/* Dots for Events */}
                        {localEvents.length > 1 && (
                            <View style={[
                                styles.dotsContainer,
                                {
                                    marginTop: 15,
                                    alignSelf: 'center',
                                    paddingHorizontal: 12,
                                    paddingVertical: 8,
                                    borderRadius: 20,
                                    backgroundColor: isLight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.1)'
                                }
                            ]}>
                                {Array.from({ length: Math.min(localEvents.length, 3) }).map((_, i) => {
                                    // Logic for 3 dots max
                                    let activeDot = 0;
                                    if (localEvents.length <= 3) activeDot = eventSlideIndex;
                                    else {
                                        if (eventSlideIndex === 0) activeDot = 0;
                                        else if (eventSlideIndex === localEvents.length - 1) activeDot = 2; // Last visual dot
                                        else activeDot = 1; // Middle
                                    }

                                    // Visual styling
                                    const isActive = i === activeDot;
                                    const dotColor = isActive
                                        ? (isLight ? '#000' : '#FFF')
                                        : '#888';

                                    return (
                                        <View
                                            key={i}
                                            style={{
                                                width: 6, height: 6, borderRadius: 3,
                                                backgroundColor: dotColor,
                                                marginHorizontal: 3
                                            }}
                                        />
                                    )
                                })}
                            </View>
                        )}

                        <View style={{ height: 10 }} />
                    </View>
                )}

                <View style={[styles.divider, { backgroundColor: isLight ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.1)' }]} />

                {/* ХУКИ */}
                <View style={styles.hooksContainer}>
                    {(userData?.bio || userData?.about) && <HookItem title="ОБО МНЕ" text={userData.bio || userData.about} color={themeType === 'wine' ? '#efc2a3' : HOOK_COLORS.bio} icon="person" />}
                    {(userData?.loveLanguage || userData?.love_language) && <HookItem title="МОЙ ЯЗЫК ЛЮБВИ" text={userData.loveLanguage || userData.love_language} color={themeType === 'wine' ? '#efc2a3' : HOOK_COLORS.loveLanguage} icon="heart" />}
                    {(userData?.familyMemory || userData?.family_memory) && <HookItem title="МОЕ ЛЮБИМОЕ ВОСПОМИНАНИЕ" text={userData.familyMemory || userData.family_memory} color={themeType === 'wine' ? '#efc2a3' : HOOK_COLORS.familyMemory} icon="book" />}
                    {(userData?.culturePride || userData?.culture_pride) && <HookItem title="ЧЕМ Я ГОРЖУСЬ В СВОЕЙ КУЛЬТУРЕ" text={userData.culturePride || userData.culture_pride} color={themeType === 'wine' ? '#efc2a3' : HOOK_COLORS.culturePride} icon="ribbon" />}
                    {(userData?.stereotypeTrue || userData?.stereotype_true) && <HookItem title="ЧТО ДЛЯ МЕНЯ ЗНАЧИТ НАСТОЯЩАЯ БЛИЗОСТЬ" text={userData.stereotypeTrue || userData.stereotype_true} color={themeType === 'wine' ? '#efc2a3' : HOOK_COLORS.stereotypeTrue} icon="heart" />}
                    {(userData?.stereotypeFalse || userData?.stereotype_false) && <HookItem title="ЧЕМ Я ЗАНИМАЮСЬ, КОГДА ХОЧУ ПЕРЕЗАГРУЗИТЬСЯ" text={userData.stereotypeFalse || userData.stereotype_false} color={themeType === 'wine' ? '#efc2a3' : HOOK_COLORS.stereotypeFalse} icon="refresh" />}

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
                                        { backgroundColor: theme.cardBg },
                                        !isLight && themeType !== 'space' && { backgroundColor: theme.cardBg, borderColor: theme.border, borderWidth: 1 },
                                        // Passion theme: peachy background for interests
                                        themeType === 'wine' && { backgroundColor: '#fbdac9', borderWidth: 0 }
                                    ]}
                                >
                                    <Text style={[
                                        styles.tagText,
                                        isLight && { color: '#333' },
                                        // Passion theme: black text for interests
                                        themeType === 'wine' && { color: '#1c1c1e' }
                                    ]}>{item}</Text>
                                </View>
                            ))}
                        </View>
                    </View>
                )}

                <View style={{ height: 30 }} />
            </ScrollView >

            {/* ЛАЙТБОКС */}
            < Modal
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
            </Modal >
            {/* BAN CONFIRMATION MODAL */}
            <Modal
                visible={showBanModal}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setShowBanModal(false)}
            >
                <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' }}>
                    <View style={{
                        width: '80%',
                        backgroundColor: isLight ? '#fff' : '#1c1c1e',
                        borderRadius: 20,
                        padding: 20,
                        alignItems: 'center'
                    }}>
                        <Text style={{
                            fontSize: 18,
                            fontWeight: 'bold',
                            color: isLight ? '#000' : '#fff',
                            marginBottom: 15
                        }}>
                            Забанить пользователя?
                        </Text>

                        <TextInput
                            style={{
                                width: '100%',
                                height: 50,
                                backgroundColor: isLight ? '#f2f2f2' : '#2c2c2e',
                                borderRadius: 10,
                                paddingHorizontal: 15,
                                color: isLight ? '#000' : '#fff',
                                marginBottom: 20
                            }}
                            placeholder="Причина бана..."
                            placeholderTextColor={isLight ? '#999' : '#666'}
                            value={banReason}
                            onChangeText={setBanReason}
                            selectionColor={isLight ? '#000000' : '#FFFFFF'}
                            cursorColor={isLight ? '#000000' : '#FFFFFF'}
                        />

                        <View style={{ flexDirection: 'row', gap: 10 }}>
                            <TouchableOpacity
                                onPress={() => setShowBanModal(false)}
                                style={{
                                    flex: 1,
                                    padding: 15,
                                    borderRadius: 12,
                                    backgroundColor: isLight ? '#e5e5e5' : '#3a3a3c',
                                    alignItems: 'center'
                                }}
                            >
                                <Text style={{ color: isLight ? '#000' : '#fff', fontWeight: 'bold' }}>Отмена</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                onPress={handleBanUser}
                                style={{
                                    flex: 1,
                                    padding: 15,
                                    borderRadius: 12,
                                    backgroundColor: '#FF3B30',
                                    alignItems: 'center'
                                }}
                            >
                                <Text style={{ color: '#fff', fontWeight: 'bold' }}>ЗАБАНИТЬ</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </>
    );
};

// ... existing code ...


const styles = StyleSheet.create({
    scrollContent: { paddingBottom: normalize(20), alignItems: 'center' },

    // --- ФОТО ---
    carouselContainer: {
        height: PHOTO_HEIGHT,
        marginTop: normalize(10),
        marginBottom: normalize(20),
        width: PHOTO_WIDTH,
    },
    photoSlide: {
        width: PHOTO_WIDTH,
        height: PHOTO_HEIGHT,
        marginHorizontal: 0,
        borderRadius: normalize(24),
        overflow: 'hidden',
        backgroundColor: '#1c1c1e',
        shadowColor: "#000", shadowOffset: { width: 0, height: normalize(10) }, shadowOpacity: 0.5, shadowRadius: normalize(15), elevation: 10,
    },
    photoImage: { width: '100%', height: '100%', resizeMode: 'cover' },

    photoPlaceholder: {
        width: PHOTO_WIDTH,
        height: PHOTO_HEIGHT,
        borderRadius: normalize(24),
        backgroundColor: '#1c1c1e',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    placeholderText: {
        color: 'rgba(255,255,255,0.4)',
        fontSize: normalize(16),
        marginTop: normalize(10),
        fontWeight: '500',
    },

    dotsContainer: {
        flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: normalize(12), gap: normalize(6)
    },
    dot: { width: normalize(6), height: normalize(6), borderRadius: normalize(3), backgroundColor: 'rgba(255,255,255,0.2)' },
    dotActive: { width: normalize(6), height: normalize(6), borderRadius: normalize(3), backgroundColor: '#fff' },

    // --- ИНФО ---
    infoBlock: { width: '100%', paddingHorizontal: normalize(20), alignItems: 'flex-start', marginBottom: normalize(20) },
    nameRow: { flexDirection: 'row', alignItems: 'center' },
    nameText: { fontSize: normalize(28), fontWeight: 'bold' },

    rootsText: { fontSize: normalize(15), fontWeight: '600', marginTop: normalize(4), marginBottom: normalize(12) },

    statusRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
    statusText: { fontSize: normalize(15), fontWeight: '400' },
    statusDot: { width: normalize(3), height: normalize(3), borderRadius: normalize(1.5), marginHorizontal: normalize(8) },

    socialStack: { flexDirection: 'column', gap: normalize(6), marginTop: normalize(12) },
    socialItem: { flexDirection: 'row', alignItems: 'center', gap: normalize(8) },
    socialText: { fontSize: normalize(14), fontWeight: '500' },

    divider: { width: width - normalize(40), height: 1, marginBottom: normalize(25) },

    // --- HOOKS ---
    hooksContainer: { width: '100%', paddingHorizontal: normalize(20), gap: normalize(20), marginBottom: normalize(30) },
    hookContainer: {
        borderRadius: normalize(16),
        padding: normalize(16),
    },
    hookHeader: { flexDirection: 'row', alignItems: 'center', gap: normalize(10), marginBottom: normalize(8) },
    iconCircle: { width: normalize(28), height: normalize(28), borderRadius: normalize(14), justifyContent: 'center', alignItems: 'center' },
    hookTitle: { fontSize: normalize(11), fontWeight: 'bold', letterSpacing: 0.5, textTransform: 'uppercase', flex: 1, lineHeight: normalize(16) },
    hookText: { fontSize: normalize(16), lineHeight: normalize(24) },

    // --- INTERESTS ---
    sectionContainer: { width: '100%', paddingHorizontal: normalize(20), marginBottom: normalize(30) },
    sectionTitle: { fontSize: normalize(12), fontWeight: 'bold', marginBottom: normalize(12), textTransform: 'uppercase', letterSpacing: 1 },
    interestsCloud: { flexDirection: 'row', flexWrap: 'wrap', gap: normalize(8) },
    tagBox: {
        backgroundColor: 'rgba(255,255,255,0.08)',
        paddingHorizontal: normalize(14), paddingVertical: normalize(8), borderRadius: normalize(20),
    },
    tagText: { color: '#e4e4e7', fontSize: normalize(14), fontWeight: '500' },

    // --- LIGHTBOX ---
    lightboxContainer: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'center', alignItems: 'center' },
    lightboxImageContainer: { width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' },
    lightboxImage: {
        width: '100%',
        height: '100%',
        ...(Platform.OS === 'web' ? { width: '100%', height: '90%', maxWidth: 500 } : {})
    },
    navArrowLeft: { position: 'absolute', left: 0, top: '40%', bottom: '40%', width: normalize(60), justifyContent: 'center', alignItems: 'center', zIndex: 50 },
    navArrowRight: { position: 'absolute', right: 0, top: '40%', bottom: '40%', width: normalize(60), justifyContent: 'center', alignItems: 'center', zIndex: 50 },
});
