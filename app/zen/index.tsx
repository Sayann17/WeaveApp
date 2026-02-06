import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import { Dimensions, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
    Easing,
    FadeIn,
    useAnimatedStyle,
    useSharedValue,
    withRepeat,
    withTiming
} from 'react-native-reanimated';
import { ZenService } from '../services/ZenService';

const { width } = Dimensions.get('window');

const QUOTES = [
    "Цветок не торопится распускаться, даже если ты очень ждешь. Позволь вашему диалогу расти в своем ритме.",
    "Чтобы наполнить чашу, её нужно сначала подставить под струю. Чтобы получить ответ, нужно сначала задать вопрос.",
    "Ветер дует, но гора остается неподвижной. Чужое 'нет' не меняет твоей истинной ценности.",
    "Не ищи того, с кем проживешь жизнь. Ищи того, с кем захочешь выпить этот чай здесь и сейчас."
];

export default function ZenScreen() {
    const router = useRouter();
    const [isRevealed, setIsRevealed] = useState(false);
    const [quoteIndex, setQuoteIndex] = useState(0);
    const [ripples, setRipples] = useState<{ id: number; x: number; y: number }[]>([]);

    const rotation = useSharedValue(0);
    const revealOpacity = useSharedValue(0);
    const contentTranslateY = useSharedValue(20);

    useEffect(() => {
        // Start infinite rotation
        rotation.value = withRepeat(
            withTiming(360, { duration: 80000, easing: Easing.linear }),
            -1,
            false
        );

        // Pick a random quote
        setQuoteIndex(Math.floor(Math.random() * QUOTES.length));
    }, []);

    const animatedRotation = useAnimatedStyle(() => {
        return {
            transform: [{ rotate: `${rotation.value}deg` }]
        };
    });

    const animatedReveal = useAnimatedStyle(() => {
        return {
            opacity: revealOpacity.value,
            transform: [{ translateY: contentTranslateY.value }]
        };
    });

    const handleInteraction = (event: any) => {
        if (isRevealed) return;

        const { locationX, locationY } = event.nativeEvent;
        const newRipple = { id: Date.now(), x: locationX, y: locationY };

        setRipples(prev => [...prev, newRipple]);

        // Cleanup ripple after animation (mocked by timeout here, mostly visual)
        setTimeout(() => {
            setRipples(prev => prev.filter(r => r.id !== newRipple.id));
        }, 2000);

        // Reveal logic
        if (!isRevealed) {
            setTimeout(() => {
                setIsRevealed(true);
                revealOpacity.value = withTiming(1, { duration: 1000 });
                contentTranslateY.value = withTiming(0, { duration: 1000, easing: Easing.out(Easing.exp) });
            }, 800);
        }
    };

    const handleAccept = async () => {
        await ZenService.markZenSeen();
        // Uses replacement to prevent going back to this screen
        router.replace('/(tabs)');
    };

    return (
        <View style={styles.container}>
            <StatusBar style="dark" />

            {/* Background Gradient Mock */}
            <View style={styles.gradientOverlay} pointerEvents="none" />

            {/* Header */}
            <View style={styles.header}>
                <Text style={styles.headerTitle}>ПАУЗА ДНЯ</Text>
                <View style={styles.separator} />
            </View>

            {/* Interaction Surface */}
            <Pressable
                style={styles.surface}
                onPress={handleInteraction}
            >
                {/* Uroboros Icon */}
                {!isRevealed && (
                    <Animated.View style={[styles.centerContent, { opacity: isRevealed ? 0 : 1 }]}>
                        <Animated.View style={[styles.uroborosContainer, animatedRotation]}>
                            <Image
                                source={require('../../assets/images/uroboros.jpg')}
                                style={styles.uroborosImage}
                                resizeMode="contain"
                            />
                        </Animated.View>
                        <Text style={styles.instructionText}>
                            РАЗОРВИ КРУГ{'\n'}ВЕЧНОГО ОЖИДАНИЯ
                        </Text>
                    </Animated.View>
                )}

                {/* Ripples */}
                {ripples.map(ripple => (
                    <Ripple key={ripple.id} x={ripple.x} y={ripple.y} />
                ))}

                {/* Quote (Revealed) */}
                {isRevealed && (
                    <Animated.View style={[styles.quoteContainer, animatedReveal]}>
                        {/* Quote Card */}
                        <View style={styles.quoteCard}>
                            <Text style={styles.quoteText}>
                                {QUOTES[quoteIndex]}
                            </Text>
                        </View>
                    </Animated.View>
                )}
            </Pressable>

            {/* Footer / Accept Button */}
            {isRevealed && (
                <Animated.View entering={FadeIn.delay(800).duration(800)} style={styles.buttonContainer}>
                    <Pressable
                        style={({ pressed }) => [
                            styles.acceptButton,
                            pressed && styles.buttonPressed
                        ]}
                        onPress={handleAccept}
                    >
                        <Text style={styles.buttonText}>ПРИНЯТЬ</Text>
                    </Pressable>
                </Animated.View>
            )}
        </View>
    );
}

