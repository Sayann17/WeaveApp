// Этот интерфейс используется для карточек в explore
export interface UserProfile {
  id: string;
  name: string;
  age: number;
  photos: string[];
  bio?: string;
  gender: string;
  
  // 🔥 НОВЫЕ ПОЛЯ
  macroGroups?: string[];
  ethnicities?: string[];
  customEthnicity?: string; // 🔥 НОВОЕ ПОЛЕ: Свободный ввод
  score?: string[];
  
  zodiac?: string;
  religions?: string[];
  profileCompleted: boolean;
}

// Этот интерфейс используется для текущего пользователя (с приватными данными)
export interface CurrentUser extends UserProfile {
  email: string;
  likes: string[];
  dislikes: string[];
  matches: string[];
  matchedAt?: Date;
  preferences: {
    ageRange: [number, number];
    distance: number;
    // 🔥 НОВЫЕ ПОЛЯ ДЛЯ НАСТРОЕК ПОИСКА
    ethnicityPreferenceMode?: 'strict' | 'flexible' | 'ignore';
    preferredMacroGroups?: string[];
  };
  createdAt: Date;
  updatedAt?: Date;
}