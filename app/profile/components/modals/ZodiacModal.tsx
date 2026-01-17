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
import { zodiacSigns } from '../../../utils/basic_info';
import { normalize } from '../../../utils/normalize';

interface ZodiacModalProps {
  visible: boolean;
  zodiac: string | null;
  setZodiac: (zodiac: string | null) => void;
  onClose: () => void;
}

export default function ZodiacModal({ visible, zodiac, setZodiac, onClose }: ZodiacModalProps) {
  const { theme, themeType } = useTheme();

  const showAlert = (message: string) => {
    if (typeof window !== 'undefined') {
      window.alert(message);
    } else {
      Alert.alert('Ошибка', message);
    }
  };

  const selectZodiac = (zodiacId: string) => {
    if (zodiac === zodiacId) {
      setZodiac(null);
    } else {
      setZodiac(zodiacId);
    }
  };

  const saveZodiac = async () => {
    try {
      const currentUser = yandexAuth.getCurrentUser();
      if (currentUser) {
        await yandexAuth.updateProfile({
          zodiac: zodiac || undefined
        });
        onClose();
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
        {
          backgroundColor: themeType === 'space' ? 'rgba(255, 255, 255, 0.05)' : theme.cardBg,
          borderColor: themeType === 'space' ? 'rgba(255, 255, 255, 0.1)' : theme.border
        },
        zodiac === item.id && styles.zodiacItemSelected
      ]}
      onPress={() => selectZodiac(item.id)}
    >
      <Text style={styles.zodiacEmoji}>{item.emoji}</Text>
      <View style={styles.zodiacInfo}>
        <Text style={[
          styles.zodiacName,
          { color: theme.text },
          zodiac === item.id && styles.zodiacNameSelected
        ]}>
          {item.name}
        </Text>
        <Text style={[styles.zodiacDates, { color: theme.subText }]}>{item.dates}</Text>
      </View>
      {zodiac === item.id && (
        <Ionicons name="checkmark-circle" size={24} color="#10b981" />
      )}
    </TouchableOpacity>
  );

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
                  <Text style={[styles.title, { color: theme.text }]}>Знаки зодиака</Text>
                  <TouchableOpacity
                    style={styles.closeButton}
                    onPress={onClose}
                  >
                    <Ionicons name="close" size={24} color={theme.text} />
                  </TouchableOpacity>
                </View>

                <View style={styles.subheader}>
                  <Text style={[styles.subtitle, { color: theme.subText }]}>
                    Выберите ваш знак зодиака
                  </Text>
                </View>

                <FlatList
                  data={zodiacSigns}
                  renderItem={renderZodiacItem}
                  keyExtractor={(item) => item.id}
                  contentContainerStyle={styles.list}
                  showsVerticalScrollIndicator={false}
                />

                <View style={[styles.footer, { borderTopColor: theme.border }]}>
                  <PrimaryButton
                    title={zodiac ? 'Сохранить' : 'Закрыть'}
                    onPress={zodiac ? saveZodiac : onClose}
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
  zodiacItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: normalize(16),
    borderRadius: normalize(12),
    marginBottom: normalize(10),
    borderWidth: 1,
  },
  zodiacItemSelected: {
    borderColor: '#10b981',
  },
  zodiacEmoji: {
    fontSize: normalize(32),
    marginRight: normalize(12),
    width: normalize(40),
    textAlign: 'center',
  },
  zodiacInfo: {
    flex: 1,
  },
  zodiacName: {
    fontSize: normalize(16),
    fontWeight: '500',
    marginBottom: normalize(2),
  },
  zodiacNameSelected: {
    color: '#10b981',
    fontWeight: 'bold',
  },
  zodiacDates: {
    fontSize: normalize(12),
  },
  footer: {
    padding: normalize(20),
    borderTopWidth: 1,
    gap: normalize(10),
    paddingBottom: normalize(40),
  },
});