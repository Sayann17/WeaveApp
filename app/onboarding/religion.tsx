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
import { religions } from '../utils/basic_info';

const THEME = {
    background: '#f4f4e7',
    text: '#1c1c1e',
    subText: '#555555',
    cardBg: '#ffffff',
    activeBorder: '#10b981', // 🔥 Green
};

export default function OnboardingReligionScreen() {
    const [selectedReligions, setSelectedReligions] = useState<string[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const router = useRouter();

    const handleToggleReligion = (religionId: string) => {
        setSelectedReligions(prev => {
            if (prev.includes(religionId)) return prev.filter(item => item !== religionId);
            return [...prev, religionId];
        });
    };

    const handleSaveAndContinue = async () => {
        setIsLoading(true);
        try {
            await yandexAuth.updateProfile({
                religions: selectedReligions
            });
            router.replace('/onboarding/zodiac');
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
                <Text style={styles.stepCount}>Шаг 5 из 6</Text>
                <Text style={styles.title}>Вера</Text>
                <Text style={styles.subtitle}>
                    Важно ли это для вас? Можно выбрать несколько вариантов или пропустить.
                </Text>
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent}>
                <View style={styles.religionContainer}>
                    {religions.map((religion) => {
                        const isSelected = selectedReligions.includes(religion.id);
                        return (
                            <Pressable
                                key={religion.id}
                                style={[
                                    styles.religionButton,
                                    isSelected && styles.religionButtonSelected
                                ]}
                                onPress={() => handleToggleReligion(religion.id)}
                                disabled={isLoading}
                            >
                                <Text style={styles.religionEmoji}>{religion.emoji}</Text>
                                <Text style={[
                                    styles.religionText,
                                    isSelected && styles.religionTextSelected
                                ]}>
                                    {religion.name}
                                </Text>
                            </Pressable>
                        );
                    })}
                </View>
            </ScrollView>

            <View style={styles.footer}>
                <Pressable
                    style={styles.continueButton}
                    onPress={handleSaveAndContinue}
                    disabled={isLoading}
                >
                    {isLoading ? (
                        <ActivityIndicator color="#ffffff" size="small" />
                    ) : (
                        <Text style={styles.continueButtonText}>
                            Продолжить
                        </Text>
                    )}
                </Pressable>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: THEME.background },
    header: { padding: 20, paddingTop: 92 },
    stepCount: { fontSize: 12, color: '#000000', marginBottom: 8, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 1 },
    title: { fontSize: 32, fontWeight: '300', color: THEME.text, marginBottom: 10 },
    subtitle: { fontSize: 16, color: THEME.subText },

    scrollContent: { padding: 20 },
    religionContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },

    religionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: THEME.cardBg,
        paddingHorizontal: 20,
        paddingVertical: 14,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#e0e0e0',
        gap: 10,
        // Тень
        shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 2,
    },
    religionButtonSelected: {
        borderColor: THEME.activeBorder,
        backgroundColor: '#ffffff' // Очень светло-розовый
    },
    religionEmoji: { fontSize: 20 },
    religionText: { color: THEME.text, fontSize: 16, fontWeight: '500' },
    religionTextSelected: { color: '#10b981', fontWeight: '600' },

    footer: { padding: 20, paddingBottom: 40 },
    continueButton: { backgroundColor: '#2a2a2a', padding: 18, borderRadius: 12, alignItems: 'center', width: '100%' },
    continueButtonText: { color: '#ffffff', fontSize: 16, fontWeight: 'bold' },
});