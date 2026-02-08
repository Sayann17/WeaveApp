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

export default function ZenScreen() {
    const router = useRouter();
    const [isRevealed, setIsRevealed] = useState(false);
    const [quote, setQuote] = useState<{ text: string, theme: string } | null>(null);
    const [quoteId, setQuoteId] = useState<string | undefined>(undefined);
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

        // Fetch quote from backend
        const loadQuote = async () => {
            const data = await ZenService.getZenState();
            if (data.quote) {
                setQuote(data.quote);
                setQuoteId(data.quote.id);
            } else {
                // Fallback if offline or error
                setQuote({ text: "Тишина внутри...", theme: "Покой" });
            }
        };
        loadQuote();
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
        await ZenService.completeZen(quoteId);
        // Uses replacement to prevent going back to this screen
        router.replace('/(tabs)');
    };

    return (
        <View style={styles.container}>
            <StatusBar style="dark" />

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
                                source={require('../../assets/images/uro_bezh.png')}
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
                {isRevealed && quote && (
                    <Animated.View style={[styles.quoteContainer, animatedReveal]}>
                        {/* Soft glow behind text */}
                        <View style={styles.quoteGlow} />
                        <Text style={styles.quoteText}>
                            {quote.text}
                        </Text>
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
        backgroundColor: '#f3efe1',
    },
    gradientOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'transparent', // No overlay to keep bg consistent
    },
    header: {
        paddingTop: 93,
        paddingBottom: 16,
        paddingHorizontal: 40,
        zIndex: 10,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '300',
        color: '#44403c', // stone-700
        letterSpacing: 6,
        textTransform: 'uppercase',
    },
    separator: {
        height: 2,
        width: 32,
        backgroundColor: '#34d399', // emerald-400
        marginTop: 6,
        opacity: 0.6,
    },
    surface: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        marginTop: -100, // Significantly push content up
    },
    centerContent: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    uroborosContainer: {
        width: width * 0.85, // Increased size
        height: width * 0.85,
        marginBottom: 20,
        opacity: 0.9,
    },
    uroborosImage: {
        width: '100%',
        height: '100%',
        // tintColor removed to show original image colors
    },
    instructionText: {
        fontSize: 10,
        letterSpacing: 4,
        color: '#000000',
        textAlign: 'center',
        lineHeight: 20,
    },
    quoteContainer: {
        position: 'absolute',
        width: '100%',
        paddingHorizontal: 48,
        alignItems: 'center',
        justifyContent: 'center',
    },
    quoteGlow: {
        position: 'absolute',
        width: '120%',
        height: '200%',
        backgroundColor: 'rgba(255, 255, 255, 0.4)',
        borderRadius: 200,
        // Blur effect via shadow on iOS
        shadowColor: '#fff',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 1,
        shadowRadius: 80,
    },
    quoteText: {
        fontSize: 20,
        lineHeight: 40, // leading-[2] = 2x font size
        color: '#44403c', // stone-700
        fontStyle: 'italic',
        textAlign: 'center',
        fontFamily: 'serif',
        letterSpacing: 0.5,
    },
    buttonContainer: {
        paddingHorizontal: 50,
        paddingBottom: 60,
    },
    acceptButton: {
        backgroundColor: '#0f172a',
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
        borderColor: 'rgba(0,0,0,0.3)',
        zIndex: 0,
    }
});
