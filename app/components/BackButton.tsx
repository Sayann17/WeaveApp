import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text } from 'react-native';

export default function BackButton() {
  const router = useRouter();

  const handleGoBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)');
    }
  };

  return (
    <Pressable style={styles.backButton} onPress={handleGoBack}>
      <Ionicons name="arrow-back" size={24} color="#ffffff" />
      <Text style={styles.backButtonText}>Назад</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    paddingTop: 10,
  },
  backButtonText: {
    color: '#ffffff',
    fontSize: 16,
    marginLeft: 8,
    fontWeight: '500',
  },
});