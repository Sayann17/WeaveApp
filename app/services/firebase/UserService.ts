import { collection, doc, getDoc, getDocs, query, updateDoc, where } from 'firebase/firestore';
import { auth, firestore } from '../../config/firebase';
import { enhancedMatchService } from '../head_match';
import { IUserService, SearchFilters, UserProfile } from '../interfaces';

export class FirebaseUserService implements IUserService {

    async getCurrentUser(): Promise<UserProfile | null> {
        const user = auth.currentUser;
        if (!user) return null;

        const snap = await getDoc(doc(firestore, 'users', user.uid));
        if (!snap.exists()) return null;

        return this.mapToUserProfile(snap.id, snap.data());
    }

    async getUser(userId: string): Promise<UserProfile | null> {
        const snap = await getDoc(doc(firestore, 'users', userId));
        if (!snap.exists()) return null;
        return this.mapToUserProfile(snap.id, snap.data());
    }

    async updateProfile(userId: string, data: Partial<UserProfile>): Promise<void> {
        // Map UserProfile fields back to Firestore fields if names differ
        await updateDoc(doc(firestore, 'users', userId), data);
    }

    async getPotentialMatches(currentUserId: string, filters: SearchFilters): Promise<UserProfile[]> {
        const currentUser = await this.getCurrentUser();
        if (!currentUser) throw new Error("Current user not found");

        const usersRef = collection(firestore, 'users');
        const q = query(usersRef, where('profileCompleted', '==', true)); // Simple query, filter in memory

        const snapshot = await getDocs(q);
        const list: UserProfile[] = [];

        // Apply filters (Logic copied from ExploreScreen)
        const minAge = filters.minAge || 18;
        const maxAge = filters.maxAge || 100;
        const targetGender = filters.gender === 'all' ? null : filters.gender;
        const targetEth = filters.ethnicity?.trim().toLowerCase();
        const targetRel = filters.religion?.trim().toLowerCase();

        snapshot.forEach((d) => {
            if (d.id === currentUserId) return;
            const data = d.data();

            if (currentUser.likes?.includes(d.id)) return;
            if (currentUser.dislikes?.includes(d.id)) return;

            if (targetGender && data.gender !== targetGender) return;
            if ((data.age || 0) < minAge || (data.age || 0) > maxAge) return;

            if (targetEth) {
                const userEth = (data.customEthnicity || '').toLowerCase();
                if (!userEth.includes(targetEth)) return;
            }

            if (targetRel) {
                const userReligions = (data.religions || []).map((r: string) => r.toLowerCase());
                const hasMatch = userReligions.some((r: string) => r.includes(targetRel));
                if (!hasMatch) return;
            }

            list.push(this.mapToUserProfile(d.id, data));
        });

        // Use existing match service for sorting
        // Need to cast IUserService UserProfile to whatever enhancedMatchService expects if types differ slightly
        // For now trusting structure is compatible or effectively 'any' in legacy service
        return enhancedMatchService.sortProfilesByCulturalScore(currentUser, list);
    }

    private mapToUserProfile(id: string, data: any): UserProfile {
        return {
            id: id,
            name: data.name,
            age: data.age,
            photos: data.photos || [],
            bio: data.bio,
            gender: data.gender,
            macroGroups: data.macroGroups || [],
            customEthnicity: data.customEthnicity,
            zodiac: data.zodiac,
            religions: data.religions,
            profileCompleted: data.profileCompleted,
            location: data.location,
            lastActive: data.lastActive,
            preferences: data.preferences,
            likes: data.likes || [],
            dislikes: data.dislikes || []
        };
    }
}
