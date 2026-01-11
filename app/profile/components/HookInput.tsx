// app/profile/components/HookInput.tsx
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { Colors } from '../../constants/colors';
import { useTheme } from '../../context/ThemeContext';

interface HookInputProps {
  label: string;
  value: string;
  onChange: (text: string) => void;
  placeholder: string;
  icon: keyof typeof Ionicons.glyphMap;
}

export default function HookInput({ label, value, onChange, placeholder, icon }: HookInputProps) {
  const { theme, themeType } = useTheme();
  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Ionicons name={icon} size={20} color={Colors.primary} />
        <Text style={[styles.label, { color: theme.text }]}>{label}</Text>
      </View>

      <TextInput
        style={[
          styles.input,
          {
            backgroundColor: themeType === 'space' ? 'rgba(18, 22, 40, 0.9)' : theme.cardBg,
            borderColor: theme.border,
            color: theme.text
          }
        ]}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={theme.subText}
        multiline
        numberOfLines={3}
        maxLength={300} // Ограничение, чтобы не писали поэмы
        autoCapitalize="sentences"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 24,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  label: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '600',
    flex: 1, // Чтобы текст переносился, если длинный
  },
  input: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    padding: 15,
    color: Colors.text,
    fontSize: 16,
    lineHeight: 22,
    minHeight: 80,
    textAlignVertical: 'top',
  },
});