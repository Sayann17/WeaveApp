import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, TouchableWithoutFeedback, View } from 'react-native';
import { useTheme } from '../context/ThemeContext';

interface MessageActionModalProps {
    visible: boolean;
    onClose: () => void;
    onReply: () => void;
    onEdit?: () => void;
    // onDelete?: () => void; // Future support
    isMine: boolean;
}

import { normalize } from '../utils/normalize';

// ... imports

export const MessageActionModal: React.FC<MessageActionModalProps> = ({
    visible,
    onClose,
    onReply,
    onEdit,
    isMine
}) => {
    const { theme } = useTheme();

    return (
        <Modal
            transparent
            visible={visible}
            animationType="fade"
            onRequestClose={onClose}
        >
            <TouchableWithoutFeedback onPress={onClose}>
                <View style={styles.overlay}>
                    <TouchableWithoutFeedback>
                        <View style={[styles.menuContainer, { backgroundColor: theme.cardBg }]}>

                            {/* REPLY */}
                            <TouchableOpacity style={styles.menuItem} onPress={() => { onReply(); onClose(); }}>
                                <Ionicons name="arrow-undo-outline" size={normalize(20)} color={theme.text} style={styles.icon} />
                                <Text style={[styles.menuText, { color: theme.text }]}>Ответить</Text>
                            </TouchableOpacity>

                            {/* EDIT (Only if mine) */}
                            {isMine && onEdit && (
                                <TouchableOpacity style={styles.menuItem} onPress={() => { onEdit(); onClose(); }}>
                                    <Ionicons name="pencil-outline" size={normalize(20)} color={theme.text} style={styles.icon} />
                                    <Text style={[styles.menuText, { color: theme.text }]}>Редактировать</Text>
                                </TouchableOpacity>
                            )}

                            {/* CANCEL */}
                            <TouchableOpacity style={[styles.menuItem, styles.cancelItem]} onPress={onClose}>
                                <Text style={[styles.menuText, { color: theme.accent }]}>Отмена</Text>
                            </TouchableOpacity>

                        </View>
                    </TouchableWithoutFeedback>
                </View>
            </TouchableWithoutFeedback>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    menuContainer: {
        width: '70%',
        borderRadius: normalize(15),
        padding: normalize(10),
        elevation: 5,
    },
    menuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: normalize(15),
        paddingHorizontal: normalize(15),
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(128,128,128,0.1)',
    },
    cancelItem: {
        borderBottomWidth: 0,
        justifyContent: 'center',
    },
    icon: {
        marginRight: normalize(15),
    },
    menuText: {
        fontSize: normalize(16),
        fontWeight: '500',
    },
});
