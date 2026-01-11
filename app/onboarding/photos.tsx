import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
    Alert,
    SafeAreaView,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    View
} from 'react-native';
import { PhotoGrid } from '../components/PhotoGrid';
import { PrimaryButton } from '../components/ui/PrimaryButton';
import { yandexAuth } from '../services/yandex/AuthService';

const THEME = {
    background: '#f4f4e7',
    text: '#1c1c1e',
    subText: '#555555',
};

export default function OnboardingPhotosScreen() {
    const [photos, setPhotos] = useState<string[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [hasError, setHasError] = useState(false); // 🔥 State for visuals
    const router = useRouter();

    console.log('[OnboardingPhotos] Mounting...');

    const handleFinish = async () => {
        if (photos.length === 0) {
            setHasError(true);
            Alert.alert('Нужно фото', 'Загрузите хотя бы одно фото, чтобы вас узнали.');
            return;
        }
        setHasError(false);

        setIsLoading(true);
        try {
            await yandexAuth.updateProfile({
                photos: photos,
                profile_completed: 1
            });
            router.replace('/(tabs)');
        } catch (error) {
            console.error(error);
            Alert.alert('Ошибка', 'Не удалось сохранить профиль');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor={THEME.background} />
            <View style={styles.header}>
                <Text style={styles.stepCount}>Финал</Text>
                <Text style={styles.title}>Ваши фото</Text>
                <Text style={styles.subtitle}>
                    Добавьте пару кадров, чтобы вас узнали.
                </Text>
                <Text style={{ fontSize: 14, color: hasError ? '#ef4444' : '#555555', marginTop: 5, fontWeight: '600' }}>
                    (минимум 1 фото)
                </Text>
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent}>
                <PhotoGrid
                    photos={photos}
                    setPhotos={setPhotos}
                    maxPhotos={6}
                />
            </ScrollView>

            <View style={styles.footer}>
                <PrimaryButton
                    title={isLoading ? "Создаем профиль..." : "Начать поиск"}
                    onPress={handleFinish}
                    disabled={isLoading}
                    isLoading={isLoading}
                    style={{ backgroundColor: '#10b981' }}
                />
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
    footer: { padding: 20, paddingBottom: 40 },
});