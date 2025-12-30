// components/CulturalBackground.tsx
import React from 'react';
import { StyleSheet, View } from 'react-native';

export const CulturalBackground = () => {
  return (
    <View style={styles.background}>
      {/* Простой градиентный фон без иконок */}
      <View style={styles.gradientOverlay} />
    </View>
  );
};

const styles = StyleSheet.create({
  background: {
    ...StyleSheet.absoluteFillObject,
  },
  gradientOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(26, 15, 15, 0.3)',
  },
});