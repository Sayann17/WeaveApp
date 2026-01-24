// app/profile/edit.tsx
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../constants/colors';
import { useTelegram } from '../context/TelegramProvider';
import { useTheme } from '../context/ThemeContext';
import { yandexAuth } from '../services/yandex/AuthService';
import { normalize } from '../utils/normalize';
import { getPlatformPadding } from '../utils/platformPadding';

// Компоненты секций
import BasicInfoSection from './components/BasicInfoSection';
import EthnicitySection from './components/EthnicitySection';
import GenderSection from './components/GenderSection';
import HookInput from './components/HookInput';
import InterestsSection from './components/InterestsSection';
import PhotoSection from './components/PhotoSection';
import ReligionSection from './components/ReligionSection';
import ZodiacSection from './components/ZodiacSection';

// Модальные окна
import { ThemedBackground } from '../components/ThemedBackground';
import { PrimaryButton } from '../components/ui/PrimaryButton';
import InterestsModal from './components/modals/InterestsModal';
import ZodiacModal from './components/modals/ZodiacModal';

export default function EditProfileScreen() {
  const router = useRouter();
  const { theme, themeType } = useTheme();
  const insets = useSafeAreaInsets();
  const { setBackButtonHandler, showBackButton, hideBackButton, isMobile } = useTelegram();
  const params = useLocalSearchParams();
  const isFirstEdit = params.firstEdit === 'true';

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // --- Состояние данных ---
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [bio, setBio] = useState('');
  const [gender, setGender] = useState<'male' | 'female' | null>(null);
  const [photos, setPhotos] = useState<string[]>([]);
  const [interests, setInterests] = useState<string[]>([]);
  const [zodiac, setZodiac] = useState<string | null>(null);
  const [religions, setReligions] = useState<string[]>([]);
  const [macroGroups, setMacroGroups] = useState<string[]>([]);
  const [ethnicities, setEthnicities] = useState<string[]>([]);

  const [showInterestsModal, setShowInterestsModal] = useState(false);
  const [showZodiacModal, setShowZodiacModal] = useState(false);

  // Social Links State
  const [socialTelegram, setSocialTelegram] = useState('');
  const [socialVk, setSocialVk] = useState('');
  const [socialInstagram, setSocialInstagram] = useState('');

  const [culturePride, setCulturePride] = useState('');
  const [loveLanguage, setLoveLanguage] = useState('');
  const [familyMemory, setFamilyMemory] = useState('');
  const [stereotypeTrue, setStereotypeTrue] = useState('');
  const [stereotypeFalse, setStereotypeFalse] = useState('');

  // Location State
  const [city, setCity] = useState('');
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [isLocationLoading, setIsLocationLoading] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadUserData();
    }, [])
  );

  // Telegram BackButton handler
  useEffect(() => {
    showBackButton();
    setBackButtonHandler(() => {
      router.back(); // Navigate back without saving
    });

    return () => {
      hideBackButton();
      setBackButtonHandler(null);
    };
  }, []);

  const loadUserData = async () => {
    console.log('[EditProfile] Loading user data started');
    try {
      const currentUser = yandexAuth.getCurrentUser();
      console.log('[EditProfile] Current user:', currentUser ? 'Found' : 'Null');

      if (!currentUser) {
        Alert.alert('Ошибка', 'Пользователь не найден. Попробуйте перезайти.');
        return;
      }

      const data = currentUser as any;
      console.log('[EditProfile] Setting state...');
      setName(data.name || '');
      setAge(data.age ? data.age.toString() : '');
      setBio(data.bio || data.about || '');
      setGender(data.gender || null);
      setPhotos(data.photos || []);
      setInterests(data.interests || []);
      setZodiac(data.zodiac || null);
      setReligions(data.religions || data.religion || []);
      setMacroGroups(data.macroGroups || data.macro_groups || []);
      setEthnicities(data.ethnicity ? [data.ethnicity] : []);

      setCulturePride(data.culturePride || '');
      setLoveLanguage(data.loveLanguage || '');
      setFamilyMemory(data.familyMemory || '');
      setStereotypeTrue(data.stereotypeTrue || '');
      setStereotypeFalse(data.stereotypeFalse || '');

      setCity(data.city || '');
      setLatitude(data.latitude || null);
      setLongitude(data.longitude || null);

      setSocialTelegram(data.socialTelegram || '');
      setSocialVk(data.socialVk || '');
      setSocialInstagram(data.socialInstagram || '');

      console.log('[EditProfile] State set successfully');
    } catch (error) {
      console.error('[EditProfile] Error loading user data:', error);
      Alert.alert('Ошибка', 'Не удалось загрузить данные профиля');
    } finally {
      console.log('[EditProfile] Loading finished, setting isLoading = false');
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!name.trim() || !age.trim() || !gender) {
      Alert.alert('Ошибка', 'Пожалуйста, заполните Имя, Возраст и Пол');
      return;
    }

    // Проверка наличия фото
    if (photos.length === 0) {
      Alert.alert('Ошибка', 'Пожалуйста, добавьте хотя бы одно фото');
      return;
    }

    // Проверка этноса
    if (ethnicities.length === 0) {
      Alert.alert('Внимание', 'Пожалуйста, укажите ваши данные в разделе "Твои корни" (этническая принадлежность)');
      return;
    }

    setIsSaving(true);
    try {
      const currentUser = yandexAuth.getCurrentUser();
      if (!currentUser) return;

      const ageNum = parseInt(age);
      if (isNaN(ageNum) || ageNum < 18 || ageNum > 100) {
        Alert.alert('Ошибка', 'Пожалуйста, укажите корректный возраст (18-100)');
        setIsSaving(false);
        return;
      }

      await yandexAuth.updateProfile({
        name: name.trim(),
        age: ageNum,
        bio: bio.trim(),
        gender,
        photos,
        interests,
        zodiac: zodiac || undefined,
        religions,
        macroGroups,
        ethnicity: ethnicities[0] || '',
        profile_completed: 1,
        culturePride: culturePride.trim(),
        loveLanguage: loveLanguage.trim(),
        familyMemory: familyMemory.trim(),
        stereotypeTrue: stereotypeTrue.trim(),
        stereotypeFalse: stereotypeFalse.trim(),
        city: city.trim(),
        latitude: latitude !== null ? latitude : undefined,
        longitude: longitude !== null ? longitude : undefined,
        socialTelegram: socialTelegram.trim(),
        socialVk: socialVk.trim(),
        socialInstagram: socialInstagram.trim()
      });

      if (isFirstEdit) {
        router.replace('/(tabs)');
      } else {
        router.back();
      }
    } catch (error) {
      console.error('Error saving profile:', error);
      Alert.alert('Ошибка', 'Не удалось сохранить профиль');
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateLocation = () => {
    setIsLocationLoading(true);
    // @ts-ignore
    const Telegram = window.Telegram;

    if (Telegram?.WebApp?.LocationManager) {
      Telegram.WebApp.LocationManager.init(() => {
        Telegram.WebApp.LocationManager.getLocation((data: any) => {
          if (data) {
            setLatitude(data.latitude);
            setLongitude(data.longitude);
            Alert.alert('Успех', 'Геолокация обновлена!');
          } else {
            Alert.alert('Ошибка', 'Не удалось получить геопозицию. Проверьте настройки Telegram.');
          }
          setIsLocationLoading(false);
        });
      });
    } else {
      Alert.alert('Ошибка', 'Геолокация недоступна в этом клиенте. Попробуйте на мобильном устройстве.');
      setIsLocationLoading(false);
    }
  };

  const isFormValid =
    name.trim().length > 0 &&
    age.trim().length > 0 &&
    gender !== null &&
    photos.length > 0 &&
    ethnicities.length > 0;

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.background, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={{ marginTop: 10, color: theme.text }}>Загрузка...</Text>
      </View>
    );
  }

  return (
    <ThemedBackground>
      <View style={styles.container}>
        <View style={{ flex: 1, paddingTop: getPlatformPadding(insets, isMobile, 78) }}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={{ flex: 1 }}
          >
            <View style={[styles.header, { borderBottomColor: theme.border }]}>
              <Text style={[styles.headerTitle, { color: theme.text }]}>
                {isFirstEdit ? 'Заполните профиль' : 'Редактировать'}
              </Text>
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent}>

              {/* 1. Фото */}
              <PhotoSection
                photos={photos}
                setPhotos={setPhotos}
                isFirstEdit={isFirstEdit}
              />

              {/* 2. Имя и 3. Возраст */}
              <BasicInfoSection
                name={name} setName={setName}
                age={age} setAge={setAge}
                isFirstEdit={isFirstEdit}
              />

              {/* 3.5. Город и Локация */}
              <View style={{ marginBottom: 25 }}>
                <Text style={[styles.sectionTitle, { color: theme.text }]}>Где вы находитесь?</Text>

                <TextInput
                  style={[styles.input, {
                    backgroundColor: theme.cardBg,
                    borderColor: theme.border,
                    color: theme.text
                  }]}
                  placeholder="Ваш город (например, Москва)"
                  placeholderTextColor={theme.subText}
                  value={city}
                  onChangeText={setCity}
                  selectionColor={theme.selectionColor}
                  cursorColor={theme.selectionColor}
                />

                <TouchableOpacity
                  style={[styles.locationButton, { backgroundColor: theme.cardBg, borderColor: theme.border }]}
                  onPress={handleUpdateLocation}
                  disabled={isLocationLoading}
                >
                  {isLocationLoading ? (
                    <ActivityIndicator size="small" color={Colors.primary} />
                  ) : (
                    <Ionicons name="location-outline" size={20} color={Colors.primary} />
                  )}
                  <Text style={[styles.locationButtonText, { color: theme.text }]}>
                    {latitude && longitude ? 'Геолокация обновлена (GPS)' : 'Обновить геолокацию (GPS)'}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* 4. Вероисповедание */}
              <ReligionSection
                selectedReligions={religions}
                setSelectedReligions={setReligions}
              />

              {/* 4.5 Социальные сети */}
              <View style={styles.inputContainer}>
                <Text style={[styles.sectionTitle, { color: theme.text }]}>Соцсети (опционально)</Text>

                <View style={{ gap: 10 }}>
                  <TextInput
                    style={[styles.input, {
                      backgroundColor: theme.cardBg,
                      borderColor: theme.border,
                      color: theme.text
                    }]}
                    placeholder="Telegram (@username)"
                    placeholderTextColor={theme.subText}
                    value={socialTelegram}
                    onChangeText={setSocialTelegram}
                    autoCapitalize="none"
                    selectionColor={theme.selectionColor}
                    cursorColor={theme.selectionColor}
                  />
                  <TextInput
                    style={[styles.input, {
                      backgroundColor: theme.cardBg,
                      borderColor: theme.border,
                      color: theme.text
                    }]}
                    placeholder="ВКонтакте (ссылка или ID)"
                    placeholderTextColor={theme.subText}
                    value={socialVk}
                    onChangeText={setSocialVk}
                    autoCapitalize="none"
                    selectionColor={theme.selectionColor}
                    cursorColor={theme.selectionColor}
                  />
                  <TextInput
                    style={[styles.input, {
                      backgroundColor: theme.cardBg,
                      borderColor: theme.border,
                      color: theme.text
                    }]}
                    placeholder="Instagram (@username)"
                    placeholderTextColor={theme.subText}
                    value={socialInstagram}
                    onChangeText={setSocialInstagram}
                    autoCapitalize="none"
                    selectionColor={theme.selectionColor}
                    cursorColor={theme.selectionColor}
                  />
                </View>
              </View>

              {/* 5. Знак зодиака */}
              <ZodiacSection
                zodiac={zodiac}
                setZodiac={setZodiac}
                onEditPress={() => setShowZodiacModal(true)}
              />

              {/* 6. Твои корни */}
              <EthnicitySection
                ethnicities={ethnicities}
                macroGroups={macroGroups}
                isFirstEdit={isFirstEdit}
                onEditPress={() => router.push('/profile/switcher/ethnicity')}
              />

              {/* 7. О себе */}
              <View style={styles.inputContainer}>
                <Text style={[styles.sectionTitle, { color: theme.text }]}>О себе</Text>
                <TextInput
                  style={[
                    styles.input,
                    styles.bioInput,
                    {
                      backgroundColor: themeType === 'space' ? 'rgba(18, 22, 40, 0.9)' : theme.cardBg,
                      borderColor: theme.border,
                      color: theme.text
                    }
                  ]}
                  value={bio}
                  onChangeText={setBio}
                  multiline
                  numberOfLines={4}
                  placeholder="Расскажите о себе, своих увлечениях и мечтах..."
                  placeholderTextColor={theme.subText}
                  maxLength={500}
                  autoCapitalize="sentences"
                  selectionColor={theme.selectionColor}
                  cursorColor={theme.selectionColor}
                />
              </View>

              {/* 8. Пол */}
              <GenderSection
                gender={gender}
                setGender={setGender}
                isFirstEdit={isFirstEdit}
              />

              {/* 9-13. Детали (Хуки) */}
              <View style={styles.hooksBlock}>
                <Text style={[styles.sectionTitle, { color: theme.text }]}>Детали личности ✨</Text>

                {/* 9. Чем я горжусь */}
                <HookInput
                  label="Чем я горжусь в своей культуре"
                  value={culturePride}
                  onChange={setCulturePride}
                  placeholder="Гостеприимство, музыка, традиции..."
                  icon="trophy-outline"
                />

                {/* 10. Язык любви */}
                <HookInput
                  label="Мой язык любви"
                  value={loveLanguage}
                  onChange={setLoveLanguage}
                  placeholder="Слова поощрения, Подарки, Время..."
                  icon="heart-half-outline"
                />

                {/* 11. Семейное воспоминание */}
                <HookInput
                  label="Любимое семейное воспоминание"
                  value={familyMemory}
                  onChange={setFamilyMemory}
                  placeholder="Как мы всей семьей лепили пельмени..."
                  icon="people-outline"
                />

                {/* 12. Что значит близость */}
                <HookInput
                  label="Что для тебя значит настоящая близость?"
                  value={stereotypeTrue}
                  onChange={setStereotypeTrue}
                  placeholder="Доверие, общие цели, поддержка..."
                  icon="heart-outline"
                />

                {/* 13. Перезагрузка */}
                <HookInput
                  label="Чем ты занимаешься, когда хочешь перезагрузиться?"
                  value={stereotypeFalse}
                  onChange={setStereotypeFalse}
                  placeholder="Читаю, гуляю, смотрю сериалы..."
                  icon="refresh-outline"
                />
              </View>

              {/* 14. Интересы */}
              <InterestsSection
                interests={interests}
                onEditPress={() => setShowInterestsModal(true)}
              />

              {/* <View style={{ height: 100 }} />  Removed extra space */}
            </ScrollView>

            <View style={[
              styles.footer,
              {
                backgroundColor: themeType === 'space' ? 'transparent' : theme.background,
                borderTopColor: themeType === 'space' ? 'transparent' : theme.border,
                borderTopWidth: themeType === 'space' ? 0 : 1
              }
            ]}>
              <PrimaryButton
                title={isFirstEdit ? "Готово" : "Сохранить"}
                onPress={handleSave}
                isLoading={isSaving}
                disabled={!isFormValid}
                style={{ backgroundColor: theme.accent || '#1c1c1e' }}
                textColor={theme.accentText || '#ffffff'}
              />
            </View>

            <InterestsModal
              visible={showInterestsModal}
              interests={interests}
              setInterests={setInterests}
              onClose={() => setShowInterestsModal(false)}
            />

            <ZodiacModal
              visible={showZodiacModal}
              zodiac={zodiac}
              setZodiac={setZodiac}
              onClose={() => setShowZodiacModal(false)}
            />

          </KeyboardAvoidingView>
        </View>
      </View>
    </ThemedBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    // backgroundColor: Colors.background, // Removed to allow ThemedBackground to show
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: normalize(15),
    borderBottomWidth: 1,
    // borderBottomColor: Colors.border, // Removed to use dynamic theme.border in component
  },
  backButton: {
    padding: normalize(5),
  },

  hooksBlock: {
    marginTop: normalize(20),
    marginBottom: normalize(10),
    gap: normalize(15),
  },
  sectionTitle: {
    fontSize: normalize(18),
    fontWeight: 'bold',
    marginBottom: normalize(12),
    marginTop: normalize(10),
  },

  headerTitle: {
    fontSize: normalize(18),
    fontWeight: 'bold',
  },
  scrollContent: {
    padding: normalize(20),
  },
  footer: {
    padding: normalize(20),
    borderTopWidth: 1,
  },

  // Styles for Bio Input
  inputContainer: {
    marginBottom: normalize(25),
  },
  input: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)', // Default, will be overridden by theme
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: normalize(12),
    padding: normalize(16),
    fontSize: normalize(16),
  },
  bioInput: {
    height: normalize(120),
    textAlignVertical: 'top',
    lineHeight: normalize(22),
  },
  locationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: normalize(12),
    marginTop: normalize(10),
    borderRadius: normalize(12),
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  locationButtonText: {
    marginLeft: normalize(8),
    fontWeight: '500',
  }
});