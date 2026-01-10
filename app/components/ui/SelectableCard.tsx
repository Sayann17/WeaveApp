import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

interface SelectableCardProps {
  title: string;
  emoji: string;
  selected: boolean;
  onPress: () => void;
  index?: number;
}

export const SelectableCard = ({ title, emoji, selected, onPress }: SelectableCardProps) => {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.card,
        selected && styles.cardSelected
      ]}
    >
      <View style={styles.content}>
        {emoji ? <Text style={styles.emoji}>{emoji}</Text> : null}
        <Text style={[styles.title, selected && styles.titleSelected]}>{title}</Text>
      </View>
      {selected && (
        <View style={styles.checkIcon}>
          <Ionicons name="checkmark-circle" size={24} color="#e1306c" />
        </View>
      )}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#ffffff', // 🔥 БЕЛЫЙ ФОН
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#e0e0e0', // Легкая рамка
    alignItems: 'center',
    justifyContent: 'center',
    // Тень для объема
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    marginBottom: 10,
  },
  cardSelected: {
    borderColor: '#e1306c', // Розовая рамка при выборе
    backgroundColor: '#fff0f5', // Очень светло-розовый фон
  },
  content: {
    alignItems: 'center',
    gap: 10,
  },
  emoji: {
    fontSize: 40,
    marginBottom: 5,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1c1c1e', // Темный текст
    textAlign: 'center',
  },
  titleSelected: {
    color: '#e1306c',
    fontWeight: '700',
  },
  checkIcon: {
    position: 'absolute',
    top: 10,
    right: 10,
  }
});