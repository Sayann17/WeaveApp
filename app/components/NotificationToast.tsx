import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef } from 'react';
import { Animated, Dimensions, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export type NotificationType = 'message' | 'match' | 'like';

interface NotificationToastProps {
    visible: boolean;
    message: string;
    type: NotificationType;
    onPress?: () => void;
    onClose: () => void;
}

const { width } = Dimensions.get('window');

export const NotificationToast: React.FC<NotificationToastProps> = ({
    visible,
    message,
    type,
    onPress,
    onClose
}) => {
    const insets = useSafeAreaInsets();
    const translateY = useRef(new Animated.Value(-100)).current;

    useEffect(() => {
        if (visible) {
            Animated.spring(translateY, {
                toValue: insets.top + 10,
                useNativeDriver: true,
                bounciness: 4,
            }).start();

            const timer = setTimeout(() => {
                hide();
            }, 4000);

            return () => clearTimeout(timer);
        } else {
            hide();
        }
    }, [visible]);

    const hide = () => {
        Animated.timing(translateY, {
            toValue: -150,
            duration: 300,
            useNativeDriver: true,
        }).start(() => onClose());
    };

    const getIcon = () => {
        switch (type) {
            case 'message': return 'chatbubble-ellipses';
            case 'match': return 'heart';
            case 'like': return 'thumbs-up'; // or heart-outline
            default: return 'notifications';
        }
    };

    const getColor = () => {
        switch (type) {
            case 'message': return '#4A90E2';
            case 'match': return '#E1306C';
            case 'like': return '#F5A623';
            default: return '#333';
        }
    };

    if (!visible) return null;

    return (
        <Animated.View style={[styles.container, { transform: [{ translateY }] }]}>
            <TouchableOpacity
                style={styles.content}
                activeOpacity={0.8}
                onPress={() => {
                    if (onPress) onPress();
                    hide();
                }}
            >
                <View style={[styles.iconContainer, { backgroundColor: getColor() }]}>
                    <Ionicons name={getIcon()} size={20} color="white" />
                </View>
                <View style={styles.textContainer}>
                    <Text style={styles.title}>
                        {type === 'message' ? 'Новое сообщение' : type === 'match' ? 'Новое совпадение!' : 'Вас лайкнули!'}
                    </Text>
                    <Text style={styles.message} numberOfLines={2}>{message}</Text>
                </View>
                <TouchableOpacity onPress={hide} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                    <Ionicons name="close" size={18} color="#999" />
                </TouchableOpacity>
            </TouchableOpacity>
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        top: 0,
        left: 10,
        right: 10,
        alignItems: 'center',
        zIndex: 9999,
    },
    content: {
        flexDirection: 'row',
        backgroundColor: 'white',
        borderRadius: 16,
        padding: 12,
        width: width - 30,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 10,
        elevation: 8,
        alignItems: 'center',
    },
    iconContainer: {
        width: 36,
        height: 36,
        borderRadius: 18,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    textContainer: {
        flex: 1,
    },
    title: {
        fontWeight: 'bold',
        fontSize: 14,
        color: '#000',
        marginBottom: 2,
    },
    message: {
        fontSize: 13,
        color: '#555',
    }
});
