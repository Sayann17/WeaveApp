// app/onboarding/hooks.tsx
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
import { yandexAuth } from '../services/yandex/AuthService';

const THEME = {
    background: '#f4f4e7',
    text: '#1c1c1e',
    subText: '#555555',
    inputBg: '#ffffff',
    border: '#e0e0e0'
};

// 🔥 ИСПРАВЛЕННЫЙ КОМПОНЕНТ
// Убрали Pressable, перенесли padding внутрь TextInput
const HookInputItem = ({
    label,
    value,
    onChange,
    placeholder,
    multiline = false,
    icon,
    hasError = false,
    onFocus
}: {
    label: string,
    value: string,
    onChange: (t: string) => void,
    placeholder: string,
    multiline?: boolean,
    icon?: any,
    hasError?: boolean,
    onFocus?: () => void
}) => {
    return (
        <View style={styles.inputGroup}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 6 }}>
                {icon && <Ionicons name={icon} size={16} color={THEME.subText} />}
                <Text style={styles.label}>{label}</Text>
            </View>

            <View style={[
                styles.inputWrapper,
                multiline && { height: 140 },
                hasError && { borderWidth: 1, borderColor: '#ef4444' } // 🔥 Red border on error
            ]}>
                <TextInput
                    style={[
                        styles.input,
                        multiline && {
                            height: '100%',
                            textAlignVertical: 'top', // Android: текст сверху
                            paddingTop: 15            // iOS: отступ сверху
                        }
                    ]}
                    value={value}
                    onChangeText={onChange}
                    placeholder={placeholder}
                    placeholderTextColor="#999"
                    multiline={multiline}
                    autoCapitalize="sentences"
                    // 🔥 Важные свойства для iOS
                    blurOnSubmit={!multiline}
                    returnKeyType={multiline ? "default" : "done"}
                    onFocus={onFocus}
                    selectionColor="#000000"
                />
            </View>
        </View>
    );
};

