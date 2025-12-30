// app/onboarding/gender.tsx
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert, SafeAreaView, StatusBar, StyleSheet, Text, View } from 'react-native';
import { PrimaryButton } from '../components/ui/PrimaryButton';
import { SelectableCard } from '../components/ui/SelectableCard';
import { yandexAuth } from '../services/yandex/AuthService';

const THEME = {
    background: '#f4f4e7',
    text: '#1c1c1e',
    subText: '#555555',
};

export default function OnboardingGenderScreen() {
    const [gender, setGender] = useState<'male' | 'female' | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const router = useRouter();

    const handleContinue = async () => {
        if (!gender) return;
        setIsLoading(true);
        try {
            // const currentUser = auth.currentUser;
            // if (currentUser) {
            //     await updateDoc(doc(firestore, 'users', currentUser.uid), {
            //         gender: gender,
            //         updatedAt: new Date(),
            //     });
            //     router.replace('/onboarding/ethnicity');
            // }
            await yandexAuth.updateProfile({ gender: gender });
            router.replace('/onboarding/ethnicity');
        } catch (error) {
            console.error('Gender screen error:', error);
            Alert.alert('Ошибка', 'Не удалось сохранить данные');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor={THEME.background} />
            <View style={{ flex: 1 }}>
                <View style={styles.header}>
                    {/* 🔥 ЧЕРНЫЙ СЧЕТЧИК */}
                    <Text style={styles.step}>ШАГ 1 из 6</Text>
                    <Text style={styles.title}>Ваш пол</Text>
                    <Text style={styles.subtitle}>Это поможет нам настроить поиск.</Text>
                </View>

                <View style={styles.content}>
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
                </View>

                <View style={styles.footer}>
                    <PrimaryButton
                        title="Продолжить"
                        onPress={handleContinue}
                        disabled={!gender}
                        isLoading={isLoading}
                        style={{ backgroundColor: '#2a2a2a' }} // Темная кнопка
                    />
                </View>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: THEME.background },
    header: { padding: 24, paddingTop: 40 },
    // 🔥 Цвет шага #000000
    step: { color: '#000000', fontSize: 12, fontWeight: 'bold', marginBottom: 10, letterSpacing: 1, textTransform: 'uppercase' },
    title: { fontSize: 32, fontWeight: '300', color: THEME.text, marginBottom: 10 },
    subtitle: { fontSize: 16, color: THEME.subText, lineHeight: 24 },
    content: { flex: 1, padding: 24, justifyContent: 'center' },
    row: { flexDirection: 'row', justifyContent: 'space-between', gap: 15 },
    footer: { padding: 24, paddingBottom: 40 },
});