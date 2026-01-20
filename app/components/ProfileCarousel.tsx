
import { Image } from 'expo-image';
import React from 'react';
import { Dimensions, StyleSheet, View } from 'react-native';
import Animated, {
    Extrapolate,
    interpolate,
    SharedValue,
    useAnimatedScrollHandler,
    useAnimatedStyle,
    useSharedValue
} from 'react-native-reanimated';

const { width } = Dimensions.get('window');
const CONTAINER_PADDING = 20;
const AVAILABLE_WIDTH = width - (CONTAINER_PADDING * 2);
const CARD_WIDTH = AVAILABLE_WIDTH * 0.65;
const CARD_HEIGHT = CARD_WIDTH * (16 / 9);
const SPACER_WIDTH = (AVAILABLE_WIDTH - CARD_WIDTH) / 2;

const PROFILE_IMAGES = [
    require('../../assets/images/onboarding_card_1.jpg'),
    require('../../assets/images/onboarding_card_2.jpg'),
    require('../../assets/images/onboarding_card_3.jpg'),
];

// Separate component for each card - this allows proper hook usage
interface CarouselCardProps {
    source: any;
    cardIndex: number;
    scrollX: SharedValue<number>;
}

const CarouselCard = ({ source, cardIndex, scrollX }: CarouselCardProps) => {
    const inputRange = [
        (cardIndex - 1) * CARD_WIDTH,
        cardIndex * CARD_WIDTH,
        (cardIndex + 1) * CARD_WIDTH,
    ];

    const animatedStyle = useAnimatedStyle(() => {
        const scale = interpolate(
            scrollX.value,
            inputRange,
            [0.85, 1, 0.85],
            Extrapolate.CLAMP
        );
        const opacity = interpolate(
            scrollX.value,
            inputRange,
            [0.5, 1, 0.5],
            Extrapolate.CLAMP
        );
        return {
            transform: [{ scale }],
            opacity,
        };
    });

    return (
        <Animated.View style={[styles.cardWrapper, animatedStyle]}>
            <View style={styles.innerCard}>
                <View style={styles.notch} />
                <Image
                    source={source}
                    style={styles.cardImage}
                    contentFit="cover"
                />
            </View>
        </Animated.View>
    );
};

export const ProfileCarousel = () => {
    const scrollX = useSharedValue(0);

    const scrollHandler = useAnimatedScrollHandler((event) => {
        scrollX.value = event.contentOffset.x;
    });

    const data = ['spacer-left', ...PROFILE_IMAGES, 'spacer-right'];

    return (
        <View style={styles.carouselContainer}>
            <Animated.FlatList
                data={data}
                horizontal
                showsHorizontalScrollIndicator={false}
                snapToInterval={CARD_WIDTH}
                decelerationRate="fast"
                scrollEventThrottle={16}
                onScroll={scrollHandler}
                contentContainerStyle={{ alignItems: 'center' }}
                keyExtractor={(_, index) => index.toString()}
                renderItem={({ item, index }) => {
                    if (item === 'spacer-left' || item === 'spacer-right') {
                        return <View style={{ width: SPACER_WIDTH }} />;
                    }

                    return (
                        <CarouselCard
                            source={item}
                            cardIndex={index - 1}
                            scrollX={scrollX}
                        />
                    );
                }}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    carouselContainer: {
        height: CARD_HEIGHT + 20,
        width: width,
        justifyContent: 'center',
        alignItems: 'center',
    },
    cardWrapper: {
        width: CARD_WIDTH,
        height: CARD_HEIGHT,
        justifyContent: 'center',
        alignItems: 'center',
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
