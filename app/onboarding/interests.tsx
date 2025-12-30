import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Pressable,
    SafeAreaView,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    View
} from 'react-native';
import { yandexAuth } from '../services/yandex/AuthService';

const THEME = {
    background: '#f4f4e7',
    text: '#1c1c1e',
    subText: '#555555',
    cardBg: '#ffffff',
    active: '#e1306c',
    activeText: '#ffffff'
};

const availableInterests = [
    'Кино', 'Путешествия', 'Спорт', 'Чтение', 'Музыка', 'Готовка',
    'Йога', 'Игры', 'Искусство', 'Технологии', 'Природа', 'Танцы',
    'Фотография', 'Психология', 'Мода', 'Бизнес'
];

export default function OnboardingInterestsScreen() {
    const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const router = useRouter();

    const handleToggleInterest = (interest: string) => {
        setSelectedInterests(prev => {
            if (prev.includes(interest)) return prev.filter(item => item !== interest);
            if (prev.length >= 10) {
                Alert.alert('Внимание', 'Можно выбрать не более 10 интересов.');
                return prev;
            }
            return [...prev, interest];
        });
    };

    const handleSaveAndContinue = async () => {
        if (selectedInterests.length === 0) {
            Alert.alert('Внимание', 'Выберите хотя бы один интерес.');
            return;
        }

        setIsLoading(true);
        try {
            await yandexAuth.updateProfile({
                interests: selectedInterests
            });
            router.replace('/onboarding/religion');
        } catch (error) {
            console.error(error);
            Alert.alert('Ошибка', 'Не удалось сохранить данные.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor={THEME.background} />
            <View style={styles.header}>
                <Text style={styles.stepCount}>Шаг 4 из 6</Text>
                <Text style={styles.title}>Ваши интересы</Text>
                <Text style={styles.subtitle}>Что вас зажигает?</Text>
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent}>
                <View style={styles.interestsContainer}>
                    {availableInterests.map((interest) => {
                        const isSelected = selectedInterests.includes(interest);
                        return (
                            <Pressable
                                key={interest}
                                style={[
                                    styles.interestTag,
                                    isSelected && styles.interestTagSelected
                                ]}
                                onPress={() => handleToggleInterest(interest)}
                                disabled={isLoading}
                            >
                                <Text style={[
                                    styles.interestTagText,
                                    isSelected && styles.interestTagTextSelected
                                ]}>
                                    {interest}
                                </Text>
                            </Pressable>
                        );
                    })}
                </View>
            </ScrollView>

            <View style={styles.footer}>
                <Text style={styles.selectedCount}>Выбрано: {selectedInterests.length}/10</Text>
                <Pressable
                    style={[styles.continueButton, (selectedInterests.length === 0 || isLoading) && styles.disabledButton]}
                    onPress={handleSaveAndContinue}
                    disabled={selectedInterests.length === 0 || isLoading}
                >
                    {isLoading ? (
                        <ActivityIndicator color="#ffffff" size="small" />
                    ) : (
                        <Text style={styles.continueButtonText}>Продолжить</Text>
                    )}
                </Pressable>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f4f4e7' },
    header: { padding: 20, paddingTop: 40 },
    // 🔥 ЧЕРНЫЙ СЧЕТЧИК
    stepCount: { fontSize: 12, color: '#000000', marginBottom: 8, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 1 },
    title: { fontSize: 32, fontWeight: '300', color: '#1c1c1e', marginBottom: 10 },
    subtitle: { fontSize: 16, color: '#555555' },

    scrollContent: { padding: 20 },
    interestsContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'center' },

    // 🔥 БЕЛЫЕ КАРТОЧКИ
    interestTag: {
        backgroundColor: '#ffffff',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderRadius: 24,
        borderWidth: 1,
        borderColor: '#e0e0e0',
        shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1,
    },
    interestTagSelected: {
        backgroundColor: '#e1306c',
        borderColor: '#e1306c'
    },
    interestTagText: { color: '#1c1c1e', fontSize: 16, fontWeight: '400' },
    interestTagTextSelected: { color: '#ffffff', fontWeight: '600' },

    footer: { padding: 20, paddingBottom: 40, alignItems: 'center' },
    selectedCount: { color: '#555555', marginBottom: 15, fontWeight: '500' },
    continueButton: { backgroundColor: '#2a2a2a', padding: 18, borderRadius: 12, alignItems: 'center', width: '100%' },
    disabledButton: { backgroundColor: '#ccc' },
    continueButtonText: { color: '#ffffff', fontSize: 16, fontWeight: 'bold' },
});