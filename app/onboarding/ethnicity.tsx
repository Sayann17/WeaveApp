// app/onboarding/ethnicity.tsx
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
    Alert,
    KeyboardAvoidingView,
    Platform,
    SafeAreaView,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    View
} from 'react-native';
import { PrimaryButton } from '../components/ui/PrimaryButton';
import { SelectableCard } from '../components/ui/SelectableCard';
import { yandexAuth } from '../services/yandex/AuthService';
import { ethnicityGroups } from '../utils/ethnicities';

const THEME = {
    background: '#f4f4e7',
    text: '#1c1c1e',
    subText: '#555555',
    inputBg: '#ffffff',
    border: '#e0e0e0'
};

export default function OnboardingEthnicityScreen() {
    const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
    const [customEthnicity, setCustomEthnicity] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const router = useRouter();

    const toggleGroup = (groupId: string) => {
        setSelectedGroups(prev => {
            if (prev.includes(groupId)) return prev.filter(id => id !== groupId);
            if (prev.length >= 3) {
                Alert.alert('Ограничение', 'Можно выбрать не более 3 групп');
                return prev;
            }
            return [...prev, groupId];
        });
    };

    const handleContinue = async () => {
        if (selectedGroups.length === 0 && !customEthnicity.trim()) {
            Alert.alert('Внимание', 'Укажите вашу группу или введите национальность');
            return;
        }

        setIsLoading(true);
        try {
            // const currentUser = auth.currentUser;
            // if (currentUser) {
            //     await updateDoc(doc(firestore, 'users', currentUser.uid), {
            //         macroGroups: selectedGroups,
            //         customEthnicity: customEthnicity.trim(),
            //         updatedAt: new Date(),
            //     });
            //     router.replace('/onboarding/hooks');
            // }
            await yandexAuth.updateProfile({
                macroGroups: selectedGroups,
                ethnicity: customEthnicity.trim()
            });
            router.replace('/onboarding/hooks');
        } catch (error) {
            console.error(error);
            Alert.alert('Ошибка', 'Не удалось сохранить данные');
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
                <View style={styles.header}>
                    <Text style={styles.stepCount}>Шаг 2 из 6</Text>
                    <Text style={styles.title}>Ваше происхождение</Text>
                    <Text style={styles.subtitle}>
                        Это фундамент вашей культуры.
                    </Text>
                </View>

                <ScrollView contentContainerStyle={styles.scrollContent}>
                    {/* Поле ввода */}
                    <View style={styles.inputContainer}>
                        <Text style={styles.label}>Кто вы по национальности?</Text>
                        <View style={styles.inputWrapper}>
                            <Ionicons name="pencil-outline" size={20} color="#666" style={styles.inputIcon} />
                            <TextInput
                                style={styles.input}
                                placeholder="Например: Русский, Аварец, Татарин..."
                                placeholderTextColor="#999"
                                value={customEthnicity}
                                onChangeText={setCustomEthnicity}
                                autoCapitalize="words"
                            />
                        </View>
                    </View>

                    {/* Макрогруппы */}
                    <Text style={styles.label}>Культурный код</Text>
                    <View style={styles.grid}>
                        {ethnicityGroups.map((group, index) => (
                            <SelectableCard
                                key={group.id}
                                title={group.name}
                                emoji={group.emoji}
                                selected={selectedGroups.includes(group.id)}
                                onPress={() => toggleGroup(group.id)}
                                index={index}
                            />
                        ))}
                    </View>
                </ScrollView>

                <View style={styles.footer}>
                    <PrimaryButton
                        title="Продолжить"
                        onPress={handleContinue}
                        isLoading={isLoading}
                        style={{ backgroundColor: '#2a2a2a' }}
                    />
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: THEME.background },
    header: { padding: 20, paddingTop: 40 },
    // 🔥 ЧЕРНЫЙ СЧЕТЧИК
    stepCount: { fontSize: 12, color: '#000000', marginBottom: 8, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 1 },
    title: { fontSize: 32, fontWeight: '300', color: THEME.text, marginBottom: 10 },
    subtitle: { fontSize: 16, color: THEME.subText },

    scrollContent: { padding: 20 },

    inputContainer: { marginBottom: 30 },
    label: { color: THEME.text, fontSize: 18, fontWeight: '600', marginBottom: 15 },
    inputWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: THEME.inputBg,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: THEME.border,
        paddingHorizontal: 15,
        shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 5, elevation: 2,
    },
    inputIcon: { marginRight: 10 },
    input: { flex: 1, color: THEME.text, fontSize: 16, paddingVertical: 16 },

    grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 10 },
    footer: { padding: 20, paddingBottom: 40 },
});