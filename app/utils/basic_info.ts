// utils/basic_info.ts

export type Gender = 'male' | 'female';

// ------------------------------------------------------------------
// 🔥 1. ИНТЕРЕСЫ (Добавили сюда, чтобы не дублировать в коде)
// ------------------------------------------------------------------
export const availableInterests = [
  'Кино', 'Путешествия', 'Спорт', 'Чтение', 'Музыка', 'Готовка',
  'Йога', 'Игры', 'Искусство', 'Технологии', 'Природа', 'Танцы',
  'Фотография', 'Бизнес', 'Саморазвитие', 'Волонтерство', 'Мода',
  'Автомобили', 'Наука', 'Политика'
];

// ------------------------------------------------------------------
// 2. НАЦИОНАЛЬНОСТИ (Используются для иконок флагов)
// ------------------------------------------------------------------
export interface Nationality {
  id: string;
  name: string;
  femaleName: string;
  flag: string;
  maleIcon: string;
  femaleIcon: string;
}

// ------------------------------------------------------------------
// 3. ЗНАКИ ЗОДИАКА
// ------------------------------------------------------------------
export const zodiacSigns = [
  { id: 'aries', name: 'Овен', emoji: '♈', dates: '21.03 - 19.04', element: 'fire' },
  { id: 'taurus', name: 'Телец', emoji: '♉', dates: '20.04 - 20.05', element: 'earth' },
  { id: 'gemini', name: 'Близнецы', emoji: '♊', dates: '21.05 - 20.06', element: 'air' },
  { id: 'cancer', name: 'Рак', emoji: '♋', dates: '21.06 - 22.07', element: 'water' },
  { id: 'leo', name: 'Лев', emoji: '♌', dates: '23.07 - 22.08', element: 'fire' },
  { id: 'virgo', name: 'Дева', emoji: '♍', dates: '23.08 - 22.09', element: 'earth' },
  { id: 'libra', name: 'Весы', emoji: '♎', dates: '23.09 - 22.10', element: 'air' },
  { id: 'scorpio', name: 'Скорпион', emoji: '♏', dates: '23.10 - 21.11', element: 'water' },
  { id: 'sagittarius', name: 'Стрелец', emoji: '♐', dates: '22.11 - 21.12', element: 'fire' },
  { id: 'capricorn', name: 'Козерог', emoji: '♑', dates: '22.12 - 19.01', element: 'earth' },
  { id: 'aquarius', name: 'Водолей', emoji: '♒', dates: '20.01 - 18.02', element: 'air' },
  { id: 'pisces', name: 'Рыбы', emoji: '♓', dates: '19.02 - 20.03', element: 'water' },
];

export const getZodiacSignById = (id?: string | null) => {
  return zodiacSigns.find(z => z.id === id);
};

// ------------------------------------------------------------------
// 4. РЕЛИГИИ
// ------------------------------------------------------------------
export const religions = [
  { id: 'christianity', name: 'Христианство', emoji: '✝️' },
  { id: 'islam', name: 'Ислам', emoji: '☪️' },
  { id: 'judaism', name: 'Иудаизм', emoji: '✡️' },
  { id: 'buddhism', name: 'Буддизм', emoji: '☸️' },
  { id: 'hinduism', name: 'Индуизм', emoji: '🕉️' },
  { id: 'tongue', name: 'Язычество', emoji: '🌀' },
  { id: 'shamanism', name: 'Шаманизм', emoji: '🌀' },
  { id: 'tengri', name: 'Тенгрианство', emoji: '🌀' },
  { id: 'spiritual', name: 'Духовный, но не религиозный', emoji: '✨' },
  { id: 'atheist', name: 'Атеизм', emoji: '⚛️' },
];

export const getReligionById = (id: string) => {
  return religions.find(r => r.id === id);
};