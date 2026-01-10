// app/onboarding/age.tsx
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, SafeAreaView, StatusBar, StyleSheet, Text, TextInput, View } from 'react-native';
import { PrimaryButton } from '../components/ui/PrimaryButton';
import { yandexAuth } from '../services/yandex/AuthService';

const THEME = {
    background: '#f4f4e7',
    text: '#1c1c1e',
    subText: '#555555',
    accent: '#2a2a2a',
};

export default function OnboardingAgeScreen() {
    const [age, setAge] = useState<string>('');
    const [isLoading, setIsLoading] = useState(false);
    const [hasError, setHasError] = useState(false);
    const router = useRouter();

    const handleContinue = async () => {
        const ageNum = parseInt(age, 10);

        if (!age || isNaN(ageNum) || ageNum < 18 || ageNum > 99) {
            setHasError(true);
            Alert.alert('Внимание', 'Пожалуйста, введите корректный возраст (от 18 до 99 лет).');
            return;
        }

        setHasError(false);
        setIsLoading(true);
        try {
            await yandexAuth.updateProfile({ age: ageNum });
            // Navigate to next step: Ethnicity
            router.replace('/onboarding/ethnicity');
        } catch (error) {
            console.error('Age screen error:', error);
            const msg = error instanceof Error ? error.message : String(error);
            Alert.alert('Ошибка сохранения', msg);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor={THEME.background} />
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={{ flex: 1 }}
            >
                <View style={{ flex: 1 }}>
                    <View style={styles.header}>
                        <Text style={styles.step}>ШАГ 2 из 7</Text>
                        <Text style={[styles.title, hasError && { color: '#ef4444' }]}>Ваш возраст</Text>
                        <Text style={styles.subtitle}>Возраст будет виден в профиле.</Text>
                    </View>

                    <View style={styles.content}>
                        <TextInput
                            style={[
                                styles.input,
                                hasError && { color: '#ef4444', borderColor: '#ef4444' }
                            ]}
                            value={age}
                            onChangeText={(text) => {
                                // Only allow digits
                                const filtered = text.replace(/[^0-9]/g, '');
                                setAge(filtered);
                                setHasError(false);
                            }}
                            placeholder="18"
                            placeholderTextColor="rgba(0,0,0,0.2)"
                            keyboardType="number-pad"
                            maxLength={2}
                            autoFocus
                        />
                        <Text style={styles.hint}>От 18 до 99 лет</Text>
                    </View>

                    <View style={styles.footer}>
                        <PrimaryButton
                            title="Продолжить"
                            onPress={handleContinue}
                            disabled={isLoading || !age}
                            isLoading={isLoading}
                            style={{ backgroundColor: '#2a2a2a' }}
                        />
                    </View>
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: THEME.background },
    header: { padding: 24, paddingTop: 85 },
    step: { color: '#000000', fontSize: 12, fontWeight: 'bold', marginBottom: 10, letterSpacing: 1, textTransform: 'uppercase' },
    title: { fontSize: 32, fontWeight: '300', color: THEME.text, marginBottom: 10 },
    subtitle: { fontSize: 16, color: THEME.subText, lineHeight: 24 },
    content: { flex: 1, padding: 24, justifyContent: 'center', alignItems: 'center' },
    input: {
        fontSize: 80,
        fontWeight: '300',
        color: THEME.text,
        borderBottomWidth: 2,
        borderBottomColor: '#000',
        width: 120,
        textAlign: 'center',
        paddingBottom: 10,
        fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
    },
    hint: {
        marginTop: 20,
        color: THEME.subText,
        fontSize: 14
    },
    footer: { padding: 24, paddingBottom: 40 },
});
