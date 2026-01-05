// app/components/MenuModal.tsx
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import {
    Alert,
    Modal,
    Pressable,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
import { yandexAuth } from '../services/yandex/AuthService';

interface MenuModalProps {
    visible: boolean;
    onClose: () => void;
}

export const MenuModal = ({ visible, onClose }: MenuModalProps) => {
    const { theme, themeType, setTheme } = useTheme();
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const isLight = themeType === 'light';
    const [isVisibleProfile, setIsVisibleProfile] = React.useState(true);

    React.useEffect(() => {
        if (visible) {
            const user = yandexAuth.getCurrentUser();
            setIsVisibleProfile(user?.isVisible ?? true);
        }
    }, [visible]);

    const toggleVisibility = async (value: boolean) => {
        setIsVisibleProfile(value);
        try {
            await yandexAuth.updateProfile({ isVisible: value });
        } catch (error) {
            console.error(error);
            setIsVisibleProfile(!value);
            Alert.alert('Ошибка', 'Не удалось обновить видимость профиля');
        }
    };

    const handleDeleteAccount = () => {
        Alert.alert(
            'Удалить аккаунт',
            'Вы уверены? Это действие нельзя отменить. Все ваши данные будут удалены.',
            [
                { text: 'Отмена', style: 'cancel' },
                {
                    text: 'Удалить',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await yandexAuth.deleteAccount();
                            onClose();
                            router.replace('/(auth)');
                        } catch (error) {
                            console.error('Delete account error:', error);
                            Alert.alert('Ошибка', 'Не удалось удалить аккаунт');
                        }
                    }
                }
            ]
        );
    };

    const handleLogout = async () => {
        try {
            await yandexAuth.logout();
            onClose();
            router.replace('/(auth)');
        } catch (error) {
            console.error('Logout error:', error);
        }
    };

    const handleNavigation = (path: string) => {
        onClose();
        router.push(path as any);
    };

    return (
        <Modal
            visible={visible}
            transparent
            animationType="slide"
            onRequestClose={onClose}
        >
            <Pressable style={styles.backdrop} onPress={onClose}>
                <Pressable
                    style={[
                        styles.menuContainer,
                        {
                            backgroundColor: theme.background,
                            paddingBottom: insets.bottom + 20,
                        }
                    ]}
                    onPress={(e) => e.stopPropagation()}
                >
                    {/* Header */}
                    <View style={styles.header}>
                        <Text style={[styles.headerTitle, { color: theme.text }]}>Меню</Text>
                        <Pressable onPress={onClose} style={styles.closeButton}>
                            <Ionicons name="close" size={24} color={theme.text} />
                        </Pressable>
                    </View>

                    {/* Menu Items */}
                    <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
                        {/* Edit Profile */}
                        <Pressable
                            style={[styles.menuItem, { backgroundColor: theme.cardBg }]}
                            onPress={() => handleNavigation('/profile/edit')}
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

                        {/* Visibility Toggle */}
                        <View style={[styles.menuItem, { backgroundColor: theme.cardBg }]}>
                            <View style={[styles.iconContainer, { backgroundColor: isLight ? '#f0f0f0' : 'rgba(255,255,255,0.1)' }]}>
                                <Ionicons name={isVisibleProfile ? "eye-outline" : "eye-off-outline"} size={24} color={theme.text} />
                            </View>
                            <View style={styles.menuTextContainer}>
                                <Text style={[styles.menuText, { color: theme.text }]}>
                                    {isVisibleProfile ? 'Профиль виден' : 'Профиль скрыт'}
                                </Text>
                                <Text style={[styles.menuSubtext, { color: theme.subText }]}>
                                    {isVisibleProfile ? 'Вас могут найти в поиске' : 'Вас никто не увидит'}
                                </Text>
                            </View>
                            <Switch
                                value={isVisibleProfile}
                                onValueChange={toggleVisibility}
                                trackColor={{ false: '#767577', true: '#4A9EFF' }}
                                thumbColor={'#fff'}
                            />
                        </View>

                        {/* Theme Options */}
                        <View style={styles.themeOptions}>
                            <Pressable
                                style={[
                                    styles.themeOption,
                                    { backgroundColor: theme.cardBg },
                                    themeType === 'light' && styles.themeOptionActive
                                ]}
                                onPress={() => setTheme('light')}
                            >
                                <Ionicons name="sunny" size={20} color={themeType === 'light' ? '#FFD700' : theme.subText} />
                                <Text style={[styles.themeOptionText, { color: themeType === 'light' ? theme.text : theme.subText }]}>
                                    Светлая
                                </Text>
                            </Pressable>

                            <Pressable
                                style={[
                                    styles.themeOption,
                                    { backgroundColor: theme.cardBg },
                                    themeType === 'space' && styles.themeOptionActive
                                ]}
                                onPress={() => setTheme('space')}
                            >
                                <Ionicons name="moon" size={20} color={themeType === 'space' ? '#9D84FF' : theme.subText} />
                                <Text style={[styles.themeOptionText, { color: themeType === 'space' ? theme.text : theme.subText }]}>
                                    Space
                                </Text>
                            </Pressable>

                            <Pressable
                                style={[
                                    styles.themeOption,
                                    { backgroundColor: theme.cardBg },
                                    themeType === 'aura' && styles.themeOptionActive
                                ]}
                                onPress={() => setTheme('aura')}
                            >
                                <Ionicons name="sparkles" size={20} color={themeType === 'aura' ? '#FF6B9D' : theme.subText} />
                                <Text style={[styles.themeOptionText, { color: themeType === 'aura' ? theme.text : theme.subText }]}>
                                    Aura
                                </Text>
                            </Pressable>
                        </View>

                        {/* Logout */}
                        <Pressable
                            style={[styles.menuItem, styles.logoutItem, { backgroundColor: theme.cardBg }]}
                            onPress={handleLogout}
                        >
                            <View style={[styles.iconContainer, { backgroundColor: 'rgba(255,59,48,0.1)' }]}>
                                <Ionicons name="log-out-outline" size={24} color="#FF3B30" />
                            </View>
                            <View style={styles.menuTextContainer}>
                                <Text style={[styles.menuText, { color: '#FF3B30' }]}>Выйти</Text>
                                <Text style={[styles.menuSubtext, { color: theme.subText }]}>Выход из аккаунта</Text>
                            </View>
                        </Pressable>

                        {/* Delete Account */}
                        <Pressable
                            style={[styles.menuItem, styles.deleteItem, { backgroundColor: theme.cardBg }]}
                            onPress={handleDeleteAccount}
                        >
                            <View style={[styles.iconContainer, { backgroundColor: 'rgba(255,59,48,0.1)' }]}>
                                <Ionicons name="trash-outline" size={24} color="#FF3B30" />
                            </View>
                            <View style={styles.menuTextContainer}>
                                <Text style={[styles.menuText, { color: "#FF3B30" }]}>Удалить аккаунт</Text>
                                <Text style={[styles.menuSubtext, { color: theme.subText }]}>Безвозвратно</Text>
                            </View>
                        </Pressable>
                    </ScrollView>
                </Pressable>
            </Pressable >
        </Modal >
    );
};

const styles = StyleSheet.create({
    backdrop: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'flex-end',
    },
    menuContainer: {
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        paddingTop: 20,
        maxHeight: '80%',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingBottom: 15,
    },
    headerTitle: {
        fontSize: 24,
        fontWeight: '600',
    },
    closeButton: {
        padding: 4,
    },
    scrollView: {
        paddingHorizontal: 20,
    },
    menuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderRadius: 16,
        marginBottom: 12,
    },
    iconContainer: {
        width: 48,
        height: 48,
        borderRadius: 24,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
        position: 'relative',
    },
    menuTextContainer: {
        flex: 1,
    },
    menuText: {
        fontSize: 16,
        fontWeight: '500',
        marginBottom: 2,
    },
    menuSubtext: {
        fontSize: 13,
    },
    themeOptions: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 12,
        paddingHorizontal: 4,
    },
    themeOption: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 12,
        borderRadius: 12,
        gap: 6,
    },
    themeOptionActive: {
        borderWidth: 2,
        borderColor: '#4A9EFF',
    },
    themeOptionText: {
        fontSize: 14,
        fontWeight: '500',
    },
    logoutItem: {
        marginTop: 8,
    },
    deleteItem: {
        marginTop: 8,
        opacity: 0.8,
    }
});
