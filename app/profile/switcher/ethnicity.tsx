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
import { SelectableCard } from '../../components/ui/SelectableCard';
import { yandexAuth } from '../../services/yandex/AuthService';
import { ethnicityGroups } from '../../utils/ethnicities';

export default function EditEthnicityScreen() {
  const router = useRouter();
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
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#e1306c" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Хедер с кнопкой Назад */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#ffffff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Редактировать происхождение</Text>
        <View style={{ width: 24 }} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>

          {/* 1. Поле для ввода */}
          <View style={styles.section}>
            <Text style={styles.label}>Ваша национальность</Text>
            <View style={styles.inputWrapper}>
              <TextInput
                style={styles.input}
                placeholder="Например: Русский"
                placeholderTextColor="#666"
                value={customEthnicity}
                onChangeText={setCustomEthnicity}
                autoCapitalize="words"
              />
              {customEthnicity.length > 0 && (
                <TouchableOpacity onPress={() => setCustomEthnicity('')}>
                  <Ionicons name="close-circle" size={20} color="#666" />
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* 2. Макрогруппы */}
          <View style={styles.section}>
            <Text style={styles.label}>Макрогруппы (Культурный код)</Text>
            <Text style={styles.hint}>
              Выберите группы, близкие вам по духу. Это влияет на рекомендации.
            </Text>
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
          </View>

        </ScrollView>

        <View style={styles.footer}>
          <PrimaryButton
            title="Сохранить изменения"
            onPress={handleSave}
            isLoading={isSaving}
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  centerContainer: { flex: 1, backgroundColor: '#0a0a0a', justifyContent: 'center', alignItems: 'center' },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 15, borderBottomWidth: 1, borderBottomColor: '#1a1a1a'
  },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#ffffff' },
  backButton: { padding: 5 },

  scrollContent: { padding: 20 },
  section: { marginBottom: 30 },

  label: { color: '#ffffff', fontSize: 18, fontWeight: '600', marginBottom: 10 },
  hint: { color: '#999', fontSize: 14, marginBottom: 15 },

  inputWrapper: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#1a1a1a', borderRadius: 12, borderWidth: 1, borderColor: '#333',
    paddingHorizontal: 15,
  },
  input: { flex: 1, color: '#ffffff', fontSize: 16, paddingVertical: 15 },

  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 10 },
  footer: { padding: 20, paddingBottom: 40, borderTopWidth: 1, borderTopColor: '#1a1a1a' },
});