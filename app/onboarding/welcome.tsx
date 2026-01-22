// app/onboarding/welcome.tsx
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  Animated,
  Dimensions,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { ProfileCarousel } from '../components/ProfileCarousel';
import { yandexAuth } from '../services/yandex/AuthService';


const { width } = Dimensions.get('window');

// Цвета для новой темы
const THEME = {
  background: '#f4f4e7',
  text: '#1c1c1e',
  subText: '#555555',
  accent: '#2a2a2a',
};

// 3 слайда онбординга
const SLIDES = [
  {
    id: 'welcome',
    title: (name: string) => `Привет, ${name}! Добро пожаловать в Weave :)`,
    topText: 'Мы создали пространство, где тебе будет комфортно искать своих людей',
    bottomText: 'Мы искренне рады, что ты теперь с нами, ведь Weave — это про глубину, а не поверхностное скольжение.',
  },
  {
    id: 'preferences',
    title: () => 'Твои предпочтения — это основа',
    topText: 'В Weave ты не будешь чувствовать себя лишним',
    bottomText: 'Фундамент, на котором плетутся самые крепкие связи — это твоя идентичность.',
  },
  {
    id: 'start',
    title: () => 'Время создавать',
    topText: 'Чтобы помочь тебе сплести твой узор, нам нужно немного узнать о тебе',
    bottomText: 'Начни свой путь в Weave, создай анкету и сплети свою судьбу!',
  },
];

export default function WelcomeScreen() {
  const router = useRouter();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userName, setUserName] = useState('Путешественник');
  const [fadeAnim] = useState(new Animated.Value(1));

  // Загружаем имя пользователя
  useEffect(() => {
    const fetchUserName = async () => {
      try {
        const user = yandexAuth.getCurrentUser();
        if (user && user.displayName) {
          setUserName(user.displayName);
        }
      } catch (error) {
        console.log('Error fetching name:', error);
      }
    };
    fetchUserName();
  }, []);

  const handleNext = () => {
    if (currentIndex < SLIDES.length - 1) {
      // Анимация fade для плавного перехода текста
      Animated.sequence([
        Animated.timing(fadeAnim, { toValue: 0, duration: 150, useNativeDriver: true }),
        Animated.timing(fadeAnim, { toValue: 1, duration: 150, useNativeDriver: true }),
      ]).start();

      setCurrentIndex(prev => prev + 1);
    } else {
      router.replace('/onboarding/gender');
    }
  };

  const currentSlide = SLIDES[currentIndex];

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={THEME.background} />

      <View style={styles.content}>
        {/* Верхний текст */}
        <Animated.View style={[styles.headerContainer, { opacity: fadeAnim }]}>
          <Text style={styles.title}>
            {typeof currentSlide.title === 'function'
              ? currentSlide.title(userName)
              : currentSlide.title}
          </Text>
          <Text style={styles.topText}>{currentSlide.topText}</Text>
        </Animated.View>

        {/* Карусель - постоянный элемент */}
        <View style={styles.carouselWrapper}>
          <ProfileCarousel slideIndex={currentIndex} />
        </View>

        {/* Нижний текст */}
        <Animated.View style={[styles.bottomContainer, { opacity: fadeAnim }]}>
          <Text style={styles.bottomText}>{currentSlide.bottomText}</Text>
        </Animated.View>
      </View>

      {/* Футер */}
      <View style={styles.footer}>
        {/* Индикаторы прогресса */}
        <View style={styles.progressContainer}>
          {SLIDES.map((_, index) => (
            <View
              key={index}
              style={[
                styles.progressBar,
                currentIndex === index ? styles.progressBarActive : styles.progressBarInactive
              ]}
            />
          ))}
        </View>

        <TouchableOpacity style={styles.mainButton} onPress={handleNext}>
          <Text style={styles.buttonText}>
            {currentIndex === SLIDES.length - 1 ? 'Начать путь' : 'Далее'}
          </Text>
          <Ionicons
            name="arrow-forward"
            size={20}
            color="#fff"
            style={{ marginLeft: 8 }}
          />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.background,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 92,
  },

  // Верхний блок с заголовком
  headerContainer: {
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
    color: THEME.text,
    textAlign: 'left',
    lineHeight: 32,
  },
  topText: {
    fontSize: 16,
    color: THEME.subText,
    textAlign: 'left',
    lineHeight: 22,
    marginTop: 8,
  },

  // Карусель
  carouselWrapper: {
    flex: 1,
    justifyContent: 'center',
  },

  // Нижний текст
  bottomContainer: {
    paddingVertical: 20,
  },
  bottomText: {
    fontSize: 15,
    color: THEME.subText,
    textAlign: 'left',
    lineHeight: 22,
    fontStyle: 'italic',
  },

  // Футер
  footer: {
    paddingHorizontal: 30,
    paddingBottom: 50,
    justifyContent: 'flex-end',
  },

  // Прогресс-бар
  progressContainer: {
    flexDirection: 'row',
    marginBottom: 30,
    gap: 8,
  },
  progressBar: {
    height: 2,
    flex: 1,
    borderRadius: 1,
  },
  progressBarActive: {
    backgroundColor: THEME.text,
  },
  progressBarInactive: {
    backgroundColor: 'rgba(28, 28, 30, 0.1)',
  },

  // Кнопка
  mainButton: {
    backgroundColor: THEME.accent,
    paddingVertical: 18,
    borderRadius: 14,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 3,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
});