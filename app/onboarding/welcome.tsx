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
import { yandexAuth } from '../services/yandex/AuthService'; // removed

const { width, height } = Dimensions.get('window');

// Цвета для новой темы
const THEME = {
  background: '#f4f4e7', // Твой новый цвет
  text: '#1c1c1e',       // Темный уголь для контраста
  subText: '#555555',    // Мягкий серый
  accent: '#2a2a2a',     // Почти черный для кнопок (стильно и строго)
  cardBg: '#ffffff',     // Белый для карточек
};

const SLIDES = [
  {
    id: 'welcome',
    icon: 'sparkles-outline',
    title: (name: string) => `Рады тебя приветствовать,\n${name}!`,
    subtitle: 'Добро пожаловать в Weave. Здесь начинаются истории, основанные на понимании, а не на случайности.',
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
      {/* Верхняя часть с "воздухом" и иконкой */}
      <View style={styles.visualContainer}>
        <View style={styles.iconCircle}>
          <Ionicons name={item.icon as any} size={48} color={THEME.text} style={{ opacity: 0.8 }} />
        </View>
      </View>

      {/* Нижняя часть с текстом */}
      <View style={styles.textContainer}>
        <Text style={styles.title}>
          {typeof item.title === 'function' ? item.title(userName) : item.title}
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
    paddingHorizontal: 30,
    paddingTop: 92, // 🔥 User specified padding
  },

  // Визуальная часть (Иконка)
  visualContainer: {
    flex: 1, // Занимает всё пространство до текста
    justifyContent: 'center', // Центр свободного места
    alignItems: 'center',
    paddingBottom: 20,
  },
  iconCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 1,
    borderColor: 'rgba(28, 28, 30, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
  },

  // Текстовая часть
  textContainer: {
    justifyContent: 'flex-end',
    marginBottom: 20, // Отступ от текста до футера
  },
  title: {
    fontSize: 36, // Крупный, журнальный заголовок
    fontWeight: '300', // Тонкое начертание (Elegant)
    color: THEME.text,
    textAlign: 'left', // Выравнивание по левому краю для стиля
    lineHeight: 44,
    fontFamily: 'System',
  },
  separator: {
    width: 40,
    height: 2,
    backgroundColor: THEME.text,
    marginTop: 20,
    marginBottom: 20,
    opacity: 0.2,
  },
  subtitle: {
    fontSize: 17,
    color: THEME.subText,
    textAlign: 'left',
    lineHeight: 26,
    fontWeight: '400',
  },

  // Футер
  footer: {
    paddingHorizontal: 30,
    paddingBottom: 50, // Оставляем хороший отступ снизу
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
    flex: 1, // Растягиваются равномерно
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
    backgroundColor: THEME.accent, // Темный строгий цвет
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
    textTransform: 'uppercase', // Делает текст кнопки более стильным
  },
});