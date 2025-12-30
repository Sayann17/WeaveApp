import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import {
  Alert,
  FlatList,
  Modal,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { yandexAuth } from '../../../services/yandex/AuthService';
import { zodiacSigns } from '../../../utils/basic_info';

interface ZodiacModalProps {
  visible: boolean;
  zodiac: string | null;
  setZodiac: (zodiac: string | null) => void;
  onClose: () => void;
}

export default function ZodiacModal({ visible, zodiac, setZodiac, onClose }: ZodiacModalProps) {

  const showAlert = (message: string) => {
    if (typeof window !== 'undefined') {
      window.alert(message);
    } else {
      Alert.alert('Ошибка', message);
    }
  };

  const selectZodiac = (zodiacId: string) => {
    setZodiac(zodiacId);
  };

  const saveZodiac = async () => {
    try {
      const currentUser = yandexAuth.getCurrentUser();
      if (currentUser) {
        await yandexAuth.updateProfile({
          zodiac: zodiac || undefined
        });
        onClose();
        showAlert('Знак зодиака обновлен');
      }
    } catch (error) {
      console.error('Ошибка сохранения знака зодиака:', error);
      showAlert('Не удалось сохранить знак зодиака');
    }
  };

  const renderZodiacItem = ({ item }: { item: typeof zodiacSigns[0] }) => (
    <TouchableOpacity
      style={[
        styles.zodiacItem,
        zodiac === item.id && styles.zodiacItemSelected
      ]}
      onPress={() => selectZodiac(item.id)}
    >
      <Text style={styles.zodiacEmoji}>{item.emoji}</Text>
      <View style={styles.zodiacInfo}>
        <Text style={[
          styles.zodiacName,
          zodiac === item.id && styles.zodiacNameSelected
        ]}>
          {item.name}
        </Text>
        <Text style={styles.zodiacDates}>{item.dates}</Text>
      </View>
      {zodiac === item.id && (
        <Ionicons name="checkmark-circle" size={24} color="#e1306c" />
      )}
    </TouchableOpacity>
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
    >
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Выберите знак зодиака</Text>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={onClose}
          >
            <Ionicons name="close" size={24} color="#ffffff" />
          </TouchableOpacity>
        </View>

        <View style={styles.subheader}>
          <Text style={styles.subtitle}>
            Выберите ваш знак зодиака (необязательно)
          </Text>
        </View>

        <FlatList
          data={zodiacSigns}
          renderItem={renderZodiacItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        />

        <View style={styles.footer}>
          {zodiac && (
            <TouchableOpacity
              style={styles.removeButton}
              onPress={() => {
                setZodiac(null);
                onClose();
              }}
            >
              <Ionicons name="close" size={20} color="#ff4444" />
              <Text style={styles.removeButtonText}>Убрать знак зодиака</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={styles.saveButton}
            onPress={saveZodiac}
          >
            <Text style={styles.saveButtonText}>
              {zodiac ? 'Сохранить знак зодиака' : 'Не выбирать знак зодиака'}
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  closeButton: {
    padding: 4,
  },
  subheader: {
    padding: 20,
    paddingTop: 10,
  },
  subtitle: {
    fontSize: 14,
    color: '#cccccc',
    textAlign: 'center',
  },
  list: {
    padding: 20,
  },
  zodiacItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    padding: 16,
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#333',
  },
  zodiacItemSelected: {
    backgroundColor: '#1a1a1a',
    borderColor: '#e1306c',
  },
  zodiacEmoji: {
    fontSize: 32,
    marginRight: 12,
    width: 40,
    textAlign: 'center',
  },
  zodiacInfo: {
    flex: 1,
  },
  zodiacName: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 2,
  },
  zodiacNameSelected: {
    color: '#e1306c',
    fontWeight: 'bold',
  },
  zodiacDates: {
    color: '#999',
    fontSize: 12,
  },
  footer: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#1a1a1a',
  },
  saveButton: {
    backgroundColor: '#e1306c',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  removeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ff4444',
    marginBottom: 10,
    gap: 8,
  },
  removeButtonText: {
    color: '#ff4444',
    fontSize: 16,
    fontWeight: 'bold',
  },
});