// app/profile/switcher/ethnicity.tsx
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { PrimaryButton } from '../../components/ui/PrimaryButton';
import { yandexAuth } from '../../services/yandex/AuthService';
import { ethnicityGroups } from '../../utils/ethnicities';
import { useTheme } from '../../context/ThemeContext';
import { ThemedBackground } from '../../components/ThemedBackground';

export default function EditEthnicityScreen() {
  const router = useRouter();
  const { theme, themeType } = useTheme();
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
  const [customEthnicity, setCustomEthnicity] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // 1. Загружаем данные при открытии
  useEffect(() => {
    const loadData = async () => {
      try {
        const currentUser = yandexAuth.getCurrentUser();
        if (!currentUser) return;

        const data = currentUser as any;
        setSelectedGroups(data.macroGroups || data.macro_groups || []);
        setCustomEthnicity(data.customEthnicity || data.ethnicity || '');
      } catch (error) {
        console.error(error);
        Alert.alert('Ошибка', 'Не удалось загрузить данные');
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, []);

  const toggleGroup = (groupId: string) => {
    setSelectedGroups(prev => {
      if (prev.includes(groupId)) return prev.filter(id => id !== groupId);
      if (prev.length >= 3) {
        Alert.alert('Ограничение', 'Можно выбрать не более 3 макрогрупп');
        return prev;
      }
      return [...prev, groupId];
    });
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const currentUser = yandexAuth.getCurrentUser();
      if (currentUser) {
        await yandexAuth.updateProfile({
          macroGroups: selectedGroups,
          ethnicity: customEthnicity.trim(),
        });
        // Возвращаемся назад в профиль
        router.back();
      }
    } catch (error) {
      console.error(error);
      Alert.alert('Ошибка', 'Не удалось сохранить изменения');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <View style={[styles.centerContainer, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color="#81B29A" />
      </View>
    );
  }

  return (
    <ThemedBackground>
      <View style={styles.container}>
        {/* 
         🔥 ВАЖНОЕ ИЗМЕНЕНИЕ: 
         Супер-большой паддинг сверху, чтобы контент начинался НИЖЕ системных кнопок.
         Telegram WebApp Header обычно занимает около 60-80px, плюс статус бар.
      */}
        <View style={{ flex: 1, paddingTop: 120 }}>

          <View style={styles.header}>
            {/* Кнопка "Назад" убрана из UI, полагаемся на системный жест или кнопку BackButton (если есть) */}
            <Text style={[styles.headerTitle, { color: theme.text }]}>Редактировать происхождение</Text>
          </View>

          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={{ flex: 1 }}
          >
            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={[styles.scrollContent, { paddingBottom: 100 }]}
            >

              {/* 1. Поле для ввода */}
              <View style={styles.section}>
                <Text style={[styles.label, { color: theme.text }]}>Ваша национальность</Text>
                <View style={[styles.inputWrapper, {
                  backgroundColor: theme.cardBg,
                  borderColor: theme.border
                }]}>
                  <TextInput
                    style={[styles.input, { color: theme.text }]}
                    placeholder="Например: Русский"
                    placeholderTextColor={theme.subText}
                    value={customEthnicity}
                    onChangeText={setCustomEthnicity}
                    autoCapitalize="words"
                    selectionColor={themeType === 'light' ? '#000000' : '#FFFFFF'}
                  />
                  {customEthnicity.length > 0 && (
                    <TouchableOpacity onPress={() => setCustomEthnicity('')}>
                      <Ionicons name="close-circle" size={20} color={theme.subText} />
                    </TouchableOpacity>
                  )}
                </View>
              </View>

              {/* 2. Макрогруппы */}
              <View style={styles.section}>
                <Text style={[styles.label, { color: theme.text }]}>Культурный код (твои корни)</Text>
                <Text style={[styles.hint, { color: theme.subText }]}>
                  Выберите группы, близкие вам по духу. Это влияет на рекомендации.
                </Text>
                <View style={styles.grid}>
                  {ethnicityGroups.map((group, index) => {
                    const isSelected = selectedGroups.includes(group.id);
                    return (
                      <TouchableOpacity
                        key={group.id}
                        style={[
                          styles.card,
                          {
                            backgroundColor: theme.cardBg,
                            borderColor: theme.border,
                            // 🔥 Мятная обводка при выборе
                            ...(isSelected && { borderColor: '#10b981', borderWidth: 2 }),
                          }
                        ]}
                        onPress={() => toggleGroup(group.id)}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.emoji}>{group.emoji}</Text>
                        <Text style={[
                          styles.title,
                          { color: theme.text },
                          isSelected && { color: '#10b981', fontWeight: 'bold' }
                        ]}>
                          {group.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            </ScrollView>

            <View style={[styles.footer, {
              backgroundColor: themeType === 'space' ? 'transparent' : theme.background,
              borderTopColor: themeType === 'space' ? 'transparent' : theme.border,
              borderTopWidth: themeType === 'space' ? 0 : 1
            }]}>
              <PrimaryButton
                title="Сохранить"
                onPress={handleSave}
                isLoading={isSaving}
                style={{ backgroundColor: theme.accent || '#1c1c1e' }}
                textColor={theme.accentText || '#ffffff'}
              />
            </View>
          </KeyboardAvoidingView>
        </View>
      </View>
    </ThemedBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  header: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    alignItems: 'center',
  },
  headerTitle: { fontSize: 22, fontWeight: 'bold' },

  scrollContent: { padding: 20, paddingBottom: 150 }, // Enough padding for footer
  section: { marginBottom: 30 },

  label: { fontSize: 18, fontWeight: '600', marginBottom: 10 },
  hint: { fontSize: 14, marginBottom: 15 },

  inputWrapper: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 12, borderWidth: 1,
    paddingHorizontal: 15,
  },
  input: { flex: 1, fontSize: 16, paddingVertical: 15 },

  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 10 },

  card: {
    width: '48%',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  emoji: { fontSize: 32 },
  title: { fontSize: 14, fontWeight: '500', textAlign: 'center' },

  footer: {
    padding: 20,
    borderTopWidth: 1,
    // position: 'relative', // Changed from absolute to relative to sit at bottom of flex container
    paddingBottom: 40
  },
});