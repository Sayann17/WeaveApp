// app/onboarding/gender.tsx
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert, Keyboard, KeyboardAvoidingView, Platform, SafeAreaView, ScrollView, StatusBar, StyleSheet, Text, TextInput, View } from 'react-native';
import { PrimaryButton } from '../components/ui/PrimaryButton';
import { SelectableCard } from '../components/ui/SelectableCard';
import { yandexAuth } from '../services/yandex/AuthService';

const THEME = {
    background: '#f4f4e7',
    text: '#1c1c1e',
    subText: '#555555',
    active: '#10b981', // 🔥 Green (Emerald 500)
};

export default function OnboardingGenderScreen() {
    const [gender, setGender] = useState<'male' | 'female' | null>(null);
    const [age, setAge] = useState<string>('');
    const [isLoading, setIsLoading] = useState(false);
    const router = useRouter();

    const handleContinue = async () => {
        const ageNum = parseInt(age, 10);

        if (!gender) {
            Alert.alert('Внимание', 'Пожалуйста, выберите пол.');
            return;
        }

        if (!age || isNaN(ageNum) || ageNum < 18 || ageNum > 99) {
            Alert.alert('Внимание', 'Введите корректный возраст (от 18 до 99).');
            return;
        }

        setIsLoading(true);
        try {
            await yandexAuth.updateProfile({
                gender: gender,
                age: ageNum
            });
            router.replace('/onboarding/ethnicity');
        } catch (error) {
            console.error('Gender/Age screen error:', error);
            const msg = error instanceof Error ? error.message : String(error);
            Alert.alert('Ошибка сохранения', msg);
        } finally {
            setIsLoading(false);
        }
    };

    const [isKeyboardVisible, setKeyboardVisible] = useState(false);

    React.useEffect(() => {
        const keyboardShowListener = Keyboard.addListener(
            Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
            () => setKeyboardVisible(true)
        );
        const keyboardHideListener = Keyboard.addListener(
            Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
            () => setKeyboardVisible(false)
        );

        return () => {
            keyboardShowListener.remove();
            keyboardHideListener.remove();
        };
    }, []);

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor={THEME.background} />
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={{ flex: 1 }}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
            >
                <ScrollView
                    contentContainerStyle={[
                        styles.scrollContent,
                        { paddingBottom: 120 }
                    ]}
                    showsVerticalScrollIndicator={false}
                >
                    <View style={styles.header}>
                        <Text style={styles.step}>ШАГ 1 из 6</Text>
                        <Text style={styles.title}>О вас</Text>
                        <Text style={styles.subtitle}>Пол и возраст для поиска пары.</Text>
                    </View>

                    <View style={styles.content}>
                        {/* Gender Selection */}
                        <Text style={styles.label}>Ваш пол</Text>
                        <View style={styles.row}>
                            <SelectableCard
                                title="Мужской"
                                emoji="👨"
                                selected={gender === 'male'}
                                onPress={() => setGender('male')}
                                index={0}
                            />
                            <SelectableCard
                                title="Женский"
                                emoji="👩"
                                selected={gender === 'female'}
                                onPress={() => setGender('female')}
                                index={1}
                            />
                        </View>

                        {/* Age Input */}
                        <Text style={[styles.label, { marginTop: 30 }]}>Ваш возраст</Text>
                        <View style={styles.inputContainer}>
                            <TextInput
                                style={styles.input}
                                value={age}
                                onChangeText={(text) => setAge(text.replace(/[^0-9]/g, ''))}
                                placeholder="18"
                                placeholderTextColor="rgba(0,0,0,0.2)"
                                keyboardType="number-pad"
                                maxLength={2}
                            />
                        </View>
                    </View>

                </ScrollView>
            </KeyboardAvoidingView>

            {!isKeyboardVisible && (
                <View style={styles.footer}>
                    <PrimaryButton
                        title="Продолжить"
                        onPress={handleContinue}
                        disabled={isLoading}
                        isLoading={isLoading}
                        style={{ backgroundColor: '#2a2a2a' }}
                    />
                </View>
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: THEME.background },
    scrollContent: { flexGrow: 1 },
    header: { padding: 24, paddingTop: 92 },
    step: { color: '#000000', fontSize: 12, fontWeight: 'bold', marginBottom: 10, letterSpacing: 1, textTransform: 'uppercase' },
    title: { fontSize: 32, fontWeight: '300', color: THEME.text, marginBottom: 10 },
    subtitle: { fontSize: 16, color: THEME.subText, lineHeight: 24 },
    content: { padding: 24 },
    label: { fontSize: 18, fontWeight: '600', color: THEME.text, marginBottom: 15 },
    row: { flexDirection: 'row', justifyContent: 'space-between', gap: 15 },
    inputContainer: { alignItems: 'center' },
    input: {
        fontSize: 48,
        fontWeight: '300',
        color: THEME.text,
        borderBottomWidth: 2,
        borderBottomColor: '#000',
        width: 100,
        textAlign: 'center',
        paddingBottom: 5,
        fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
    },
    footer: { padding: 24, paddingBottom: 20 }, // Reduced bottom padding
});