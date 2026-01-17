import { format, isSameWeek, isToday } from 'date-fns';
import { ru } from 'date-fns/locale';

export const formatMessageTime = (dateInput?: string | number | Date | null): string => {
    if (!dateInput) return '';

    const date = new Date(dateInput);

    // Check if date is valid
    if (isNaN(date.getTime())) return '';

    if (isToday(date)) {
        return format(date, 'HH:mm');
    }

    if (isSameWeek(date, new Date(), { weekStartsOn: 1 })) {
        // "E" gives short day name (Пн, Вт...)
        const dayName = format(date, 'E', { locale: ru });
        // Ensure first letter is uppercase just in case
        return dayName.charAt(0).toUpperCase() + dayName.slice(1);
    }

    // Older than a week
    return format(date, 'dd.MM');
};
