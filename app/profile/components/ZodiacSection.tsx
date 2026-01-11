import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { getZodiacSignById } from '../../utils/basic_info';

interface ZodiacSectionProps {
  zodiac: string | null;
  setZodiac: (zodiac: string | null) => void;
  onEditPress: () => void;
}

export default function ZodiacSection({ zodiac, setZodiac, onEditPress }: ZodiacSectionProps) {
  const { theme, themeType } = useTheme();
  const zodiacData = zodiac ? getZodiacSignById(zodiac) : null;

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>Знак зодиака</Text>
        <View style={styles.zodiacActions}>
          {/* Remove button removed per request */}
        </View>
      </View>

      {zodiac ? (
        <TouchableOpacity
          style={[
            styles.zodiacDisplay,
            {
              backgroundColor: themeType === 'space' ? 'rgba(18, 22, 40, 0.9)' : theme.cardBg,
              borderColor: theme.border
            }
          ]}
          onPress={onEditPress}
        >
          <Text style={styles.zodiacDisplayEmoji}>
            {zodiacData?.emoji}
          </Text>
          <View style={styles.zodiacDisplayInfo}>
            <Text style={[styles.zodiacDisplayName, { color: theme.text }]}>
              {zodiacData?.name}
            </Text>
            <Text style={[styles.zodiacDisplayDates, { color: theme.subText }]}>
              {getZodiacSignById(zodiac)?.dates}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#666" />
        </TouchableOpacity>
      ) : (
        <TouchableOpacity
          style={styles.addZodiacButton}
          onPress={onEditPress}
        >
          <Ionicons name="planet-outline" size={24} color="#81B29A" />
          <Text style={styles.addZodiacText}>Выбрать знак зодиака</Text>
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
    color: '#ffffff',
  },
  zodiacActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  editButton: {
    padding: 5,
  },
  removeZodiacButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ff4444',
    gap: 4,
  },
  removeZodiacText: {
    color: '#ff4444',
    fontSize: 12,
    fontWeight: '500',
  },
  zodiacDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  zodiacDisplayEmoji: {
    fontSize: 32,
    marginRight: 12,
  },
  zodiacDisplayInfo: {
    flex: 1,
  },
  zodiacDisplayName: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  zodiacDisplayDates: {
    color: '#999',
    fontSize: 12,
  },
  addZodiacButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderWidth: 1,
    borderColor: '#333',
    borderStyle: 'dashed',
    borderRadius: 12,
    gap: 8,
  },
  addZodiacText: {
    color: '#81B29A',
    fontSize: 16,
    fontWeight: '600',
  },
});