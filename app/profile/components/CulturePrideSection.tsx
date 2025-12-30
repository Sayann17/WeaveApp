// app/profile/components/CulturePrideSection.tsx
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { Colors } from '../../constants/colors';

interface CulturePrideSectionProps {
  text: string;
  setText: (text: string) => void;
}

export default function CulturePrideSection({ text, setText }: CulturePrideSectionProps) {
  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Ionicons name="heart-outline" size={20} color={Colors.primary} />
        <Text style={styles.label}>Чем ты гордишься в своей культуре?</Text>
      </View>

      <TextInput
        style={styles.input}
        value={text}
        onChangeText={setText}
        placeholder="Например: Гостеприимство, музыка, уважение к старшим..."
        placeholderTextColor={Colors.textMuted}
        multiline
        numberOfLines={3}
        maxLength={300}
        autoCapitalize="sentences"
      />
      <Text style={styles.hint}>
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
    color: Colors.text,
    fontSize: 16,
    fontWeight: '600',
  },
  input: {
    backgroundColor: Colors.card, // Полупрозрачный фон
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    padding: 15,
    color: Colors.text,
    fontSize: 15,
    lineHeight: 22,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  hint: {
    color: Colors.textMuted,
    fontSize: 12,
    marginTop: 6,
    marginLeft: 4,
  }
});