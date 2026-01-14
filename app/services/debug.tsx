// import { doc, getDoc, setDoc } from 'firebase/firestore';
// import { auth, firestore } from '../config/firebase';

// export const testFirebaseConnection = async () => {
//   try {
//     console.log('🧪 Starting Firebase connection test...');
    
//     const currentUser = auth.currentUser;
//     console.log('👤 Current user:', currentUser?.uid, currentUser?.email);
    
//     if (!currentUser) {
//       console.log('❌ No authenticated user');
//       return false;
//     }

//     // Тест 1: Попробуем прочитать свой профиль
//     console.log('📖 Test 1: Reading user profile...');
//     const userDoc = await getDoc(doc(firestore, 'users', currentUser.uid));
//     console.log('✅ User profile exists:', userDoc.exists());
//     if (userDoc.exists()) {
//       console.log('📋 User data:', userDoc.data());
//     }

//     // Тест 2: Попробуем создать тестовый документ
//     console.log('📝 Test 2: Creating test document...');
//     const testDocRef = doc(firestore, 'test', `test_${Date.now()}`);
//     try {
//       await setDoc(testDocRef, {
//         test: true,
//         timestamp: new Date(),
//         userId: currentUser.uid
//       });
//       console.log('✅ Test document created successfully');
      
//       // Проверим что документ создался
//       const testDoc = await getDoc(testDocRef);
//       console.log('✅ Test document verified:', testDoc.exists());
//     } catch (testError) {
//       console.error('❌ Test document creation failed:', testError);
//     }

//     return true;
//   } catch (error) {
//     console.error('💥 Firebase connection test failed:', error);
//     return false;
//   }
// };