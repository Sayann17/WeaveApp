import { Ionicons } from '@expo/vector-icons';
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
import { zodiacSigns } from '../utils/basic_info';

const THEME = {
    background: '#f4f4e7',
    text: '#1c1c1e',
    subText: '#555555',
    cardBg: '#ffffff',
    activeBorder: '#e1306c',
};

export default function OnboardingZodiacScreen() {
    const [selectedZodiac, setSelectedZodiac] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const router = useRouter();

    const handleSaveAndFinish = async () => {
        setIsLoading(true);
        try {
            await yandexAuth.updateProfile({
                zodiac: selectedZodiac || ''
            });
            console.log('[OnboardingZodiac] Navigating to photos...');
            router.replace('/onboarding/photos');
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
                <Text style={styles.stepCount}>Шаг 6 из 6</Text>
                <Text style={styles.title}>Знак зодиака</Text>
                <Text style={styles.subtitle}>
                    Верите в звезды? Выберите свой знак или пропустите.
                </Text>
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent}>
                <View style={styles.zodiacContainer}>
                    {zodiacSigns.map((sign) => {
                        const isSelected = selectedZodiac === sign.id;
                        return (
                            <Pressable
                                key={sign.id}
                                style={[
                                    styles.zodiacItem,
                                    isSelected && styles.zodiacItemSelected
                                ]}
                                onPress={() => setSelectedZodiac(sign.id)}
                                disabled={isLoading}
                            >
                                <Text style={styles.zodiacEmoji}>{sign.emoji}</Text>
                                <View style={styles.zodiacInfo}>
                                    <Text style={styles.zodiacName}>{sign.name}</Text>
                                    <Text style={styles.zodiacDates}>{sign.dates}</Text>
                                </View>
                                {isSelected && <Ionicons name="checkmark-circle" size={24} color="#e1306c" />}
                            </Pressable>
                        );
                    })}
                </View>
            </ScrollView>

            <View style={styles.footer}>
                <Pressable
                    style={styles.continueButton}
                    onPress={handleSaveAndFinish}
                    disabled={isLoading}
                >
                    {isLoading ? (
                        <ActivityIndicator color="#ffffff" size="small" />
                    ) : (
                        <Text style={styles.continueButtonText}>
                            Перейти к фото
                        </Text>
                    )}
                </Pressable>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: THEME.background },
    header: { padding: 20, paddingTop: 85 },
    stepCount: { fontSize: 12, color: '#000000', marginBottom: 8, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 1 },
    title: { fontSize: 32, fontWeight: '300', color: THEME.text, marginBottom: 10 },
    subtitle: { fontSize: 16, color: THEME.subText },

    scrollContent: { padding: 20 },
    zodiacContainer: { gap: 12 },
    zodiacItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: THEME.cardBg,
        padding: 16,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#e0e0e0',
        gap: 15,
        shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1,
    },
    zodiacItemSelected: { borderColor: THEME.activeBorder, backgroundColor: '#ffffff' },
    zodiacEmoji: { fontSize: 28 },
    zodiacInfo: { flex: 1 },
    zodiacName: { color: THEME.text, fontSize: 17, fontWeight: '600' },
    zodiacDates: { color: '#888', fontSize: 13 },

    footer: { padding: 20, paddingBottom: 40 },
    continueButton: { backgroundColor: '#000000', padding: 18, borderRadius: 12, alignItems: 'center', width: '100%' },
    continueButtonText: { color: '#ffffff', fontSize: 16, fontWeight: 'bold' },
});