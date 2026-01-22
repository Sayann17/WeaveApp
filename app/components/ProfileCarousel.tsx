import { Image } from 'expo-image';
import React, { useState } from 'react';
import { Dimensions, NativeScrollEvent, NativeSyntheticEvent, ScrollView, StyleSheet, View } from 'react-native';

const { width } = Dimensions.get('window');
const CONTAINER_PADDING = 20;
const CARD_WIDTH = (width - CONTAINER_PADDING * 2) * 0.55; // Smaller to show side cards
const CARD_HEIGHT = CARD_WIDTH * (16 / 9);
const CARD_GAP = 12;

const PROFILE_IMAGES = [
    require('../../assets/images/onboarding_card_1.jpg'),
    require('../../assets/images/onboarding_card_2.jpg'),
    require('../../assets/images/onboarding_card_3.jpg'),
];

export const ProfileCarousel = () => {
    const [activeIndex, setActiveIndex] = useState(0);

    const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
        const scrollX = event.nativeEvent.contentOffset.x;
        const index = Math.round(scrollX / (CARD_WIDTH + CARD_GAP));
        setActiveIndex(Math.min(Math.max(0, index), PROFILE_IMAGES.length - 1));
    };

    return (
        <View style={styles.carouselContainer}>
            <ScrollView
                horizontal={true}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.scrollContent}
                snapToInterval={CARD_WIDTH + CARD_GAP}
                decelerationRate="fast"
                onScroll={handleScroll}
                scrollEventThrottle={16}
            >
                {PROFILE_IMAGES.map((source, index) => (
                    <View key={index} style={styles.cardWrapper}>
                        <View style={styles.innerCard}>
                            <Image
                                source={source}
                                style={styles.cardImage}
                                contentFit="cover"
                            />
                        </View>
                    </View>
                ))}
            </ScrollView>

            {/* Page Indicator */}
            <View style={styles.indicatorContainer}>
                {PROFILE_IMAGES.map((_, index) => (
                    <View
                        key={index}
                        style={[
                            styles.indicator,
                            activeIndex === index ? styles.indicatorActive : styles.indicatorInactive,
                        ]}
                    />
                ))}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    carouselContainer: {
        width: '100%',
    },
    scrollContent: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingLeft: 0, // Сдвинуто влево
        paddingRight: CONTAINER_PADDING,
        gap: CARD_GAP,
    },
    cardWrapper: {
        width: CARD_WIDTH,
        height: CARD_HEIGHT,
    },
    innerCard: {
        width: '100%',
        height: '100%',
        borderRadius: 20,
        backgroundColor: '#000',
        overflow: 'hidden',
        borderWidth: 4,
        borderColor: '#2a2a2a',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.25,
        shadowRadius: 10,
        elevation: 8,
    },
    cardImage: {
        width: '100%',
        height: '100%',
        backgroundColor: '#333',
    },
    indicatorContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 16,
        gap: 8,
    },
    indicator: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    indicatorActive: {
        backgroundColor: '#1c1c1e',
    },
    indicatorInactive: {
        backgroundColor: '#b0b0b0',
    },
});