// Simple Ripple Subcomponent
const Ripple = ({ x, y }: { x: number, y: number }) => {
    const scale = useSharedValue(0);
    const opacity = useSharedValue(0.6);

    useEffect(() => {
        scale.value = withTiming(4, { duration: 2000, easing: Easing.out(Easing.quad) });
        opacity.value = withTiming(0, { duration: 2000 });
    }, []);

    const style = useAnimatedStyle(() => {
        return {
            opacity: opacity.value,
            transform: [{ scale: scale.value }]
        };
    });

    return (
        <Animated.View
            style={[
                styles.ripple,
                { left: x - 50, top: y - 50 },
                style
            ]}
        />
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F0F2F0', // Light Zen Background
    },
    gradientOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(255,255,255,0.3)',
    },
    header: {
        paddingTop: 60,
        paddingHorizontal: 40,
        zIndex: 10,
    },
    headerTitle: {
        fontSize: 16,
        fontWeight: '300',
        color: '#94a3b8', // slate-400
        letterSpacing: 4,
        textTransform: 'uppercase',
    },
    separator: {
        height: 1,
        width: 50,
        backgroundColor: '#6ee7b7', // emerald-300
        marginTop: 8,
        opacity: 0.6,
    },
    surface: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
    },
    centerContent: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    uroborosContainer: {
        width: width * 0.7,
        height: width * 0.7,
        marginBottom: 40,
        opacity: 0.8,
    },
    uroborosImage: {
        width: '100%',
        height: '100%',
        tintColor: '#1e293b' // Dark slate tint if the image is transparent, otherwise remove tintColor
    },
    instructionText: {
        fontSize: 10,
        letterSpacing: 4,
        color: '#94a3b8',
        textAlign: 'center',
        lineHeight: 20,
        opacity: 0.7,
    },
    quoteContainer: {
        position: 'absolute',
        width: '100%',
        paddingHorizontal: 40,
        alignItems: 'center',
        justifyContent: 'center',
    },
    quoteCard: {
        backgroundColor: 'rgba(255, 255, 255, 0.6)',
        borderRadius: 40,
        padding: 40,
        width: '100%',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.8)',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.05,
        shadowRadius: 20,
    },
    quoteText: {
        fontSize: 20,
        lineHeight: 32,
        color: '#1e293b', // slate-800
        fontStyle: 'italic',
        textAlign: 'center',
        fontFamily: 'serif', // Ensure serif font is used
    },
    buttonContainer: {
        paddingHorizontal: 50,
        paddingBottom: 60,
    },
    acceptButton: {
        backgroundColor: '#0f172a', // slate-900
        paddingVertical: 20,
        borderRadius: 30,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.2,
        shadowRadius: 15,
        elevation: 5,
    },
    buttonPressed: {
        transform: [{ scale: 0.98 }],
        opacity: 0.9,
    },
    buttonText: {
        color: 'white',
        fontSize: 12,
        fontWeight: 'bold',
        letterSpacing: 4,
        textTransform: 'uppercase',
    },
    ripple: {
        position: 'absolute',
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: 'transparent',
        borderWidth: 2,
        borderColor: 'rgba(255,255,255,0.8)',
        zIndex: 0,
    }
});
