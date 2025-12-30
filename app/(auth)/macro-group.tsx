// import { Ionicons } from '@expo/vector-icons';
// import { useRouter } from 'expo-router';
// import { doc, updateDoc } from 'firebase/firestore';
// import React, { useState } from 'react';
// import {
//     ActivityIndicator,
//     Alert,
//     Pressable,
//     SafeAreaView,
//     StyleSheet,
//     Text,
//     TouchableOpacity,
//     View
// } from 'react-native';
// import { auth, firestore } from '../config/firebase';

// // 🔥 Замените это на ваши реальные макрогруппы
// const MACRO_GROUPS = [
//   { id: 'group_a', name: 'Макрогруппа A' },
//   { id: 'group_b', name: 'Макрогруппа B' },
//   { id: 'group_c', name: 'Макрогруппа C' },
// ];

// export default function MacroGroupSelectScreen() {
//   const router = useRouter();
//   const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
//   const [isLoading, setIsLoading] = useState(false);

//   const showAlert = (message: string) => {
//     if (typeof window !== 'undefined') {
//       window.alert(message);
//     } else {
//       Alert.alert('Ошибка', message);
//     }
//   };

//   const handleSaveAndContinue = async () => {
//     if (!selectedGroup) {
//       showAlert('Пожалуйста, выберите макрогруппу.');
//       return;
//     }

//     setIsLoading(true);
//     const currentUser = auth.currentUser;

//     if (!currentUser) {
//       setIsLoading(false);
//       router.replace('/(auth)'); // Если нет пользователя, возвращаем на авторизацию
//       return;
//     }

//     try {
//       // Сохраняем выбранную макрогруппу в профиль пользователя
//       await updateDoc(doc(firestore, 'users', currentUser.uid), {
//         macroGroup: selectedGroup,
//         // profileCompleted остается false, чтобы принудить к редактированию профиля
//         updatedAt: new Date(),
//       });
      
//       console.log('Макрогруппа сохранена, перенаправляем на редактирование профиля.');

//       // Перенаправляем на экран редактирования профиля в режиме первого редактирования
//       // (это то, куда вы хотите попасть после выбора макрогруппы).
//       router.replace('./(tabs)/profile/edit?firstEdit=true'); 

//     } catch (error) {
//       console.error('Ошибка сохранения макрогруппы:', error);
//       showAlert('Не удалось сохранить макрогруппу. Попробуйте снова.');
//     } finally {
//       setIsLoading(false);
//     }
//   };

//   return (
//     <SafeAreaView style={styles.container}>
//       <View style={styles.content}>
//         <Text style={styles.title}>Выберите вашу макрогруппу</Text>
//         <Text style={styles.subtitle}>Это поможет нам лучше подобрать вам пары.</Text>
        
//         <View style={styles.groupContainer}>
//           {MACRO_GROUPS.map((group) => (
//             <Pressable
//               key={group.id}
//               style={[
//                 styles.groupButton,
//                 selectedGroup === group.id && styles.groupButtonSelected,
//               ]}
//               onPress={() => setSelectedGroup(group.id)}
//               disabled={isLoading}
//             >
//               <Ionicons 
//                 name={selectedGroup === group.id ? "checkmark-circle" : "ellipse-outline"} 
//                 size={24} 
//                 color={selectedGroup === group.id ? '#e1306c' : '#999'} 
//               />
//               <Text style={[
//                 styles.groupText,
//                 selectedGroup === group.id && styles.groupTextSelected,
//               ]}>
//                 {group.name}
//               </Text>
//             </Pressable>
//           ))}
//         </View>

//         <TouchableOpacity 
//           style={[styles.continueButton, (!selectedGroup || isLoading) && styles.disabledButton]} 
//           onPress={handleSaveAndContinue}
//           disabled={!selectedGroup || isLoading}
//         >
//           {isLoading ? (
//             <ActivityIndicator color="#ffffff" />
//           ) : (
//             <Text style={styles.continueButtonText}>Продолжить</Text>
//           )}
//         </TouchableOpacity>
//       </View>
//     </SafeAreaView>
//   );
// }

// const styles = StyleSheet.create({
//   container: {
//     flex: 1,
//     backgroundColor: '#0a0a0a',
//   },
//   content: {
//     flex: 1,
//     justifyContent: 'center',
//     alignItems: 'center',
//     padding: 20,
//   },
//   title: {
//     fontSize: 24,
//     fontWeight: 'bold',
//     color: '#ffffff',
//     marginBottom: 10,
//     textAlign: 'center',
//   },
//   subtitle: {
//     fontSize: 16,
//     color: '#cccccc',
//     marginBottom: 40,
//     textAlign: 'center',
//   },
//   groupContainer: {
//     width: '100%',
//     maxWidth: 350,
//     gap: 15,
//     marginBottom: 40,
//   },
//   groupButton: {
//     flexDirection: 'row',
//     alignItems: 'center',
//     backgroundColor: '#1a1a1a',
//     borderWidth: 2,
//     borderColor: '#333',
//     borderRadius: 15,
//     padding: 20,
//     shadowColor: '#000',
//     shadowOffset: { width: 0, height: 4 },
//     shadowOpacity: 0.3,
//     shadowRadius: 5,
//     elevation: 8,
//   },
//   groupButtonSelected: {
//     borderColor: '#e1306c',
//     backgroundColor: 'rgba(225, 48, 108, 0.1)',
//   },
//   groupText: {
//     color: '#ffffff',
//     fontSize: 18,
//     fontWeight: '600',
//     marginLeft: 15,
//   },
//   groupTextSelected: {
//     color: '#e1306c',
//   },
//   continueButton: {
//     width: '100%',
//     maxWidth: 350,
//     backgroundColor: '#e1306c',
//     padding: 18,
//     borderRadius: 15,
//     alignItems: 'center',
//     justifyContent: 'center',
//   },
//   disabledButton: {
//     opacity: 0.5,
//   },
//   continueButtonText: {
//     color: '#ffffff',
//     fontSize: 18,
//     fontWeight: 'bold',
//   },
// });