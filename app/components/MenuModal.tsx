// app/components/MenuModal.tsx
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import {
    Alert,
    Linking,
    Modal,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
import { yandexAuth } from '../services/yandex/AuthService';
import { SpaceBackground } from './ui/SpaceBackground';

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
    const [showFeedback, setShowFeedback] = React.useState(false);
    const [showSupport, setShowSupport] = React.useState(false);
    const [showDonate, setShowDonate] = React.useState(false);

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
                            backgroundColor: 'transparent', // Handled by inner views
                            borderColor: theme.border,
                            borderWidth: 1,
                            overflow: 'hidden',
                            // Remove padding here, so background fills completely
                        }
                    ]}
                    onPress={(e) => e.stopPropagation()}
                >
                    {/* 1. Background Layer */}
                    <View style={StyleSheet.absoluteFill}>
                        {themeType === 'space' ? (
                            <SpaceBackground style={{ flex: 1 }}>{null}</SpaceBackground>
                        ) : (
                            <View style={{ flex: 1, backgroundColor: (theme as any).sheetBg || theme.cardBg }} />
                        )}
                    </View>

                    {/* 2. Content Layer with Padding */}
                    <View style={{ flex: 1, paddingTop: 20, paddingBottom: insets.bottom + 20 }}>
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
                            {/* Edit Profile */}
                            <Pressable
                                style={[styles.menuItem, { backgroundColor: isLight ? '#ffffff' : theme.cardBg }]}
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

                            {/* Visibility Toggle - Hidden by request */}
                            {/* <View style={[styles.menuItem, { backgroundColor: isLight ? '#ffffff' : theme.cardBg }]}>
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
                            </View> */}

                            {/* Theme Options */}
                            <View style={styles.themeOptions}>
                                <Pressable
                                    style={[
                                        styles.themeOption,
                                        { backgroundColor: isLight ? '#ffffff' : theme.cardBg },
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
                                        { backgroundColor: isLight ? '#ffffff' : theme.cardBg },
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
                                        { backgroundColor: isLight ? '#ffffff' : theme.cardBg },
                                        themeType === 'wine' && styles.themeOptionActive
                                    ]}
                                    onPress={() => setTheme('wine')}
                                >
                                    <Ionicons name="rose" size={20} color={themeType === 'wine' ? '#e1306c' : theme.subText} />
                                    <Text style={[styles.themeOptionText, { color: themeType === 'wine' ? theme.text : theme.subText }]}>
                                        Passion
                                    </Text>
                                </Pressable>
                            </View>

                            {/* Donate Button */}
                            <Pressable
                                style={[styles.menuItem, { backgroundColor: isLight ? '#ffffff' : theme.cardBg }]}
                                onPress={() => setShowDonate(true)}
                            >
                                <View style={[styles.iconContainer, { backgroundColor: isLight ? '#f0f0f0' : 'rgba(255,255,255,0.1)' }]}>
                                    <Ionicons name="gift-outline" size={24} color={theme.text} />
                                </View>
                                <View style={styles.menuTextContainer}>
                                    <Text style={[styles.menuText, { color: theme.text }]}>Поддержать проект</Text>
                                    <Text style={[styles.menuSubtext, { color: theme.subText }]}>На развитие Weave</Text>
                                </View>
                                <Ionicons name="chevron-forward" size={20} color={theme.subText} />
                            </Pressable>

                            {/* Support Button */}
                            <Pressable
                                style={[styles.menuItem, { backgroundColor: isLight ? '#ffffff' : theme.cardBg }]}
                                onPress={() => setShowSupport(true)}
                            >
                                <View style={[styles.iconContainer, { backgroundColor: isLight ? '#f0f0f0' : 'rgba(255,255,255,0.1)' }]}>
                                    <Ionicons name="help-buoy-outline" size={24} color={theme.text} />
                                </View>
                                <View style={styles.menuTextContainer}>
                                    <Text style={[styles.menuText, { color: theme.text }]}>Обратиться в поддержку</Text>
                                    <Text style={[styles.menuSubtext, { color: theme.subText }]}>Сообщить о проблеме</Text>
                                </View>
                                <Ionicons name="chevron-forward" size={20} color={theme.subText} />
                            </Pressable>

                            {/* Feedback Button */}
                            <Pressable
                                style={[styles.menuItem, { backgroundColor: isLight ? '#ffffff' : theme.cardBg }]}
                                onPress={() => setShowFeedback(true)}
                            >
                                <View style={[styles.iconContainer, { backgroundColor: isLight ? '#f0f0f0' : 'rgba(255,255,255,0.1)' }]}>
                                    <Ionicons name="chatbubble-outline" size={24} color={theme.text} />
                                </View>
                                <View style={styles.menuTextContainer}>
                                    <Text style={[styles.menuText, { color: theme.text }]}>Оставить отзыв</Text>
                                    <Text style={[styles.menuSubtext, { color: theme.subText }]}>Помогите нам стать лучше</Text>
                                </View>
                                <Ionicons name="chevron-forward" size={20} color={theme.subText} />
                            </Pressable>
                            {/* Delete Account - Hidden for now */}
                            {/* <Pressable
                                style={[styles.menuItem, styles.deleteItem, { backgroundColor: isLight ? '#FFF0F0' : 'rgba(255, 69, 58, 0.1)' }]}
                                onPress={handleDeleteAccount}
                            >
                                <View style={[styles.iconContainer, { backgroundColor: isLight ? '#FFE5E5' : 'rgba(255, 69, 58, 0.15)' }]}>
                                    <Ionicons name="trash-outline" size={24} color="#FF453A" />
                                </View>
                                <View style={styles.menuTextContainer}>
                                    <Text style={[styles.menuText, { color: '#FF453A' }]}>Удалить аккаунт</Text>
                                    <Text style={[styles.menuSubtext, { color: theme.subText }]}>Безвозвратно</Text>
                                </View>
                            </Pressable> */}
                        </ScrollView>
                    </View>
                </Pressable>
            </Pressable >

            {/* Feedback Modal */}
            <Modal
                transparent
                visible={showFeedback}
                animationType="fade"
                onRequestClose={() => setShowFeedback(false)}
            >
                <View style={styles.feedbackBackdrop}>
                    <View style={[styles.feedbackModal, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
                        <Pressable style={styles.feedbackClose} onPress={() => setShowFeedback(false)}>
                            <Ionicons name="close" size={24} color={theme.subText} />
                        </Pressable>

                        <Text style={[styles.feedbackText, { color: theme.text }]}>
                            Привет! Это команда Weave :) нам очень важно сейчас получать обратную связь от пользователей. Удели нам немного времени и помоги нам сделать классный и зрелый продукт :)
                            {'\n\n'}
                            Ссылка приведет тебя к гугл формам )
                        </Text>

                        <Pressable
                            style={[styles.feedbackButton, { backgroundColor: '#4A9EFF' }]}
                            onPress={() => {
                                Linking.openURL('https://docs.google.com/forms/d/e/1FAIpQLSe2cf9HUeawptj1_qyEyUVk-0sjGyF3t4NE1QiZIwcpCjRw2g/viewform');
                                setShowFeedback(false);
                            }}
                        >
                            <Text style={styles.feedbackButtonText}>Перейти</Text>
                        </Pressable>
                    </View>
                </View>
            </Modal>

            {/* Support Modal */}
            <Modal
                transparent
                visible={showSupport}
                animationType="fade"
                onRequestClose={() => setShowSupport(false)}
            >
                <View style={styles.feedbackBackdrop}>
                    <View style={[styles.feedbackModal, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
                        <Pressable style={styles.feedbackClose} onPress={() => setShowSupport(false)}>
                            <Ionicons name="close" size={24} color={theme.subText} />
                        </Pressable>

                        <Text style={[styles.feedbackText, { color: theme.text }]}>
                            Привет! Жаль, что ты столкнулся с каким-то неполадками :({'\n'}
                            Пожалуйста, опишите вашу проблему по ссылке снизу и мы ее обязательно исправим!
                        </Text>

                        <Pressable
                            style={[styles.feedbackButton, { backgroundColor: '#4A9EFF' }]}
                            onPress={() => {
                                Linking.openURL('https://docs.google.com/forms/d/e/1FAIpQLSeNOJr72muL9Ox2cwJ8H3qX649O9JhSV2owft-brLVYyV5_Zg/viewform?usp=publish-editor');
                                setShowSupport(false);
                            }}
                        >
                            <Text style={styles.feedbackButtonText}>Перейти</Text>
                        </Pressable>
                    </View>
                </View>
            </Modal>

            {/* Donate Modal */}
            < Modal
                transparent
                visible={showDonate}
                animationType="fade"
                onRequestClose={() => setShowDonate(false)}
            >
                <View style={styles.feedbackBackdrop}>
                    <View style={[styles.feedbackModal, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
                        <Pressable style={styles.feedbackClose} onPress={() => setShowDonate(false)}>
                            <Ionicons name="close" size={24} color={theme.subText} />
                        </Pressable>

                        <Text style={[styles.feedbackText, { color: theme.text, fontSize: 16, lineHeight: 24 }]}>
                            Привет! Weave сейчас находится на стадии развития и у нас большие амбициозные планы!{'\n'}{'\n'}
                            Если тебе нравится продукт, помоги нам стать еще лучше!{'\n'}
                            Будем рады любой сумме :)
                        </Text>

                        <Pressable
                            style={[styles.feedbackButton, { backgroundColor: '#4A9EFF', width: '100%' }]}
                            onPress={() => {
                                Linking.openURL('https://yoomoney.ru/fundraise/1FF7HNTP03P.260123');
                                setShowDonate(false);
                            }}
                        >
                            <Text style={styles.feedbackButtonText}>Задонатить</Text>
                        </Pressable>
                    </View>
                </View>
            </Modal >
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
    },
    feedbackBackdrop: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.6)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20
    },
    feedbackModal: {
        width: '100%',
        maxWidth: 340,
        borderRadius: 24,
        padding: 24,
        borderWidth: 1,
        alignItems: 'center',
        // Shadow
        shadowColor: "#000",
        shadowOffset: {
            width: 0,
            height: 4,
        },
        shadowOpacity: 0.30,
        shadowRadius: 4.65,
        elevation: 8,
    },
    feedbackClose: {
        position: 'absolute',
        top: 16,
        right: 16,
        padding: 4
    },
    feedbackText: {
        fontSize: 16,
        lineHeight: 22,
        textAlign: 'center',
        marginBottom: 24,
        marginTop: 12
    },
    feedbackButton: {
        paddingVertical: 12,
        paddingHorizontal: 32,
        borderRadius: 16,
        minWidth: 140,
        alignItems: 'center'
    },
    feedbackButtonText: {
        color: '#fff',
        fontWeight: '600',
        fontSize: 16
    }
});
