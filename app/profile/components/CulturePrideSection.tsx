// app/profile/components/CulturePrideSection.tsx
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { useTheme } from '../../context/ThemeContext';

interface CulturePrideSectionProps {
  text: string;
  setText: (text: string) => void;
}

export default function CulturePrideSection({ text, setText }: CulturePrideSectionProps) {
  const { theme, themeType } = useTheme();

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Ionicons name="heart-outline" size={20} color={themeType === 'light' ? theme.accent : theme.icon} />
        <Text style={[styles.label, { color: theme.text }]}>Чем ты гордишься в своей культуре?</Text>
      </View>

      <TextInput
        style={[
          styles.input,
          {
            backgroundColor: theme.cardBg,
            borderColor: theme.border,
            color: theme.text
          }
        ]}
        value={text}
        onChangeText={setText}
        placeholder="Например: Гостеприимство, музыка, уважение к старшим..."
        placeholderTextColor={theme.subText}
        multiline
        numberOfLines={3}
        maxLength={300}
        autoCapitalize="sentences"
        selectionColor={themeType === 'light' ? '#000000' : '#FFFFFF'}
      />
      <Text style={[styles.hint, { color: theme.subText }]}>
        Это поможет найти людей со схожими ценностями.
      </Text>
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
    fontSize: 16,
    fontWeight: '600',
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 15,
    fontSize: 15,
    lineHeight: 22,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  hint: {
    fontSize: 12,
    marginTop: 6,
    marginLeft: 4,
  }
});