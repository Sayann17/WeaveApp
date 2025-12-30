//отдельная функция для национальности

export interface Nationality {
  id: string;
  name: string;
  femaleName: string;
  flag: string;
}

export const nationalities: Nationality[] = [
  { id: 'russian', name: 'Русский', femaleName: 'Русская', flag: '🇷🇺' },
  { id: 'sakha', name: 'Якут', femaleName: 'Якутка', flag: '❄️' },
  { id: 'kalmyk', name: 'Калмык', femaleName: 'Калмычка', flag: '🌾' },
  { id: 'buryat', name: 'Бурят', femaleName: 'Бурятка', flag: '🏔️' },
  { id: 'tuvan', name: 'Тувинец', femaleName: 'Тувинка', flag: '🐎' },
];

export const getNationalityDisplay = (nationalityId: string, gender: 'male' | 'female'): string => {
  const nationality = nationalities.find(nat => nat.id === nationalityId);
  if (!nationality) return nationalityId;
  
  return gender === 'female' ? nationality.femaleName : nationality.name;
};

export const getNationalityFlag = (nationalityId: string): string => {
  const nationality = nationalities.find(nat => nat.id === nationalityId);
  return nationality ? nationality.flag : '🏳️';
};

export const getNationalityById = (id: string): Nationality | undefined => {
  return nationalities.find(nat => nat.id === id);
};

export const getNationalityName = (nationality: Nationality, gender: 'male' | 'female'): string => {
  return gender === 'female' ? nationality.femaleName : nationality.name;
};


//Отдельная функция для знаков зодиака

export interface ZodiacSign {
  id: string;
  name: string;
  emoji: string;
  dates: string;
}

export const zodiacSigns: ZodiacSign[] = [
  { id: 'aries', name: 'Овен', emoji: '♈', dates: '21 марта - 19 апреля' },
  { id: 'taurus', name: 'Телец', emoji: '♉', dates: '20 апреля - 20 мая' },
  { id: 'gemini', name: 'Близнецы', emoji: '♊', dates: '21 мая - 21 июня' },
  { id: 'cancer', name: 'Рак', emoji: '♋', dates: '22 июня - 22 июля' },
  { id: 'leo', name: 'Лев', emoji: '♌', dates: '23 июля - 22 августа' },
  { id: 'virgo', name: 'Дева', emoji: '♍', dates: '23 августа - 22 сентября' },
  { id: 'libra', name: 'Весы', emoji: '♎', dates: '23 сентября - 22 октября' },
  { id: 'scorpio', name: 'Скорпион', emoji: '♏', dates: '23 октября - 21 ноября' },
  { id: 'sagittarius', name: 'Стрелец', emoji: '♐', dates: '22 ноября - 21 декабря' },
  { id: 'capricorn', name: 'Козерог', emoji: '♑', dates: '22 декабря - 19 января' },
  { id: 'aquarius', name: 'Водолей', emoji: '♒', dates: '20 января - 18 февраля' },
  { id: 'pisces', name: 'Рыбы', emoji: '♓', dates: '19 февраля - 20 марта' },
];

export const getZodiacSignById = (id: string): ZodiacSign | undefined => {
  return zodiacSigns.find(sign => sign.id === id);
};