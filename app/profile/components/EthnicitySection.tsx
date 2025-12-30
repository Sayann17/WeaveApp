// app/profile/components/EthnicitySection.tsx
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { getMacroGroupNameById } from '../../utils/ethnicities';

interface EthnicitySectionProps {
  macroGroups: string[];    // ID групп (например, ['slavic'])
  ethnicities: string[];  // Текст (например, "Русский")
  isFirstEdit: boolean;
  onEditPress: () => void;
}

export default function EthnicitySection({
  macroGroups,
  ethnicities,
  isFirstEdit,
  onEditPress
}: EthnicitySectionProps) {
  const { theme, themeType } = useTheme();

  // 1. Получаем названия групп
  const groupNames = (macroGroups || [])
    .map(id => getMacroGroupNameById(id))
    .join(', ');

  // 2. Отображаем: "Русский (Славянская)" или просто "Русский"
  const formattedEthnicity = (ethnicities || []).join(', ');
  const isEmpty = !formattedEthnicity && (!macroGroups || macroGroups.length === 0);

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>
          Твои корни {isFirstEdit && <Text style={styles.requiredStar}>*</Text>}
        </Text>
        <TouchableOpacity style={styles.editButton} onPress={onEditPress}>
          <Ionicons name="create-outline" size={20} color="#e1306c" />
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={[
          styles.ethnicityDisplayContainer,
          {
            backgroundColor: themeType === 'space' ? 'rgba(18, 22, 40, 0.9)' : theme.cardBg,
            borderColor: theme.border
          },
          isEmpty && isFirstEdit && styles.requiredField
        ]}
        onPress={onEditPress}
      >
        <View style={{ flex: 1 }}>
          {/* Сначала показываем то, что пользователь написал сам */}
          <Text style={[styles.mainText, { color: theme.text }]}>
            {formattedEthnicity || (isFirstEdit ? 'Укажите ваши корни' : 'Укажите ваши корни')}
          </Text>

          {/* Подписью показываем выбранную группу */}
          {groupNames ? (
            <Text style={[styles.subText, { color: theme.subText }]}>
              Группа: {groupNames}
            </Text>
          ) : null}
        </View>

        <Ionicons name="chevron-forward" size={20} color="#666" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginBottom: 30 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold' },
  requiredStar: { color: '#e1306c' },
  editButton: { padding: 5 },
  ethnicityDisplayContainer: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255, 255, 255, 0.05)',
    padding: 16, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.1)'
  },
  requiredField: { borderColor: '#e1306c' },
  mainText: { fontSize: 18, fontWeight: '600', marginBottom: 4 },
  subText: { color: '#999', fontSize: 14 }
});