import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, ActivityIndicator, Dimensions } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { eventService, WeaveEvent } from '../services/EventService';
import { Colors } from '../constants/colors';
import { Ionicons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

// Mapping imageKey to local assets
const EVENT_IMAGES: Record<string, any> = {
    'uzor_love': require('../../assets/images/events/uzor_love.jpg'),
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
        const currentEvent = events.find(e => e.id === eventId);
        const newIsGoing = !currentEvent?.isGoing;

        // Optimistic update
        setEvents(prev => prev.map(e => e.id === eventId ? { ...e, isGoing: newIsGoing } : e));

        const success = await eventService.attendEvent(eventId);
        if (!success) {
            // Revert on failure
            setEvents(prev => prev.map(e => e.id === eventId ? { ...e, isGoing: !newIsGoing } : e));
        }
    };

    if (loading) return <View style={styles.center}><ActivityIndicator color={theme.text} /></View>;
    if (events.length === 0) return <View style={styles.center}><Text style={{ color: theme.subText }}>Событий пока нет</Text></View>;

    return (
        <View style={styles.container}>
            <Text style={[styles.headerTitle, { color: theme.text }]}>События</Text>

            {events.map((event) => (
                <View key={event.id} style={styles.cardContainer}>
                    {/* Visual Layer */}
                    <View style={[styles.imageWrapper, { backgroundColor: isLight ? '#f0f0f0' : '#1a1a1a' }]}>
                        <Image
                            source={EVENT_IMAGES[event.imageKey]}
                            style={styles.image}
                            resizeMode="cover"
                        />
                        {/* Overlay Gradientish View */}
                        <View style={styles.overlay} />
                    </View>

                    {/* Content Layer - Overlapping */}
                    <View style={styles.contentContainer}>
                        <View style={styles.metaRow}>
                            <Text style={styles.dateText}>
                                {new Date(event.date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' }).toUpperCase()}
                            </Text>
                            <View style={styles.dot} />
                            <Text style={styles.timeText}>19:00</Text>
                        </View>

                        <Text style={[styles.title, { color: theme.text }]}>{event.title}</Text>
                        <Text style={[styles.description, { color: theme.subText }]}>{event.description}</Text>

                        {/* Action Row */}
                        <View style={styles.actionRow}>
                            {/* Facepile Mockup */}
                            <View style={styles.facepile}>
                                {[1, 2, 3].map(i => (
                                    <View key={i} style={[styles.faceAvatar, { backgroundColor: isLight ? '#ddd' : '#333', borderColor: theme.cardBg, marginLeft: i > 1 ? -10 : 0 }]} />
                                ))}
                                <Text style={[styles.attendeeText, { color: theme.subText }]}>+14 идут</Text>
                            </View>

                            <TouchableOpacity
                                onPress={() => handleAttend(event.id)}
                                activeOpacity={0.8}
                                style={[
                                    styles.attendButton,
                                    { backgroundColor: event.isGoing ? (isLight ? '#F2F2F7' : 'rgba(255,255,255,0.1)') : Colors.primary }
                                ]}
                            >
                                {event.isGoing ? (
                                    <Ionicons name="checkmark" size={20} color={isLight ? Colors.primary : '#fff'} />
                                ) : (
                                    <Text style={[styles.buttonText, { color: '#fff' }]}>Пойду</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            ))}
        </View>
    );
};

const styles = StyleSheet.create({
    container: { paddingBottom: 100, paddingTop: 20 },
    center: { padding: 20, alignItems: 'center' },
    headerTitle: { fontSize: 34, fontWeight: '800', paddingHorizontal: 20, marginBottom: 20, letterSpacing: -1 },

    cardContainer: { marginBottom: 40 },

    imageWrapper: {
        width: width,
        height: width * 1.2, // Portrait 4:5
        position: 'relative',
    },
    image: { width: '100%', height: '100%' },
    overlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.1)', // Subtle dim
    },

    badgeContainer: { position: 'absolute', top: 20, left: 20 },
    glassBadge: {
        backgroundColor: 'rgba(255,255,255,0.9)',
        paddingHorizontal: 12, paddingVertical: 6,
        borderRadius: 100,
        shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3,
    },
    badgeText: { fontSize: 11, fontWeight: '800', color: '#000', letterSpacing: 0.5 },

    contentContainer: {
        marginTop: 20,
        marginHorizontal: 20,
        backgroundColor: 'transparent',
    },

    metaRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
    dateText: { fontSize: 13, fontWeight: '700', color: Colors.primary, letterSpacing: 1 },
    timeText: { fontSize: 13, fontWeight: '600', color: '#888' },
    dot: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: '#888', marginHorizontal: 8 },

    title: { fontSize: 28, fontWeight: '700', marginBottom: 10, lineHeight: 32 },
    description: { fontSize: 16, lineHeight: 24, marginBottom: 20 },

    actionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },

    facepile: { flexDirection: 'row', alignItems: 'center' },
    faceAvatar: { width: 28, height: 28, borderRadius: 14, borderWidth: 2 },
    attendeeText: { marginLeft: 8, fontSize: 13, fontWeight: '500' },

    attendButton: {
        paddingHorizontal: 24,
        paddingVertical: 12,
        borderRadius: 30,
        minWidth: 100,
        alignItems: 'center',
        justifyContent: 'center',
    },
    buttonText: { fontSize: 16, fontWeight: '700' }
});
