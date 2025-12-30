import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { doc, updateDoc } from 'firebase/firestore';
import React, { useState } from 'react';
import {
  Alert,
  Dimensions,
  FlatList,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View
} from 'react-native';
import { auth, firestore } from '../config/firebase';
import { getNationalityName, nationalities } from '../utils/nationalities';

const { width: screenWidth } = Dimensions.get('window');

export default function AdditionalInfoScreen() {
  const [gender, setGender] = useState<'male' | 'female' | null>(null);
  const [nationality, setNationality] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleSave = async () => {
    if (!gender || !nationality) {
      if (typeof window !== 'undefined') {
        window.alert('Пожалуйста, заполните все поля');
      } else {
        Alert.alert('Ошибка', 'Пожалуйста, заполните все поля');
      }
      return;
    }

    setIsLoading(true);

    try {
      const currentUser = auth.currentUser;
      if (currentUser) {
        await updateDoc(doc(firestore, 'users', currentUser.uid), {
          gender: gender,
          nationality: nationality,
          profileCompleted: true,
          updatedAt: new Date(),
        });

        console.log('Дополнительная информация сохранена!');
        router.replace('/(tabs)');
      }
    } catch (error) {
      console.error('Ошибка сохранения:', error);
      if (typeof window !== 'undefined') {
        window.alert('Не удалось сохранить информацию');
      } else {
        Alert.alert('Ошибка', 'Не удалось сохранить информацию');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const renderNationalityItem = ({ item }: { item: any }) => (
    <Pressable
      style={[
        styles.nationalityCard,
        nationality === item.id && styles.nationalityCardSelected,
      ]}
      onPress={() => setNationality(item.id)}
    >
      <Text style={styles.nationalityFlag}>{item.flag}</Text>
      <Text style={[
        styles.nationalityName,
        nationality === item.id && styles.nationalityNameSelected
      ]}>
        {getNationalityName(item, gender || 'male')}
      </Text>
      <Text style={styles.nationalityHint}>
        {gender === 'female' ? item.femaleName : item.name}
      </Text>
    </Pressable>
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={styles.title}>Дополнительная информация</Text>
          <Text style={styles.subtitle}>Расскажите о себе немного больше</Text>
        </View>

        {/* Выбор пола */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>1. Ваш пол</Text>
          <View style={styles.genderContainer}>
            <Pressable
              style={[
                styles.genderButton,
                gender === 'male' && styles.genderButtonSelected,
              ]}
              onPress={() => setGender('male')}
            >
              <Ionicons 
                name="male" 
                size={32} 
                color={gender === 'male' ? '#ffffff' : '#666'} 
              />
              <Text style={[
                styles.genderText,
                gender === 'male' && styles.genderTextSelected
              ]}>
                Мужской
              </Text>
            </Pressable>

            <Pressable
              style={[
                styles.genderButton,
                gender === 'female' && styles.genderButtonSelected,
              ]}
              onPress={() => setGender('female')}
            >
              <Ionicons 
                name="female" 
                size={32} 
                color={gender === 'female' ? '#ffffff' : '#666'} 
              />
              <Text style={[
                styles.genderText,
                gender === 'female' && styles.genderTextSelected
              ]}>
                Женский
              </Text>
            </Pressable>
          </View>
        </View>

        {/* Выбор национальности */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            2. Ваша национальность
          </Text>
          <Text style={styles.sectionSubtitle}>
            {gender ? 'Прокрутите вбок чтобы выбрать национальность' : 'Сначала выберите пол'}
          </Text>

          {gender && (
            <View style={styles.nationalityScrollContainer}>
              <FlatList
                data={nationalities}
                renderItem={renderNationalityItem}
                keyExtractor={(item) => item.id}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.nationalityList}
                snapToInterval={screenWidth * 0.7 + 20}
                decelerationRate="fast"
                bounces={false}
              />
              
              {/* Индикатор прокрутки */}
              <View style={styles.scrollIndicator}>
                <Ionicons name="chevron-back" size={20} color="#666" />
                <Text style={styles.scrollIndicatorText}>прокрутите</Text>
                <Ionicons name="chevron-forward" size={20} color="#666" />
              </View>
            </View>
          )}
        </View>

        {/* Кнопка сохранения */}
        <Pressable
          style={[
            styles.saveButton,
            (!gender || !nationality) && styles.saveButtonDisabled,
            isLoading && styles.saveButtonDisabled,
          ]}
          onPress={handleSave}
          disabled={!gender || !nationality || isLoading}
        >
          <Text style={styles.saveButtonText}>
            {isLoading ? 'Сохранение...' : 'Завершить регистрацию'}
          </Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  scrollContent: {
    flexGrow: 1,
    padding: 20,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
    marginTop: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#e1306c',
    fontWeight: '500',
    textAlign: 'center',
  },
  section: {
    marginBottom: 40,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 8,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#cccccc',
    marginBottom: 20,
  },
  genderContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 15,
  },
  genderButton: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    borderWidth: 2,
    borderColor: '#333',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  genderButtonSelected: {
    backgroundColor: '#e1306c',
    borderColor: '#e1306c',
  },
  genderText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '600',
    marginTop: 8,
  },
  genderTextSelected: {
    color: '#ffffff',
  },
  nationalityScrollContainer: {
    marginBottom: 10,
  },
  nationalityList: {
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  nationalityCard: {
    width: screenWidth * 0.7,
    backgroundColor: '#1a1a1a',
    borderWidth: 2,
    borderColor: '#333',
    borderRadius: 16,
    padding: 25,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 10,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  nationalityCardSelected: {
    backgroundColor: '#e1306c',
    borderColor: '#e1306c',
    transform: [{ scale: 1.05 }],
  },
  nationalityFlag: {
    fontSize: 48,
    marginBottom: 15,
  },
  nationalityName: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 5,
  },
  nationalityNameSelected: {
    color: '#ffffff',
    fontWeight: 'bold',
  },
  nationalityHint: {
    color: '#cccccc',
    fontSize: 14,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  scrollIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 15,
    gap: 8,
  },
  scrollIndicatorText: {
    color: '#666',
    fontSize: 12,
    fontWeight: '500',
  },
  saveButton: {
    backgroundColor: '#e1306c',
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 20,
  },
  saveButtonDisabled: {
    backgroundColor: '#666',
  },
  saveButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
  },
});