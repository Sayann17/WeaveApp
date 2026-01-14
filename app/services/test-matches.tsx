// import { doc, getDoc } from 'firebase/firestore';
// import { auth, firestore } from '../config/firebase';

// export const checkUserMatches = async (userId?: string) => {
//   try {
//     const userToCheck = userId || auth.currentUser?.uid;
//     if (!userToCheck) {
//       console.log('❌ No user specified and no current user');
//       return;
//     }

//     console.log('🔍 CHECKING MATCHES FOR USER:', userToCheck);
    
//     const userDoc = await getDoc(doc(firestore, 'users', userToCheck));
//     if (userDoc.exists()) {
//       const userData = userDoc.data();
//       console.log('📊 USER DATA:', {
//         name: userData.name,
//         likes: userData.likes?.length || 0,
//         dislikes: userData.dislikes?.length || 0,
//         matches: userData.matches?.length || 0,
//         matchIds: userData.matches || []
//       });

//       // Проверим каждого мэтча
//       if (userData.matches && userData.matches.length > 0) {
//         console.log('🔎 CHECKING MATCH DETAILS:');
//         for (const matchId of userData.matches) {
//           const matchDoc = await getDoc(doc(firestore, 'users', matchId));
//           if (matchDoc.exists()) {
//             const matchData = matchDoc.data();
//             console.log(`   👥 Match with ${matchData.name}:`, {
//               id: matchId,
//               name: matchData.name,
//               hasCurrentInMatches: matchData.matches?.includes(userToCheck)
//             });
//           }
//         }
//       }
//     } else {
//       console.log('❌ User document not found');
//     }
//   } catch (error) {
//     console.error('❌ Error checking matches:', error);
//   }
// };