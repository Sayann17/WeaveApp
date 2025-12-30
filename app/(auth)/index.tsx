// app/(auth)/index.tsx
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Image,
  StyleSheet,
  Text,
  View
} from 'react-native';
import { useTelegram } from '../context/TelegramProvider';
import { yandexAuth } from '../services/yandex/AuthService';

const { width, height } = Dimensions.get('window');

export default function AuthScreen() {
  const router = useRouter();
  const [error, setError] = useState('');

  // Telegram Integration
  const { isTelegram, user: tgUser } = useTelegram();

  useEffect(() => {
    const autoLogin = async () => {
      // Пните пользователя, если он не в телеграм
      if (!isTelegram) {
        // Для отладки в браузере. В проде можно показывать QR код
        console.warn('Приложение запущено вне Telegram. Авторизация может быть недоступна.');
      }

      if (isTelegram && tgUser) {
        console.log('Telegram Mini App detected, attempting auto-login');
        try {
          await yandexAuth.telegramLogin(tgUser);
          router.replace('/(tabs)');
        } catch (e) {
          console.error('Telegram auto-login failed:', e);
          setError('Ошибка входа через Telegram. Попробуйте перезапустить приложение.');
        }
      }
    };

    autoLogin();
  }, [isTelegram, tgUser]);

  return (
    <View style={styles.container}>
      {/* Фон - Логотип */}
      <Image
        source={require('../../assets/images/logo.jpg')}
        style={[StyleSheet.absoluteFill, styles.backgroundImage]}
        resizeMode="cover"
      />

      {/* Затемнение */}
      <View style={styles.overlay} />

      <View style={styles.content}>
        {/* ЗАГОЛОВОК */}
        <View style={styles.header}>
          <Text style={styles.titleMain}>Weave</Text>
          <Text style={styles.titleSlogan}>Переплетая судьбы...</Text>
        </View>

        {/* СТАТУС */}
        <View style={styles.statusContainer}>
          {error ? (
            <Text style={styles.errorText}>{error}</Text>
          ) : (
            <>
              <ActivityIndicator size="large" color="#69f0ae" style={{ marginBottom: 20 }} />
              <Text style={styles.statusText}>
                {isTelegram ? 'Выполняется вход...' : 'Пожалуйста, откройте приложение через Telegram'}
              </Text>
            </>
          )}
        </View>

      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  backgroundImage: {
    width: width,
    height: height,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    zIndex: 10,
  },
  header: {
    alignItems: 'center',
    marginBottom: 80,
  },
  titleMain: {
    fontFamily: 'CormorantGaramond_700Bold',
    fontSize: 64,
    color: '#ffffff',
    marginBottom: 0,
    includeFontPadding: false,
    lineHeight: 70,
  },
  titleSlogan: {
    fontFamily: 'CormorantGaramond_400Regular_Italic',
    fontSize: 24,
    color: '#ffffff',
    opacity: 0.9,
    marginTop: -5,
  },
  statusContainer: {
    alignItems: 'center',
    padding: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 16,
  },
  statusText: {
    color: '#fff',
    fontSize: 16,
    textAlign: 'center',
    fontFamily: 'Inter_400Regular', // if available, else standard
  },
  errorText: {
    color: '#ff4444',
    fontSize: 16,
    textAlign: 'center',
    fontWeight: 'bold',
  }
});