export default function OnboardingHooksScreen() {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(false);
    const [bioError, setBioError] = useState(false); // 🔥 State for bio validation

    const [bio, setBio] = useState('');
    const [loveLanguage, setLoveLanguage] = useState('');
    const [culturePride, setCulturePride] = useState('');
    const [familyMemory, setFamilyMemory] = useState('');
    const [stereotypeTrue, setStereotypeTrue] = useState('');
    const [stereotypeFalse, setStereotypeFalse] = useState('');

    const handleContinue = async () => {
        if (!bio.trim()) {
            setBioError(true);
            Alert.alert('О себе', 'Напишите хотя бы пару слов о себе.');
            return;
        }
        setBioError(false);
        setIsLoading(true);
        try {
            await yandexAuth.updateProfile({
                about: bio.trim(),
                loveLanguage: loveLanguage.trim(),
                culturePride: culturePride.trim(),
                familyMemory: familyMemory.trim(),
                stereotypeTrue: stereotypeTrue.trim(),
                stereotypeFalse: stereotypeFalse.trim()
            });
            router.replace('/onboarding/interests');
        } catch (error) {
            console.error(error);
            Alert.alert('Ошибка', 'Не удалось сохранить данные');
        } finally {
            setIsLoading(false);
        }
    };

    // 🔥 Scroll Handler
    const scrollViewRef = React.useRef<ScrollView>(null);

    const scrollToInput = (y: number) => {
        // Approximate scrolling + header offset
        scrollViewRef.current?.scrollTo({ y: y - 100, animated: true });
    };

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor={THEME.background} />
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={{ flex: 1 }}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
            >
                <ScrollView
                    ref={scrollViewRef}
                    contentContainerStyle={styles.scrollContent}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                >
                    <View style={styles.header}>
                        <Text style={styles.stepCount}>Шаг 3 из 6</Text>
                        <Text style={styles.title}>Личность</Text>
                        <Text style={styles.subtitle}>
                            Расскажите немного о себе. Это самое интересное.
                        </Text>
                    </View>

                    <View style={styles.formContent}>
                        <View style={styles.requiredContainer}>
                            <HookInputItem
                                label="Об о себе (Био) *"
                                value={bio}
                                onChange={(t) => { setBio(t); if (t) setBioError(false); }}
                                placeholder="Кто вы? Чем живете? Что ищете?"
                                multiline={true}
                                icon="person-outline"
                                hasError={bioError}
                                onFocus={() => scrollToInput(0)}
                            />
                        </View>

                        <View style={styles.divider} />
                        <View style={styles.sectionHeader}>
                            <Text style={styles.sectionTitle}>Детали (Можно пропустить)</Text>
                        </View>

                        <View style={styles.optionalContainer}>
                            <HookInputItem
                                label="Мой язык любви"
                                value={loveLanguage}
                                onChange={setLoveLanguage}
                                placeholder="Слова, подарки, время..."
                                icon="heart-outline"
                                onFocus={() => scrollToInput(250)}
                            />

                            <HookInputItem
                                label="Чем я больше всего горжусь в своей культуре"
                                value={culturePride}
                                onChange={setCulturePride}
                                placeholder="Гостеприимство, музыка, традиции..."
                                icon="earth-outline"
                                onFocus={() => scrollToInput(350)}
                            />

                            <HookInputItem
                                label="Любимое семейное воспоминание"
                                value={familyMemory}
                                onChange={setFamilyMemory}
                                placeholder="Как мы всей семьей..."
                                icon="people-outline"
                                onFocus={() => scrollToInput(450)}
                            />

                            <HookInputItem
                                label="Что для меня значит настоящая близость"
                                value={stereotypeTrue}
                                onChange={setStereotypeTrue}
                                placeholder="Доверие, общие цели, поддержка..."
                                icon="checkmark-circle-outline"
                                onFocus={() => scrollToInput(550)}
                            />

                            <HookInputItem
                                label="Чем я занимаюсь, когда хочу перезагрузиться"
                                value={stereotypeFalse}
                                onChange={setStereotypeFalse}
                                placeholder="Читаю, гуляю, смотрю сериалы..."
                                icon="close-circle-outline"
                                onFocus={() => scrollToInput(650)}
                            />
                        </View>
                    </View>

                    <View style={styles.footer}>
                        <PrimaryButton
                            title="Продолжить"
                            onPress={handleContinue}
                            isLoading={isLoading}
                            style={{ backgroundColor: '#2a2a2a' }}
                        />
                    </View>

                    {/* Extra spacing for scrolling past keyboard */}
                    <View style={{ height: 40 }} />
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: THEME.background },
    scrollContent: { flexGrow: 1 }, // Allows scrolling
    header: { padding: 20, paddingTop: 92 },
    stepCount: { fontSize: 12, color: '#000', marginBottom: 8, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 1 },
    title: { fontSize: 32, fontWeight: '300', color: THEME.text, marginBottom: 10 },
    subtitle: { fontSize: 16, color: THEME.subText },

    formContent: { padding: 20 },

    sectionHeader: { marginBottom: 15, marginTop: 10 },
    sectionTitle: { fontSize: 16, fontWeight: '600', color: THEME.text, opacity: 0.8 },

    requiredContainer: { marginBottom: 10 },
    optionalContainer: { gap: 15 },

    divider: { height: 1, backgroundColor: '#e0e0e0', marginVertical: 20 },

    inputGroup: { marginBottom: 10 },
    label: { fontSize: 14, color: THEME.subText, fontWeight: '500' },

    inputWrapper: {
        backgroundColor: THEME.inputBg,
        borderRadius: 16,
        borderWidth: 0,
        // 🔥 УБРАЛИ padding отсюда, чтобы кликабельная область инпута была максимальной
        paddingHorizontal: 0,
        shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.03, shadowRadius: 3, elevation: 1,
        justifyContent: 'center',
        overflow: 'hidden' // Чтобы инпут не вылезал за скругления
    },
    input: {
        color: THEME.text,
        fontSize: 16,
        // 🔥 ДОБАВИЛИ padding сюда. Теперь весь блок - это TextInput
        paddingHorizontal: 15,
        paddingVertical: 16,
        width: '100%',
    },

    footer: { padding: 20, paddingBottom: 40 },
});