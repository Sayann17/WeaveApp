// components/ui/SpaceBackground.tsx
import { LinearGradient } from 'expo-linear-gradient';
import React, { ReactNode, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Colors } from '../../constants/colors';

// Интерфейс для одной звезды
interface Star {
  id: number;
  top: string;    // Позиция в % по вертикали
  left: string;   // Позиция в % по горизонтали
  size: number;   // Размер (1-3 пикселя)
  opacity: number; // Яркость
}

// Количество звезд (можно настроить под себя)
const STAR_COUNT = 80; 

interface SpaceBackgroundProps {
  children: ReactNode;
  style?: any; // Чтобы можно было передавать дополнительные стили контейнера
}

export const SpaceBackground = ({ children, style }: SpaceBackgroundProps) => {
  const [stars, setStars] = useState<Star[]>([]);

  // Генерируем звезды только один раз при монтировании компонента
  useEffect(() => {
    const newStars: Star[] = [];
    for (let i = 0; i < STAR_COUNT; i++) {
      newStars.push({
        id: i,
        // Используем проценты, чтобы звезды распределялись по любому экрану
        top: `${Math.random() * 100}%`,
        left: `${Math.random() * 100}%`,
        // Случайный размер от 1 до 3.5 пикселей
        size: Math.random() * 2.5 + 1,
        // Случайная прозрачность от 0.3 до 0.9 (чтобы некоторые были тусклыми, некоторые яркими)
        opacity: Math.random() * 0.6 + 0.3,
      });
    }
    setStars(newStars);
  }, []);

  return (
    <View style={[styles.container, style]}>
      {/* 1. Базовый градиент */}
      <LinearGradient
        colors={Colors.backgroundGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill} // Растягиваем на весь контейнер
      />

      {/* 2. Слой со звездами */}
      <View style={styles.starsContainer} pointerEvents="none"> 
        {stars.map((star) => (
          <View
            key={star.id}
            style={{
              position: 'absolute',
              top: star.top as any,
              left: star.left as any,
              width: star.size,
              height: star.size,
              borderRadius: star.size / 2, // Делаем их круглыми
              backgroundColor: Colors.text, // Используем цвет "Слоновая кость" для звезд
              opacity: star.opacity,
              // Добавляем небольшое свечение тенью
              shadowColor: Colors.text,
              shadowOffset: { width: 0, height: 0 },
              shadowOpacity: 0.5,
              shadowRadius: 2,
            }}
          />
        ))}
      </View>

      {/* 3. Контент экрана (SafeAreaView и все остальное) */}
      <View style={styles.contentContainer}>
        {children}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: 'relative',
  },
  starsContainer: {
    ...StyleSheet.absoluteFillObject, // Занимает все место поверх градиента
    zIndex: 1, // Слой 1 (над градиентом)
  },
  contentContainer: {
    flex: 1,
    zIndex: 2, // Слой 2 (над звездами), чтобы кнопки нажимались
  },
});