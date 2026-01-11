// components/PhotoGrid.tsx
import { Ionicons } from '@expo/vector-icons';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';

interface PhotoGridProps {
  photos: string[];
  setPhotos: (photos: string[]) => void;
  maxPhotos?: number;
}

import { yandexStorage } from '../services/yandex/StorageService'; // Импорт сервиса

export const PhotoGrid = ({ photos, setPhotos, maxPhotos = 4 }: PhotoGridProps) => {
  const [loading, setLoading] = useState(false);

  const pickImage = async () => {
    if (photos.length >= maxPhotos) return;

    try {
      setLoading(true);
      // 1. Запрашиваем разрешение
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Ошибка', 'Нужен доступ к галерее, чтобы выбрать фото.');
        setLoading(false);
        return;
      }

      // 2. Выбираем фото (Мультивыбор)
      const limit = maxPhotos - photos.length;
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false, // Disabling editing for multi-select usually works better
        quality: 1.0,
        allowsMultipleSelection: true, // 🔥 Allow multiple selection
        selectionLimit: limit,         // 🔥 Limit to remaining slots
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        // 🔥 Enforce limit manually as selectionLimit might be ignored
        const assetsToUpload = result.assets.slice(0, limit);
        const newPhotos: string[] = [];

        // Loop through allowed assets
        for (const asset of assetsToUpload) {
          const localUri = asset.uri;

          // 🔥 COMPRESSION
          console.log('[PhotoGrid] Compressing image...', localUri);
          const manipResult = await ImageManipulator.manipulateAsync(
            localUri,
            [{ resize: { width: 1080 } }],
            { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
          );

          // 🔥 UPLOAD
          const remoteUrl = await yandexStorage.uploadImage(manipResult.uri, 'avatars');
          newPhotos.push(remoteUrl);
        }

        setPhotos([...photos, ...newPhotos]);
      }
    } catch (error) {
      console.error('Pick error:', error);
      Alert.alert('Ошибка', 'Не удалось загрузить фото. Проверьте интернет.');
    } finally {
      setLoading(false);
    }
  };

  const removePhoto = (indexToRemove: number) => {
    const photoUrl = photos[indexToRemove];

    const deleteLogic = () => {
      // 1. Remove from UI immediately
      setPhotos(photos.filter((_, index) => index !== indexToRemove));

      // 2. Remove from Server (Fire & Forget)
      yandexStorage.deleteImage(photoUrl).catch(err => {
        console.error('Failed to delete image from server:', err);
      });
    };

    if (Platform.OS === 'web') {
      if (window.confirm('Удалить фото?')) {
        deleteLogic();
      }
    } else {
      Alert.alert('Удалить фото?', '', [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Удалить',
          style: 'destructive',
          onPress: deleteLogic
        }
      ]);
    }
  };

  return (
    <View style={styles.container}>
      {/* Сетка фото */}
      {photos.map((photoUrl, index) => (
        <View key={index} style={styles.photoWrapper}>
          <Image source={{ uri: photoUrl }} style={styles.photo} />
          <TouchableOpacity
            style={styles.removeButton}
            onPress={() => removePhoto(index)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} // Increase touch area
          >
            <Ionicons name="close" size={16} color="#fff" />
          </TouchableOpacity>
        </View>
      ))}

      {/* Кнопка добавления */}
      {photos.length < maxPhotos && (
        <TouchableOpacity
          style={styles.addButton}
          onPress={pickImage}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#e1306c" />
          ) : (
            <Ionicons name="add" size={32} color="#e1306c" />
          )}
        </TouchableOpacity>
      )}

      {/* Подсказка если пусто */}
      {photos.length === 0 && !loading && (
        <Text style={styles.hint}>
          Добавьте до {maxPhotos} фото
        </Text>
      )}
    </View>
  );
};


const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 20
  },
  photoWrapper: {
    width: '30%',
    aspectRatio: 0.75, // 3:4
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#e0e0e0'
  },
  photo: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover'
  },
  removeButton: {
    position: 'absolute',
    top: 5,
    right: 5,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 12,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100
  },
  addButton: {
    width: '30%',
    aspectRatio: 0.75,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#e1306c',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(225, 48, 108, 0.05)'
  },
  hint: {
    width: '100%',
    textAlign: 'center',
    color: '#999',
    marginTop: 20,
    fontSize: 16
  }
});
