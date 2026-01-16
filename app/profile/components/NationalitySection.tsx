import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import {
  Dimensions,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { getNationalityFlag, getNationalityName, nationalities } from '../../utils/nationalities';

const { width: screenWidth } = Dimensions.get('window');

interface NationalitySectionProps {
  gender: 'male' | 'female' | null;
  nationality: string | null;
  setNationality: (nationality: string) => void;
  isFirstEdit: boolean;
}

export default function NationalitySection({
  gender,
  nationality,
  setNationality,
  isFirstEdit
}: NationalitySectionProps) {
  const { theme, themeType } = useTheme();

  const renderNationalityItem = ({ item }: { item: any }) => (
    <Pressable
      style={[
        styles.nationalityCard,
        {
          backgroundColor: themeType === 'space' ? '#1a1a1a' : theme.cardBg, // Keep dark for space, use theme for others
          borderColor: theme.border
        },
        nationality === item.id && styles.nationalityCardSelected,
        isFirstEdit && !nationality && styles.requiredField
      ]}
      onPress={() => setNationality(item.id)}
    >
      <Text style={styles.nationalityFlag}>
        {getNationalityFlag(item.id)}
      </Text>
      <Text style={[
        styles.nationalityName,
        { color: theme.text },
        nationality === item.id && styles.nationalityNameSelected
      ]}>
        {getNationalityName(item, gender || 'male')}
      </Text>
      <Text style={[styles.nationalityHint, { color: theme.subText }]}>
        {gender === 'female' ? item.femaleName : item.name}
      </Text>
    </Pressable>
  );

  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: theme.text }]}>
        Национальность {isFirstEdit && <Text style={styles.requiredStar}>*</Text>}
      </Text>

      {gender ? (
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
            <Ionicons name="chevron-back" size={20} color={theme.subText} />
            <Text style={[styles.scrollIndicatorText, { color: theme.subText }]}>прокрутите вбок</Text>
            <Ionicons name="chevron-forward" size={20} color={theme.subText} />
          </View>
        </View>
      ) : (
        <Text style={[styles.sectionSubtitle, { color: theme.subText }]}>Сначала выберите пол</Text>
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
    marginBottom: 15,
  },
  sectionSubtitle: {
    fontSize: 14,
    marginBottom: 15,
  },
  requiredStar: {
    color: '#e1306c',
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
    borderWidth: 2,
    borderRadius: 16,
    padding: 25,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  nationalityCardSelected: {
    backgroundColor: '#e1306c',
    borderColor: '#e1306c',
    transform: [{ scale: 1.05 }],
  },
  requiredField: {
    borderColor: '#e1306c',
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
});