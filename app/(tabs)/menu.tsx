import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
    Modal,
    Pressable,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    TouchableWithoutFeedback,
    View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ThemedBackground } from '../components/ThemedBackground';
import { Colors } from '../constants/colors';
import { useNotifications } from '../context/NotificationContext';
import { useTheme } from '../context/ThemeContext';
import { yandexAuth } from '../services/yandex/AuthService';

export default function MenuScreen() {
    const router = useRouter();
    const { theme, themeType, setTheme } = useTheme();
    const { unreadMessagesCount } = useNotifications();
    const insets = useSafeAreaInsets();
    const [settingsVisible, setSettingsVisible] = useState(false);

    const isLight = themeType === 'light';

    return (
        <>
            <ThemedBackground>
                <StatusBar barStyle={isLight ? "dark-content" : "light-content"} />

                <View style={[styles.safeArea, { paddingTop: insets.top }]}>
                    <View style={styles.header}>
                        <Text style={[styles.headerTitle, { color: theme.text }]}>Меню</Text>
                    </View>

                    <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
                        {/* Edit Profile */}
                        <Pressable
                            style={[styles.menuItem, { backgroundColor: theme.cardBg }]}
                            onPress={() => router.push('/profile/edit')}
                        >
                            <View style={[styles.iconContainer, { backgroundColor: isLight ? '#f0f0f0' : 'rgba(255,255,255,0.1)' }]}>
                                <Ionicons name="create-outline" size={24} color={theme.text} />
                            </View>
                            <View style={styles.menuTextContainer}>
                                <Text style={[styles.menuText, { color: theme.text }]}>Редактировать профиль</Text>
                                <Text style={[styles.menuSubtext, { color: theme.subText }]}>Изменить фото и информацию</Text>
                            </View>
                            <Ionicons name="chevron-forward" size={20} color={theme.subText} />
                        </Pressable>

                        {/* Notifications */}
                        <Pressable
                            style={[styles.menuItem, { backgroundColor: theme.cardBg }]}
                            onPress={() => router.push('/notifications')}
                        >
                            <View style={[styles.iconContainer, { backgroundColor: isLight ? '#f0f0f0' : 'rgba(255,255,255,0.1)' }]}>
                                <Ionicons name="notifications-outline" size={24} color={theme.text} />
                                {unreadMessagesCount > 0 && (
                                    <View style={styles.badge}>
                                        <Text style={styles.badgeText}>{unreadMessagesCount > 9 ? '9+' : unreadMessagesCount}</Text>
                                    </View>
                                )}
                            </View>
                            <View style={styles.menuTextContainer}>
                                <Text style={[styles.menuText, { color: theme.text }]}>Уведомления</Text>
                                <Text style={[styles.menuSubtext, { color: theme.subText }]}>Просмотр активности</Text>
                            </View>
                            <Ionicons name="chevron-forward" size={20} color={theme.subText} />
                        </Pressable>

                        {/* Theme Settings */}
                        <Pressable
                            style={[styles.menuItem, { backgroundColor: theme.cardBg }]}
                            onPress={() => setSettingsVisible(true)}
                        >
                            <View style={[styles.iconContainer, { backgroundColor: isLight ? '#f0f0f0' : 'rgba(255,255,255,0.1)' }]}>
                                <Ionicons name="color-palette-outline" size={24} color={theme.text} />
                            </View>
                            <View style={styles.menuTextContainer}>
                                <Text style={[styles.menuText, { color: theme.text }]}>Оформление</Text>
                                <Text style={[styles.menuSubtext, { color: theme.subText }]}>Выбор темы приложения</Text>
                            </View>
                            <Ionicons name="chevron-forward" size={20} color={theme.subText} />
                        </Pressable>

                        <View style={[styles.divider, { backgroundColor: theme.border }]} />

                        {/* Logout */}
                        <Pressable
                            style={[styles.menuItem, { backgroundColor: theme.cardBg }]}
                            onPress={() => yandexAuth.logout()}
                        >
                            <View style={[styles.iconContainer, { backgroundColor: 'rgba(255,59,48,0.1)' }]}>
                                <Ionicons name="log-out-outline" size={24} color={Colors.error} />
                            </View>
                            <View style={styles.menuTextContainer}>
                                <Text style={[styles.menuText, { color: Colors.error }]}>Выйти</Text>
                                <Text style={[styles.menuSubtext, { color: theme.subText }]}>Выход из аккаунта</Text>
                            </View>
                            <Ionicons name="chevron-forward" size={20} color={theme.subText} />
                        </Pressable>
                    </ScrollView>
                </View>
            </ThemedBackground>

            {/* THEME SETTINGS MODAL */}
            <Modal
                animationType="slide"
                transparent={true}
                visible={settingsVisible}
                onRequestClose={() => setSettingsVisible(false)}
            >
                <TouchableWithoutFeedback onPress={() => setSettingsVisible(false)}>
                    <View style={styles.modalOverlay}>
                        <TouchableWithoutFeedback>
                            <View style={[styles.modalContainer, { backgroundColor: theme.cardBg }]}>
                                <View style={styles.modalHeader}>
                                    <Text style={[styles.modalTitle, { color: theme.text }]}>Тема приложения</Text>
                                    <TouchableOpacity onPress={() => setSettingsVisible(false)} style={styles.closeButton}>
                                        <Ionicons name="close" size={28} color={theme.text} />
                                    </TouchableOpacity>
                                </View>

                                <View style={styles.themeCards}>
                                    {[
                                        { id: 'light', name: 'Светлая', desc: 'Классический стиль', icon: 'sunny-outline', color: '#FFD700', bg: '#f8f9fa' },
                                        { id: 'space', name: 'Космос', desc: 'Глубокий темный режим', icon: 'planet-outline', color: '#a29bfe', bg: '#0b0d15' },
                                        { id: 'aura', name: 'Аура', desc: 'Мистический градиент', icon: 'color-wand-outline', color: '#9b59b6', bg: '#2a1b3d' }
                                    ].map((item) => (
                                        <TouchableOpacity
                                            key={item.id}
                                            activeOpacity={0.7}
                                            onPress={() => setTheme(item.id as any)}
                                            style={[
                                                styles.themeCard,
                                                { backgroundColor: themeType === item.id ? (isLight ? '#eee' : '#333') : 'transparent' }
                                            ]}
                                        >
                                            <View style={[styles.themeIconBox, { backgroundColor: item.bg }]}>
                                                <Ionicons name={item.icon as any} size={28} color={item.color} />
                                            </View>
                                            <View style={styles.themeTextContainer}>
                                                <Text style={[styles.themeName, { color: theme.text }]}>{item.name}</Text>
                                                <Text style={[styles.themeDesc, { color: theme.subText }]}>{item.desc}</Text>
                                            </View>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            </View>
                        </TouchableWithoutFeedback>
                    </View>
                </TouchableWithoutFeedback>
            </Modal>
        </>
    );
}

const styles = StyleSheet.create({
    safeArea: { flex: 1 },
    header: {
        paddingHorizontal: 20,
        paddingTop: 10,
        paddingBottom: 15,
    },
    headerTitle: { fontSize: 28, fontWeight: '300' },
    scrollView: { flex: 1 },
    scrollContent: { padding: 20, gap: 12 },

    menuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderRadius: 16,
        gap: 12,
    },
    iconContainer: {
        width: 48,
        height: 48,
        borderRadius: 24,
        justifyContent: 'center',
        alignItems: 'center',
        position: 'relative',
    },
    badge: {
        position: 'absolute',
        top: -2,
        right: -2,
        backgroundColor: '#e1306c',
        borderRadius: 10,
        minWidth: 20,
        height: 20,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 4,
    },
    badgeText: {
        color: 'white',
        fontSize: 10,
        fontWeight: 'bold',
    },
    menuTextContainer: { flex: 1 },
    menuText: { fontSize: 16, fontWeight: '600', marginBottom: 2 },
    menuSubtext: { fontSize: 13 },
    divider: { height: 1, marginVertical: 10 },

    // Modal
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    modalContainer: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 50 },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 25 },
    modalTitle: { fontSize: 24, fontWeight: 'bold' },
    closeButton: { padding: 5 },

    themeCards: { gap: 15 },
    themeCard: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 15,
        borderRadius: 16,
    },
    themeIconBox: {
        width: 50,
        height: 50,
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 15,
        borderWidth: 1,
        borderColor: '#ffffff20',
    },
    themeTextContainer: { flex: 1 },
    themeName: { fontSize: 18, fontWeight: '600', marginBottom: 4 },
    themeDesc: { fontSize: 14 },
});
