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

import { normalize } from '../../utils/normalize';

// ... imports

const styles = StyleSheet.create({
  section: {
    marginBottom: normalize(30),
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: normalize(15),
  },
  sectionTitle: {
    fontSize: normalize(18),
    fontWeight: 'bold',
    color: '#ffffff',
  },
  zodiacActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: normalize(10),
  },
  editButton: {
    padding: normalize(5),
  },
  removeZodiacButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    paddingHorizontal: normalize(8),
    paddingVertical: normalize(4),
    borderRadius: normalize(8),
    borderWidth: 1,
    borderColor: '#ff4444',
    gap: normalize(4),
  },
  removeZodiacText: {
    color: '#ff4444',
    fontSize: normalize(12),
    fontWeight: '500',
  },
  zodiacDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    padding: normalize(16),
    borderRadius: normalize(12),
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  zodiacDisplayEmoji: {
    fontSize: normalize(32),
    marginRight: normalize(12),
  },
  zodiacDisplayInfo: {
    flex: 1,
  },
  zodiacDisplayName: {
    color: '#ffffff',
    fontSize: normalize(16),
    fontWeight: '600',
    marginBottom: normalize(2),
  },
  zodiacDisplayDates: {
    color: '#999',
    fontSize: normalize(12),
  },
  addZodiacButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: normalize(16),
    borderWidth: 1,
    borderColor: '#333',
    borderStyle: 'dashed',
    borderRadius: normalize(12),
    gap: normalize(8),
  },
  addZodiacText: {
    color: '#81B29A',
    fontSize: normalize(16),
    fontWeight: '600',
  },
});