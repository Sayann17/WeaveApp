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
import { getNationalityIcon, getNationalityName, nationalities } from '../../utils/basic_info';

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

  const renderNationalityItem = ({ item }: { item: any }) => (
    <Pressable
      style={[
        styles.nationalityCard,
        nationality === item.id && styles.nationalityCardSelected,
        isFirstEdit && !nationality && styles.requiredField
      ]}
      onPress={() => setNationality(item.id)}
    >
      <Text style={styles.nationalityFlag}>
        {getNationalityIcon(item.id, gender || 'male')}
      </Text>
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
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>
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
            <Ionicons name="chevron-back" size={20} color="#666" />
            <Text style={styles.scrollIndicatorText}>прокрутите вбок</Text>
            <Ionicons name="chevron-forward" size={20} color="#666" />
          </View>
        </View>
      ) : (
        <Text style={styles.sectionSubtitle}>Сначала выберите пол</Text>
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
    marginBottom: 15,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#cccccc',
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
    backgroundColor: '#1a1a1a',
    borderWidth: 2,
    borderColor: '#333',
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