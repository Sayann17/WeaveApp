export interface User {
    uid: string;
    email: string | null;
    displayName: string | null;
    photoURL: string | null;
    emailVerified: boolean;
    metadata?: {
        creationTime?: string;
        lastSignInTime?: string;
    };
    profile_completed?: number;
    name?: string;
    age?: number;
    gender?: 'male' | 'female';
    ethnicity?: string;
    religions?: string[];
    zodiac?: string;
    about?: string;
    bio?: string;
    job?: string;
    interests?: string[];
    photos?: string[];
    macroGroups?: string[];
    culturePride?: string;
    loveLanguage?: string;
    familyMemory?: string;
    stereotypeTrue?: string;
    stereotypeFalse?: string;
    isVisible?: boolean;
    latitude?: number;
    longitude?: number;
    city?: string;
    socialTelegram?: string;
    socialVk?: string;
    socialInstagram?: string;
}

export interface IAuthService {


    /**
     * Log out the current user
     */
    logout(): Promise<void>;

    /**
     * Get the currently logged-in user (if any)
     */
    getCurrentUser(): User | null;

    /**
     * Subscribe to auth state changes
     * Returns an unsubscribe function
     */
    /**
     * Update user profile
     */
    updateProfile(data: Partial<User> & Record<string, any>): Promise<void>;

    /**
     * Delete the current user account
     */
    deleteAccount(): Promise<void>;
}
