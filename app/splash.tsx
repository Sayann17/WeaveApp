import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Dimensions,
  Image,
  StatusBar,
  StyleSheet,
  View,
} from 'react-native';

const { width, height } = Dimensions.get('window');

export default function SplashScreen({ onFinish }: { onFinish: () => void }) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;

  useEffect(() => {
    // Небольшая задержка перед стартом
    setTimeout(() => {
        Animated.parallel([
          Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(scaleAnim, {
            toValue: 1, // Доводим масштаб до нормы
            duration: 1000,
            useNativeDriver: true,
          })
        ]).start(() => {
          setTimeout(onFinish, 500);
        });
    }, 100)
  }, []);

  return (
    <View style={styles.container}>
      {/* Скрываем статус бар, чтобы картинка была на весь экран чисто */}
      <StatusBar hidden />

      <Animated.View
        style={{
          flex: 1,
          opacity: fadeAnim,
          transform: [{ scale: scaleAnim }],
        }}
      >
        {/* resizeMode="cover" - заставит картинку заполнить ВЕСЬ экран.
           Если на картинке есть фон, он станет фоном приложения.
           Логотип будет по центру (если он по центру картинки).
        */}
        <Image 
          source={require('../assets/images/logo.jpg')} 
          style={styles.fullscreenImage}
          resizeMode="cover" 
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000', // Цвет подложки на всякий случай (не будет виден)
  },
  fullscreenImage: {
    width: width,
    height: height,
  },
});