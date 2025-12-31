import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';

interface InterestsSectionProps {
  interests: string[];
  onEditPress: () => void;
}

export default function InterestsSection({ interests, onEditPress }: InterestsSectionProps) {
  const { theme, themeType } = useTheme();
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>Интересы</Text>
        <TouchableOpacity
          style={styles.editButton}
          onPress={onEditPress}
        >
          <Ionicons name="add" size={20} color="#ffffff" />
        </TouchableOpacity>
      </View>

      {interests.length > 0 ? (
        <View style={styles.interestsContainer}>
          {interests.map((interest, index) => (
            <View
              key={index}
              style={[
                styles.interestTag,
                {
                  backgroundColor: themeType === 'space' ? 'rgba(18, 22, 40, 0.9)' : theme.cardBg,
                  borderColor: theme.border
                }
              ]}
            >
              <Text style={[styles.interestTagText, { color: theme.text }]}>{interest}</Text>
            </View>
          ))}
        </View>
      ) : (
        <TouchableOpacity
          style={styles.addInterestsButton}
          onPress={onEditPress}
        >
          <Ionicons name="add-circle-outline" size={28} color="#22c55e" />
          <Text style={styles.addInterestsText}>Добавить интересы</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginBottom: 30,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  editButton: {
    padding: 8,
    backgroundColor: '#22c55e',
    borderRadius: 20,
    paddingHorizontal: 12,
  },
  interestsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  interestTag: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  interestTagText: {
    fontSize: 14,
    fontWeight: '500',
  },
  addInterestsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    borderWidth: 2,
    borderColor: '#22c55e',
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
    borderStyle: 'solid',
    borderRadius: 16,
    gap: 10,
  },
  addInterestsText: {
    color: '#22c55e',
    fontSize: 17,
    fontWeight: 'bold',
  },
});