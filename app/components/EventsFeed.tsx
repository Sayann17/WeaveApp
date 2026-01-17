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

export const EventsFeed = ({ onScrollToTop }: { onScrollToTop?: () => void }) => {
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

        // Client-side sort: Priority based (sortOrder ASC)
        // If sortOrder is missing, push to end.
        data.sort((a, b) => {
            const orderA = a.sortOrder ?? 9999;
            const orderB = b.sortOrder ?? 9999;
            return orderA - orderB;
        });

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

    const handleScroll = (e: any) => {
        const contentOffsetX = e.nativeEvent.contentOffset.x;
        // Adjusted for new card width + margin
        const cardWidth = width * 0.9 + 10;
        const index = Math.round(contentOffsetX / cardWidth);

        if (index !== currentSlide) {
            setCurrentSlide(index);
            // Scroll to top when changing slide
            if (onScrollToTop) onScrollToTop();
        }
    };

    if (loading) return <View style={styles.center}><ActivityIndicator color={theme.text} /></View>;
    if (events.length === 0) return <View style={styles.center}><Text style={{ color: theme.subText }}>Событий пока нет</Text></View>;

    return (
        <View style={styles.container}>
            <View>
                <FlatList
                    data={events}
                    horizontal
                    pagingEnabled={false}
                    snapToInterval={width * 0.9 + 15}
                    decelerationRate="fast"
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ paddingHorizontal: 10 }}
                    onScroll={handleScroll}
                    scrollEventThrottle={16}
                    keyExtractor={(item) => item.id}
                    renderItem={({ item }) => (
                        <EventCard
                            event={item}
                            theme={theme}
                            isLight={isLight}
                            onAttend={handleAttend}
                            onCollapse={onScrollToTop}
                        />
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

const EventCard = ({ event, theme, isLight, onAttend, onCollapse }: { event: WeaveEvent, theme: any, isLight: boolean, onAttend: (id: string) => void, onCollapse?: () => void }) => {
    const [expanded, setExpanded] = useState(false);

    const toggleExpand = () => {
        if (expanded) {
            // Collapsing
            setExpanded(false);
            if (onCollapse) onCollapse();
        } else {
            setExpanded(true);
        }
    };

    return (
        <View style={styles.cardContainer}>
            {/* Visual Layer */}
            <View style={[styles.imageWrapper, { backgroundColor: isLight ? '#f0f0f0' : '#1a1a1a' }]}>
                <Image
                    source={EVENT_IMAGES[event.imageKey] || EVENT_IMAGES['uzor_love']}
                    style={styles.image}
                    resizeMode="cover"
                />
                <View style={styles.overlay} />
            </View>

            {/* Content Layer */}
            <View style={styles.contentContainer}>
                <View style={styles.metaRow}>
                    <Text style={styles.dateText}>
                        {new Date(event.date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' }).toUpperCase()}
                    </Text>
                    <View style={styles.dot} />
                    <Text style={styles.timeText}>19:00</Text>
                </View>

                <Text style={[styles.title, { color: theme.text }]}>{event.title}</Text>

                <Text
                    style={[styles.description, { color: theme.subText }]}
                    numberOfLines={expanded ? undefined : 3}
                >
                    {event.description}
                </Text>

                {/* Show toggle only if text is likely long enough, but simple toggle is safer for UX here */}
                <TouchableOpacity onPress={toggleExpand} hitSlop={{ top: 10, bottom: 10 }}>
                    <Text style={{ color: Colors.primary, marginBottom: 20, fontWeight: '600' }}>
                        {expanded ? 'Свернуть' : 'Показать полностью'}
                    </Text>
                </TouchableOpacity>

                {/* Action Row */}
                {expanded && (
                    <View style={styles.actionRow}>
                        <TouchableOpacity
                            onPress={() => Linking.openURL('https://forms.gle/uktQtqpxntwTo2Pb9')}
                            style={styles.detailsButton}
                        >
                            <Text style={[styles.detailsText, { color: Colors.primary }]}>Подробнее</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            onPress={() => onAttend(event.id)}
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
                )}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1 },
    center: { padding: 20, alignItems: 'center' },

    cardContainer: {
        width: width * 0.9,
        marginRight: 15, // Space between cards
        marginBottom: 0
    },

    imageWrapper: {
        width: '100%',
        height: width * 0.9, // Square-ish aspect ratio relative to card width
        position: 'relative',
        borderRadius: 20, // Add more rounding for card look
        overflow: 'hidden',
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
