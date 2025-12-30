export interface UserProfile {
    id: string;
    name: string;
    age: number;
    photos: string[];
    bio?: string;
    gender: 'male' | 'female';
    macroGroups: string[];
    customEthnicity?: string;
    zodiac?: string;
    religions?: string[];
    interests?: string[];
    profileCompleted: boolean;
    // Personality Hooks
    culturePride?: string;
    loveLanguage?: string;
    familyMemory?: string;
    stereotypeTrue?: string;
    stereotypeFalse?: string;
    location?: {
        latitude: number;
        longitude: number;
    };
    lastActive?: number;
    // Preferences
    preferences?: {
        ageRange?: [number, number];
        distance?: number;
        gender?: 'male' | 'female' | 'all';
    };
    likes?: string[];
    dislikes?: string[];
}

export interface SearchFilters {
    gender?: 'male' | 'female' | 'all';
    minAge?: number;
    maxAge?: number;
    ethnicity?: string;
    religion?: string;
    macroGroups?: string[];
}

export interface IUserService {
    getCurrentUser(): Promise<UserProfile | null>;
    getUser(userId: string): Promise<UserProfile | null>;
    updateProfile(userId: string, data: Partial<UserProfile>): Promise<void>;
    getPotentialMatches(currentUserId: string, filters: SearchFilters): Promise<UserProfile[]>;
}

export interface IAuthService {
    signIn(phone: string): Promise<void>;
    signOut(): Promise<void>;
    getCurrentUserId(): string | null;
}
