import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Dimensions, FlatList, Image, Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Colors } from '../constants/colors';
import { useTheme } from '../context/ThemeContext';
import { eventService, WeaveEvent } from '../services/EventService';

const { width } = Dimensions.get('window');

// Mapping imageKey to local assets
const EVENT_IMAGES: Record<string, any> = {
    'uzor_love': require('../../assets/images/events/uzor_love.jpg'),
    'tuva_culture': require('../../assets/images/events/tuva_culture.jpg'),
};

export const EventsFeed = () => {
    const { theme, themeType } = useTheme();
    const [events, setEvents] = useState<WeaveEvent[]>([]);
    const [loading, setLoading] = useState(true);
    const [currentSlide, setCurrentSlide] = useState(0);

    const isLight = themeType === 'light';

    useEffect(() => {
        loadEvents();
    }, []);

    const loadEvents = async () => {
        setLoading(true);
        // data from API
        const data = await eventService.getEvents();

        setEvents(data);
        setLoading(false);
    };

    const handleAttend = async (eventId: string) => {
        const currentEvent = events.find(e => e.id === eventId);
        const newIsGoing = !currentEvent?.isGoing;

        // Optimistic update
        setEvents(prev => prev.map(e => e.id === eventId ? { ...e, isGoing: newIsGoing } : e));

        // Don't actually call API for mock event
        if (eventId.startsWith('mock-')) return;

        const success = await eventService.attendEvent(eventId);
        if (!success) {
            // Revert on failure
            setEvents(prev => prev.map(e => e.id === eventId ? { ...e, isGoing: !newIsGoing } : e));
        }
    };

    const handleScroll = (e: any) => {
        const contentOffsetX = e.nativeEvent.contentOffset.x;
        const index = Math.round(contentOffsetX / width);
        setCurrentSlide(index);
    };

    if (loading) return <View style={styles.center}><ActivityIndicator color={theme.text} /></View>;
    if (events.length === 0) return <View style={styles.center}><Text style={{ color: theme.subText }}>Событий пока нет</Text></View>;

    return (
        <View style={styles.container}>
            <View style={{ flex: 1 }}>
                <FlatList
                    data={events}
                    horizontal
                    pagingEnabled
                    showsHorizontalScrollIndicator={false}
                    onScroll={handleScroll}
                    scrollEventThrottle={16}
                    keyExtractor={(item) => item.id}
                    renderItem={({ item: event }) => (
                        <View style={styles.cardContainer}>
                            {/* Visual Layer */}
                            <View style={[styles.imageWrapper, { backgroundColor: isLight ? '#f0f0f0' : '#1a1a1a' }]}>
                                <Image
                                    source={EVENT_IMAGES[event.imageKey] || EVENT_IMAGES['uzor_love']}
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
                                    <TouchableOpacity
                                        onPress={() => Linking.openURL('https://forms.gle/uktQtqpxntwTo2Pb9')}
                                        style={styles.detailsButton}
                                    >
                                        <Text style={[styles.detailsText, { color: Colors.primary }]}>Подробнее</Text>
                                    </TouchableOpacity>

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
                    )}
                />
            </View>

            {/* Paginator Dots */}
            {events.length > 1 && (
                <View style={styles.pagination}>
                    {events.map((_, index) => (
                        <View
                            key={index}
                            style={[
                                styles.paginationDot,
                                index === currentSlide
                                    ? { backgroundColor: theme.text, width: 20 }
                                    : { backgroundColor: theme.subText }
                            ]}
                        />
                    ))}
                </View>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1 },
    center: { padding: 20, alignItems: 'center' },

    cardContainer: { width: width, marginBottom: 0 },

    imageWrapper: {
        width: width,
        height: width * 1.0, // Reduced height for carousel feel
        position: 'relative',
    },
    image: { width: '100%', height: '100%' },
    overlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.1)',
    },

    contentContainer: {
        marginTop: 20,
        paddingHorizontal: 20,
        backgroundColor: 'transparent',
    },

    metaRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
    dateText: { fontSize: 13, fontWeight: '700', color: Colors.primary, letterSpacing: 1 },
    timeText: { fontSize: 13, fontWeight: '600', color: '#888' },
    dot: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: '#888', marginHorizontal: 8 },

    title: { fontSize: 28, fontWeight: '700', marginBottom: 10, lineHeight: 32 },
    description: { fontSize: 16, lineHeight: 24, marginBottom: 20 },

    actionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },

    attendButton: {
        paddingHorizontal: 24,
        paddingVertical: 12,
        borderRadius: 30,
        minWidth: 100,
        alignItems: 'center',
        justifyContent: 'center',
    },
    buttonText: { fontSize: 16, fontWeight: '700' },

    detailsButton: {
        paddingVertical: 10,
        paddingHorizontal: 20,
        borderRadius: 30,
        borderWidth: 1.5,
        borderColor: Colors.primary,
        justifyContent: 'center',
        alignItems: 'center',
    },
    detailsText: {
        fontSize: 15,
        fontWeight: '700',
    },

    pagination: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 20,
        marginBottom: 30,
        gap: 8
    },
    paginationDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    }
});
