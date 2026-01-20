import { Image } from 'expo-image';
import React from 'react';
import { Dimensions, ScrollView, StyleSheet, View } from 'react-native';

const { width } = Dimensions.get('window');
const CONTAINER_PADDING = 20;
const AVAILABLE_WIDTH = width - (CONTAINER_PADDING * 2);
const CARD_WIDTH = AVAILABLE_WIDTH * 0.55; // Smaller to show side cards
const CARD_HEIGHT = CARD_WIDTH * (16 / 9);
const CARD_GAP = 12;

const PROFILE_IMAGES = [
    require('../../assets/images/onboarding_card_1.jpg'),
    require('../../assets/images/onboarding_card_2.jpg'),
    require('../../assets/images/onboarding_card_3.jpg'),
];

export const ProfileCarousel = () => {
    return (
        <View style={styles.carouselContainer}>
            <ScrollView
                horizontal={true}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.scrollContent}
                snapToInterval={CARD_WIDTH + CARD_GAP}
                decelerationRate="fast"
            >
                {PROFILE_IMAGES.map((source, index) => (
                    <View key={index} style={styles.cardWrapper}>
                        <View style={styles.innerCard}>
                            <View style={styles.notch} />
                            <Image
                                source={source}
                                style={styles.cardImage}
                                contentFit="cover"
                            />
                        </View>
                    </View>
                ))}
            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    carouselContainer: {
        width: '100%',
        height: CARD_HEIGHT + 20,
    },
    scrollContent: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: (width - CARD_WIDTH) / 2 - CONTAINER_PADDING, // Center first card
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
        borderWidth: 6,
        borderColor: '#1c1c1e',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.25,
        shadowRadius: 10,
        elevation: 8,
    },
    notch: {
        position: 'absolute',
        top: 0,
        alignSelf: 'center',
        width: '40%',
        height: 18,
        backgroundColor: '#1c1c1e',
        borderBottomLeftRadius: 10,
        borderBottomRightRadius: 10,
        zIndex: 10,
    },
    cardImage: {
        width: '100%',
        height: '100%',
        backgroundColor: '#333',
    },
});
