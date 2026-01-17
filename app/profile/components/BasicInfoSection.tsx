import React from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';

interface BasicInfoSectionProps {
  name: string;
  setName: (name: string) => void;
  age: string;
  setAge: (age: string) => void;
  isFirstEdit: boolean;
}

export default function BasicInfoSection({
  name,
  setName,
  age,
  setAge,
  isFirstEdit
}: BasicInfoSectionProps) {
  const { theme, themeType } = useTheme();
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: theme.text }]}>Основная информация</Text>

      <View style={styles.inputContainer}>
        <Text style={[styles.label, { color: theme.text }]}>
          Имя {isFirstEdit && <Text style={styles.requiredStar}>*</Text>}
        </Text>
        <TextInput
          style={[
            styles.input,
            isFirstEdit && !name && styles.requiredField,
            {
              backgroundColor: themeType === 'space' ? 'rgba(18, 22, 40, 0.9)' : theme.cardBg,
              borderColor: theme.border,
              color: theme.text
            }
          ]}
          value={name}
          onChangeText={setName}
          placeholder="Введите ваше имя"
          placeholderTextColor={theme.subText}
          maxLength={50}
          autoCapitalize="words"
          selectionColor={themeType === 'light' ? '#000000' : '#FFFFFF'}
        />
      </View>

      <View style={styles.inputContainer}>
        <Text style={[styles.label, { color: theme.text }]}>
          Возраст {isFirstEdit && <Text style={styles.requiredStar}>*</Text>}
        </Text>
        <TextInput
          style={[
            styles.input,
            isFirstEdit && !age && styles.requiredField,
            {
              backgroundColor: themeType === 'space' ? 'rgba(18, 22, 40, 0.9)' : theme.cardBg,
              borderColor: theme.border,
              color: theme.text
            }
          ]}
          value={age}
          onChangeText={setAge}
          keyboardType="numeric"
          placeholder="Введите ваш возраст"
          placeholderTextColor={theme.subText}
          maxLength={3}
          selectionColor={themeType === 'light' ? '#000000' : '#FFFFFF'}
          textAlignVertical="center"
        />
      </View>
    </View>
  );
}

import { normalize } from '../../utils/normalize';

// ... imports

const styles = StyleSheet.create({
  section: {
    marginBottom: normalize(15),
  },
  sectionTitle: {
    fontSize: normalize(18),
    fontWeight: 'bold',
    marginBottom: normalize(15),
  },
  inputContainer: {
    marginBottom: normalize(15),
  },
  label: {
    fontSize: normalize(16),
    fontWeight: '600',
    marginBottom: normalize(8),
  },
  requiredStar: {
    color: '#e1306c',
  },
  input: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: normalize(12),
    padding: normalize(16),
    fontSize: normalize(16),
  },
  requiredField: {
    borderColor: '#e1306c',
    borderWidth: 2,
  },
});