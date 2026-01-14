import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { eventService, WeaveEvent } from '../services/EventService';
import { Colors } from '../constants/colors';
import { Ionicons } from '@expo/vector-icons';

// Mapping imageKey to local assets
const EVENT_IMAGES: Record<string, any> = {
    'uzor_love': require('../../assets/images/events/uzor_love.jpg'),
    // Add placeholders or other keys here
};

export const EventsFeed = () => {
    const { theme, themeType } = useTheme();
    const [events, setEvents] = useState<WeaveEvent[]>([]);
    const [loading, setLoading] = useState(true);

    const isLight = themeType === 'light';

    useEffect(() => {
        loadEvents();
    }, []);

    const loadEvents = async () => {
        setLoading(true);
        const data = await eventService.getEvents();
        setEvents(data);
        setLoading(false);
    };

    const handleAttend = async (eventId: string) => {
        // Optimistic update
        setEvents(prev => prev.map(e => e.id === eventId ? { ...e, isGoing: true } : e));

        const success = await eventService.attendEvent(eventId);
        if (!success) {
            // Revert on failure
            setEvents(prev => prev.map(e => e.id === eventId ? { ...e, isGoing: false } : e));
        }
    };

    if (loading) {
        return (
            <View style={{ padding: 20, alignItems: 'center' }}>
                <ActivityIndicator color={theme.text} />
            </View>
        );
    }

    if (events.length === 0) {
        return (
            <View style={{ padding: 20, alignItems: 'center' }}>
                <Text style={{ color: theme.subText }}>Пока нет событий</Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <Text style={[styles.title, { color: theme.text, borderColor: theme.border }]}>Лента событий</Text>

            {events.map((event) => (
                <View key={event.id} style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.border, borderWidth: isLight ? 1 : 0 }]}>
                    {/* Image */}
                    <View style={styles.imageContainer}>
                        <Image
                            source={EVENT_IMAGES[event.imageKey]}
                            style={styles.image}
                            resizeMode="cover"
                        />
                        <View style={styles.dateBadge}>
                            <Text style={styles.dateText}>
                                {new Date(event.date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}
                            </Text>
                        </View>
                    </View>

                    <View style={styles.content}>
                        <Text style={[styles.eventTitle, { color: theme.text }]}>{event.title}</Text>
                        <Text style={[styles.description, { color: theme.subText }]}>{event.description}</Text>

                        <TouchableOpacity
                            onPress={() => !event.isGoing && handleAttend(event.id)}
                            activeOpacity={0.8}
                            style={[
                                styles.button,
                                { backgroundColor: event.isGoing ? (isLight ? '#e0e0e0' : '#333') : Colors.primary }
                            ]}
                        >
                            {event.isGoing ? (
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                    <Ionicons name="checkmark-circle" size={20} color={isLight ? '#4ADE80' : '#4ADE80'} />
                                    <Text style={[styles.buttonText, { color: theme.text }]}>Вы идете</Text>
                                </View>
                            ) : (
                                <Text style={[styles.buttonText, { color: '#fff' }]}>Пойду!</Text>
                            )}
                        </TouchableOpacity>
                    </View>
                </View>
            ))}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        width: '100%',
        paddingBottom: 40,
    },
    title: {
        fontSize: 22,
        fontWeight: 'bold',
        marginBottom: 15,
        paddingHorizontal: 20,
    },
    card: {
        marginBottom: 25,
        borderRadius: 20,
        overflow: 'hidden',
        marginHorizontal: 16,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 10,
        elevation: 5,
    },
    imageContainer: {
        width: '100%',
        height: 400, // Large distinct image
        position: 'relative',
    },
    image: {
        width: '100%',
        height: '100%',
    },
    dateBadge: {
        position: 'absolute',
        top: 15,
        right: 15,
        backgroundColor: 'rgba(0,0,0,0.7)',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.2)'
    },
    dateText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 14,
    },
    content: {
        padding: 20,
    },
    eventTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        marginBottom: 10,
        fontFamily: 'System', // Or custom font
    },
    description: {
        fontSize: 15,
        lineHeight: 22,
        marginBottom: 20,
    },
    button: {
        paddingVertical: 14,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
    },
    buttonText: {
        fontSize: 16,
        fontWeight: 'bold',
    }
});
