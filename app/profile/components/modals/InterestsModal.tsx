import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import {
  Alert,
  FlatList,
  Modal,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { yandexAuth } from '../../../services/yandex/AuthService';

// Список доступных интересов
const availableInterests = [
  'Бег', 'Боевые искусства', 'Кино', 'Аниме', 'Комиксы',
  'Творчество', 'Музей', 'Музыка', 'Вокал', 'Музыкальные инструменты'
];

interface InterestsModalProps {
  visible: boolean;
  interests: string[];
  setInterests: (interests: string[] | ((prev: string[]) => string[])) => void;
  onClose: () => void;
}

export default function InterestsModal({ visible, interests, setInterests, onClose }: InterestsModalProps) {

  const showAlert = (message: string) => {
    if (typeof window !== 'undefined') {
      window.alert(message);
    } else {
      Alert.alert('Ошибка', message);
    }
  };

  const toggleInterest = (interest: string) => {
    setInterests((prevInterests: string[]) => {
      if (prevInterests.includes(interest)) {
        return prevInterests.filter((item: string) => item !== interest);
      } else {
        return [...prevInterests, interest];
      }
    });
  };

  const saveInterests = async () => {
    try {
      const currentUser = yandexAuth.getCurrentUser();
      if (currentUser) {
        await yandexAuth.updateProfile({
          interests: interests
        });
        onClose();
        showAlert('Интересы обновлены');
      }
    } catch (error) {
      console.error('Ошибка сохранения интересов:', error);
      showAlert('Не удалось сохранить интересы');
    }
  };

  const renderInterestItem = ({ item }: { item: string }) => (
    <Pressable
      style={[
        styles.interestItem,
        interests.includes(item) && styles.interestItemSelected
      ]}
      onPress={() => toggleInterest(item)}
    >
      <Text style={[
        styles.interestItemText,
        interests.includes(item) && styles.interestItemTextSelected
      ]}>
        {item}
      </Text>
      {interests.includes(item) && (
        <Ionicons name="checkmark" size={20} color="#ffffff" />
      )}
    </Pressable>
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
    >
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Выберите интересы</Text>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={onClose}
          >
            <Ionicons name="close" size={24} color="#ffffff" />
          </TouchableOpacity>
        </View>

        <View style={styles.subheader}>
          <Text style={styles.subtitle}>
            Выберите минимум один интерес ({interests.length} выбрано)
          </Text>
        </View>

        <FlatList
          data={availableInterests}
          renderItem={renderInterestItem}
          keyExtractor={(item: string) => item}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        />

        <View style={styles.footer}>
          <TouchableOpacity
            style={[
              styles.saveButton,
              interests.length === 0 && styles.saveButtonDisabled
            ]}
            onPress={saveInterests}
            disabled={interests.length === 0}
          >
            <Text style={styles.saveButtonText}>
              Сохранить ({interests.length})
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
  interestItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1a1a1a',
    padding: 16,
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#333',
  },
  interestItemSelected: {
    backgroundColor: '#e1306c',
    borderColor: '#e1306c',
  },
  interestItemText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '500',
  },
  interestItemTextSelected: {
    color: '#ffffff',
    fontWeight: 'bold',
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
  saveButtonDisabled: {
    backgroundColor: '#666',
  },
  saveButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});