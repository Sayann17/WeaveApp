import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import {
  Alert,
  FlatList,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View
} from 'react-native';
import { ThemedBackground } from '../../../components/ThemedBackground';
import { PrimaryButton } from '../../../components/ui/PrimaryButton';
import { useTheme } from '../../../context/ThemeContext';
import { yandexAuth } from '../../../services/yandex/AuthService';
import { availableInterests } from '../../../utils/basic_info';
import { normalize } from '../../../utils/normalize';

interface InterestsModalProps {
  visible: boolean;
  interests: string[];
  setInterests: (interests: string[] | ((prev: string[]) => string[])) => void;
  onClose: () => void;
}

export default function InterestsModal({ visible, interests, setInterests, onClose }: InterestsModalProps) {
  const { theme, themeType } = useTheme();

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
      }
    } catch (error) {
      console.error('Ошибка сохранения интересов:', error);
      showAlert('Не удалось сохранить интересы');
    }
  };

  const renderInterestItem = ({ item }: { item: string }) => {
    const isSelected = interests.includes(item);
    return (
      <TouchableOpacity
        style={[
          styles.interestItem,
          {
            backgroundColor: themeType === 'space' ? 'rgba(255, 255, 255, 0.05)' : theme.cardBg,
            borderColor: themeType === 'space' ? 'rgba(255, 255, 255, 0.1)' : theme.border
          },
          isSelected && styles.interestItemSelected
        ]}
        onPress={() => toggleInterest(item)}
      >
        <Text style={[
          styles.interestItemText,
          { color: theme.text },
          isSelected && styles.interestItemTextSelected
        ]}>
          {item}
        </Text>
        {isSelected && (
          <Ionicons name="checkmark-circle" size={20} color="#10b981" />
        )}
      </TouchableOpacity>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={true}
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.modalOverlay}>
          <TouchableWithoutFeedback>
            <View style={[styles.modalContent, { overflow: 'hidden' }]}>
              <ThemedBackground>
                <View style={[styles.header, { borderBottomColor: theme.border }]}>
                  <Text style={[styles.title, { color: theme.text }]}>Интересы</Text>
                  <TouchableOpacity
                    style={styles.closeButton}
                    onPress={onClose}
                  >
                    <Ionicons name="close" size={24} color={theme.text} />
                  </TouchableOpacity>
                </View>

                <View style={styles.subheader}>
                  <Text style={[styles.subtitle, { color: theme.subText }]}>
                    Выберите то, что вам интересно
                  </Text>
                </View>

                <FlatList
                  data={availableInterests}
                  renderItem={renderInterestItem}
                  keyExtractor={(item: string) => item}
                  contentContainerStyle={styles.list}
                  showsVerticalScrollIndicator={false}
                />

                <View style={[styles.footer, { borderTopColor: theme.border }]}>
                  <PrimaryButton
                    title="Сохранить"
                    onPress={saveInterests}
                    disabled={interests.length === 0}
                    style={{ backgroundColor: theme.accent || '#1c1c1e' }}
                    textColor={theme.accentText || '#ffffff'}
                  />
                </View>
              </ThemedBackground>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    height: '60%', // Half/Part screen
    borderTopLeftRadius: normalize(20),
    borderTopRightRadius: normalize(20),
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: normalize(20),
    borderBottomWidth: 1,
  },
  title: {
    fontSize: normalize(20),
    fontWeight: 'bold',
  },
  closeButton: {
    padding: normalize(4),
  },
  subheader: {
    paddingHorizontal: normalize(20),
    paddingTop: normalize(10),
    paddingBottom: 0,
  },
  subtitle: {
    fontSize: normalize(14),
    textAlign: 'left',
  },
  list: {
    padding: normalize(20),
  },
  interestItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    padding: normalize(16),
    borderRadius: normalize(12),
    marginBottom: normalize(10),
  },
  interestItemSelected: {
    borderColor: '#10b981', // Green border
  },
  interestItemText: {
    fontSize: normalize(16),
    fontWeight: '500',
  },
  interestItemTextSelected: {
    color: '#10b981', // Green text
    fontWeight: 'bold',
  },
  footer: {
    padding: normalize(20),
    borderTopWidth: 1,
    paddingBottom: normalize(40),
  },
});