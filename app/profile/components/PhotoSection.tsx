// app/profile/components/PhotoSection.tsx
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { PhotoGrid } from '../../components/PhotoGrid';
import { useTheme } from '../../context/ThemeContext';

interface PhotoSectionProps {
  photos: string[];
  setPhotos: (photos: string[] | ((prev: string[]) => string[])) => void;
  isFirstEdit: boolean;
}

export default function PhotoSection({ photos, setPhotos, isFirstEdit }: PhotoSectionProps) {
  const { theme } = useTheme();

  const handleSetPhotos = (newPhotos: string[]) => {
    setPhotos(newPhotos);
  };

  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: theme.text }]}>
        Ваши фото {isFirstEdit && <Text style={styles.requiredStar}>*</Text>}
      </Text>
      <PhotoGrid
        photos={photos}
        setPhotos={handleSetPhotos}
        maxPhotos={6}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginBottom: 30 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 15 },
  requiredStar: { color: '#e1306c' },
});