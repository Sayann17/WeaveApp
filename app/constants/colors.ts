// constants/colors.ts

export const Colors = {
  // 🔥 ДОБАВЛЯЕМ "as [string, string, ...string[]]" - это фиксирует ошибку
  backgroundGradient: ['#0b0d15', '#1a1f35', '#2b3252'] as [string, string, ...string[]],

  background: '#1a0f0f',

  card: 'rgba(255, 255, 255, 0.05)',
  cardBorder: 'rgba(255, 255, 255, 0.1)',

  primary: '#E07A5F',

  // 🔥 И здесь тоже добавим на всякий случай
  primaryGradient: ['#E07A5F', '#9D4E3F'] as [string, string, ...string[]],

  secondary: '#81B29A',
  text: '#EAE2D6',
  textMuted: '#9CA3AF',
  border: '#333036',
  shadow: '#000000',
  error: '#EF476F',
};