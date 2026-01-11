import React from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity } from 'react-native';

interface PrimaryButtonProps {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  isLoading?: boolean;
  style?: any;
  textColor?: string;
}

export const PrimaryButton = ({ title, onPress, disabled, isLoading, style, textColor }: PrimaryButtonProps) => {
  return (
    <TouchableOpacity
      style={[
        styles.button,
        style,
        disabled && styles.disabled
      ]}
      onPress={onPress}
      disabled={disabled || isLoading}
      activeOpacity={0.8}
    >
      {isLoading ? (
        <ActivityIndicator color={textColor || "#ffffff"} />
      ) : (
        <Text style={[styles.text, textColor ? { color: textColor } : null]}>{title}</Text>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    backgroundColor: '#e1306c', // Дефолтный цвет (можно менять через style проп)
    paddingVertical: 18,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  disabled: {
    backgroundColor: '#cccccc', // Серый для неактивной
    shadowOpacity: 0,
  },
  text: {
    color: '#ffffff', // 🔥 БЕЛЫЙ ТЕКСТ ВСЕГДА
    fontSize: 16,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  }
});