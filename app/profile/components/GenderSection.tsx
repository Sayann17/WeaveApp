import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';

interface GenderSectionProps {
  gender: 'male' | 'female' | null;
  setGender: (gender: 'male' | 'female') => void;
  isFirstEdit: boolean;
}

export default function GenderSection({ gender, setGender, isFirstEdit }: GenderSectionProps) {
  const { theme, themeType } = useTheme();
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: theme.text }]}>
        Пол {isFirstEdit && <Text style={styles.requiredStar}>*</Text>}
      </Text>
      <View style={styles.genderContainer}>
        <Pressable
          style={[
            styles.genderButton,
            {
              backgroundColor: themeType === 'space' ? 'rgba(35, 45, 80, 0.9)' : theme.cardBg,
              borderColor: theme.border
            },
            gender === 'male' && styles.genderButtonSelected,
            isFirstEdit && !gender && styles.requiredField
          ]}
          onPress={() => setGender('male')}
        >
          <Ionicons
            name="male"
            size={24}
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
            {
              backgroundColor: themeType === 'space' ? 'rgba(35, 45, 80, 0.9)' : theme.cardBg,
              borderColor: theme.border
            },
            gender === 'female' && styles.genderButtonSelected,
            isFirstEdit && !gender && styles.requiredField
          ]}
          onPress={() => setGender('female')}
        >
          <Ionicons
            name="female"
            size={24}
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
  );
}

const styles = StyleSheet.create({
  section: {
    marginBottom: 30,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
  },
  requiredStar: {
    color: '#e1306c',
  },
  genderContainer: {
    flexDirection: 'row',
    gap: 15,
  },
  genderButton: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    borderWidth: 2,
    borderColor: '#333',
    borderRadius: 12,
    padding: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  genderButtonSelected: {
    backgroundColor: '#81B29A',
    borderColor: '#81B29A',
  },
  requiredField: {
    borderColor: '#81B29A',
  },
  genderText: {
    color: '#666',
    fontSize: 14,
    fontWeight: '600',
    marginTop: 5,
  },
  genderTextSelected: {
    color: '#ffffff',
  },
});