// app/onboarding/welcome.tsx
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  Dimensions,
  FlatList,
  NativeScrollEvent,
  NativeSyntheticEvent,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { ProfileCarousel } from '../components/ProfileCarousel';
import { yandexAuth } from '../services/yandex/AuthService'; // removed


const { width, height } = Dimensions.get('window');

// Цвета для новой темы
const THEME = {
  background: '#f4f4e7',
  text: '#1c1c1e',
  subText: '#555555',
  accent: '#2a2a2a',
};

// Carousel Config
const CONTAINER_PADDING = 20;
const AVAILABLE_WIDTH = width - (CONTAINER_PADDING * 2);
const CARD_WIDTH = AVAILABLE_WIDTH * 0.65; // Central card takes 65% of width
const CARD_HEIGHT = CARD_WIDTH * (16 / 9);
const SPACER_WIDTH = (AVAILABLE_WIDTH - CARD_WIDTH) / 2; // Space to center the card

const PROFILE_IMAGES = [
  require('../../assets/images/onboarding_card_1.jpg'),
  require('../../assets/images/onboarding_card_2.jpg'),
  require('../../assets/images/onboarding_card_3.jpg'),
];

const SLIDES = [
  {
    id: 'welcome',
    icon: 'sparkles-outline',
    title: 'Рады тебя приветствовать!', // Generic title as requested
    subtitle: 'Добро пожаловать в Weave. Здесь начинаются истории, основанные на понимании.',
  },
  {
    id: 'culture',
    icon: 'finger-print-outline',
    title: () => 'Культурный код',
    subtitle: 'Твое происхождение — это не просто графа в анкете. Это фундамент, на котором строятся самые крепкие связи.',
  },
  {
    id: 'values',
    icon: 'infinite-outline', // Заменил сердце на бесконечность (более философски)
    title: () => 'Глубина важнее',
    subtitle: 'Мы против поверхностного скольжения. Мы создали пространство для тех, кто ищет человека своего менталитета.',
  },
  {
    id: 'start',
    icon: 'hourglass-outline',
    title: () => 'Время создавать',
    subtitle: 'Чтобы алгоритм нашел твоих людей, нам нужно немного узнать о тебе. Это займет всего пару минут.',
  },
];

export default function WelcomeScreen() {
  const router = useRouter();
  const flatListRef = useRef<FlatList>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userName, setUserName] = useState('Путешественник');

  // import { auth, firestore } from '../config/firebase';


  // ...

  // 🔥 ИСПРАВЛЕНИЕ: Загружаем реальное имя из сервиса авторизации
  useEffect(() => {
    const fetchUserName = async () => {
      try {
        const user = yandexAuth.getCurrentUser();
        console.log('WelcomeScreen user:', user);
        if (user && user.displayName) {
          setUserName(user.displayName);
        }
      } catch (error) {
        console.log('Error fetching name:', error);
      }
    };
    fetchUserName();
  }, []);

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const slideIndex = Math.round(event.nativeEvent.contentOffset.x / width);
    setCurrentIndex(slideIndex);
  };

  const handleNext = () => {
    if (currentIndex < SLIDES.length - 1) {
      flatListRef.current?.scrollToIndex({ index: currentIndex + 1 });
    } else {
      router.replace('/onboarding/gender');
    }
  };

  const renderItem = ({ item }: { item: typeof SLIDES[0] }) => (
    <View style={styles.slide}>
      <View style={styles.visualContainer}>
        {item.id === 'welcome' ? (
          <ProfileCarousel />
        ) : (
          <View style={styles.iconCircle}>
            <Ionicons name={item.icon as any} size={48} color={THEME.text} style={{ opacity: 0.8 }} />
          </View>
        )}
      </View>

      <View style={styles.textContainer}>
        <Text style={styles.title}>
          {typeof item.title === 'string' ? item.title : (item.title as any)(userName)}
        </Text>
        <View style={styles.separator} />
        <Text style={styles.subtitle}>{item.subtitle}</Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={THEME.background} />

      <FlatList
        ref={flatListRef}
        style={{ flex: 1 }}
        data={SLIDES}
        renderItem={renderItem}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        keyExtractor={(item) => item.id}
        bounces={false} // Отключаем пружину для строгости
        getItemLayout={(data, index) => ({
          length: width,
          offset: width * index,
          index,
        })}
        onScrollToIndexFailed={(info) => {
          const wait = new Promise((resolve) => setTimeout(resolve, 500));
          wait.then(() => {
            flatListRef.current?.scrollToIndex({ index: info.index, animated: true });
          });
        }}
      />

      {/* Панель управления снизу */}
      <View style={styles.footer}>

        {/* Индикаторы прогресса (Линии вместо точек - более стильно) */}
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
  slide: {
    width: width,
    flex: 1,
    paddingHorizontal: CONTAINER_PADDING,
    paddingTop: 80, // Reduced further to allow space for taller cards
  },

  // Визуальная часть (Иконка или Карточки)
  visualContainer: {
    flex: 1,
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingBottom: 20,
    marginTop: 20,
  },
  // cardsContainer & cardWrapper moved to ProfileCarousel

  iconCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 1,
    borderColor: 'rgba(28, 28, 30, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    marginTop: 60,
  },

  // Текстовая часть
  textContainer: {
    justifyContent: 'flex-end',
    paddingTop: 30,
    marginBottom: 10, // Closer to footer
  },
  title: {
    fontSize: 34, // Slightly adjusted for balance
    fontWeight: '300',
    color: THEME.text,
    textAlign: 'left',
    lineHeight: 40,
    fontFamily: 'System',
  },
  separator: {
    width: 40,
    height: 2,
    backgroundColor: THEME.text,
    marginTop: 15,
    marginBottom: 15,
    opacity: 0.2,
  },
  subtitle: {
    fontSize: 16,
    color: THEME.subText,
    textAlign: 'left',
    lineHeight: 24,
    fontWeight: '400',
  },

  // Футер
  footer: {
    paddingHorizontal: 30,
    paddingBottom: 50,
    justifyContent: 'flex-end',
  },

  // Прогресс-бар (линии)
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