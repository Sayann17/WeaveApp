// utils/ethnicities.ts

export interface EthnicityGroup {
  id: string;
  name: string;
  emoji: string;
  description: string;
}

// 🔥 ЧИСТЫЙ СПИСОК: Только группы. Никаких вложенных списков.
export const ethnicityGroups: EthnicityGroup[] = [
  {
    id: 'slavic',
    name: 'Славянские',
    emoji: '🌾',
    description: 'Общие корни, языковая близость'
  },
  {
    id: 'asian',
    name: 'Азиатские',
    emoji: '🌏',
    description: 'Центральная и Восточная Азия'
  },
  {
    id: 'caucasian',
    name: 'Кавказские',
    emoji: '🏔️',
    description: 'Гордость, традиции, гостеприимство'
  },
  {
    id: 'turkic',
    name: 'Тюркские',
    emoji: '🐎',
    description: 'Наследие степи'
  },
  {
    id: 'finno_ugric',
    name: 'Финно-угорские',
    emoji: '🌲',
    description: 'Народы севера и Поволжья'
  },
  {
    id: 'european',
    name: 'Европейские',
    emoji: '🏰',
    description: 'Западная культура'
  },
  {
    id: 'indo_european',
    name: 'Индоевропейские корни',
    emoji: '🏛️',
    description: 'Общее наследие'
  },
  {
    id: 'arab',
    name: 'Арабские',
    emoji: '🕌',
    description: 'Арабский мир и культура'
  },
  {
    id: 'african',
    name: 'Африканские',
    emoji: '🌍',
    description: 'Африканский континент'
  },
  {
    id: 'world_citizen',
    name: 'Человек мира',
    emoji: '🌐',
    description: 'Гражданин планеты'
  }
];

// Хелпер стал проще: нам нужно только название группы
export const getMacroGroupNameById = (id: string): string => {
  const group = ethnicityGroups.find(g => g.id === id);
  return group ? group.name : id;
};