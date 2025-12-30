import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { religions as availableReligions, getReligionById } from '../../utils/basic_info';

interface ReligionSectionProps {
  selectedReligions: string[];
  setSelectedReligions: (religions: string[] | ((prev: string[]) => string[])) => void;
}

export default function ReligionSection({ selectedReligions, setSelectedReligions }: ReligionSectionProps) {
  const { theme, themeType } = useTheme();

  const toggleReligion = (religionId: string) => {
    setSelectedReligions((prevReligions: string[]) => {
      if (prevReligions.includes(religionId)) {
        return prevReligions.filter((item: string) => item !== religionId);
      } else {
        return [...prevReligions, religionId];
      }
    });
  };

  const getSelectedReligionsNames = () => {
    return selectedReligions.map((religionId: string) => {
      const religion = getReligionById(religionId);
      return religion ? religion.name : religionId;
    }).join(', ');
  };

  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: theme.text }]}>Вероисповедание</Text>
      <Text style={[styles.sectionSubtitle, { color: theme.subText }]}>Необязательное поле, можно выбрать несколько</Text>

      <View style={styles.religionContainer}>
        {availableReligions.map((religionItem) => (
          <Pressable
            key={religionItem.id}
            style={[
              styles.religionButton,
              {
                backgroundColor: themeType === 'space' ? 'rgba(18, 22, 40, 0.9)' : theme.cardBg,
                borderColor: theme.border
              },
              selectedReligions.includes(religionItem.id) && styles.religionButtonSelected,
            ]}
            onPress={() => toggleReligion(religionItem.id)}
          >
            <Text style={styles.religionEmoji}>{religionItem.emoji}</Text>
            <Text style={[
              styles.religionText,
              { color: theme.text },
              selectedReligions.includes(religionItem.id) && styles.religionTextSelected
            ]}>
              {religionItem.name}
            </Text>
            {selectedReligions.includes(religionItem.id) && (
              <Ionicons name="checkmark" size={16} color="#e1306c" />
            )}
          </Pressable>
        ))}
      </View>

      {selectedReligions.length > 0 && (
        <Text style={styles.selectedReligion}>
          Выбрано: {getSelectedReligionsNames()}
        </Text>
      )}
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
    color: '#ffffff',
    marginBottom: 8,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#cccccc',
    marginBottom: 15,
  },
  religionContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  religionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 6,
  },
  religionButtonSelected: {
    backgroundColor: '#1a1a1a',
    borderColor: '#e1306c',
  },
  religionEmoji: {
    fontSize: 16,
  },
  religionText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '500',
  },
  religionTextSelected: {
    color: '#e1306c',
    fontWeight: '600',
  },
  selectedReligion: {
    color: '#e1306c',
    fontSize: 14,
    fontWeight: '500',
    marginTop: 10,
    textAlign: 'center',
  },
});