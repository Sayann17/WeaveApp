import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

interface ConfirmModalProps {
  visible: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmText?: string;
  cancelText?: string;
  type?: 'default' | 'danger';
}

export default function ConfirmModal({
  visible,
  title,
  message,
  onConfirm,
  onCancel,
  confirmText = 'Подтвердить',
  cancelText = 'Отмена',
  type = 'default'
}: ConfirmModalProps) {
  const confirmButtonStyle = type === 'danger' 
    ? styles.confirmButtonDanger 
    : styles.confirmButton;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
    >
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>
          <View style={styles.buttonsContainer}>
            <Pressable style={[styles.button, styles.cancelButton]} onPress={onCancel}>
              <Text style={styles.cancelButtonText}>{cancelText}</Text>
            </Pressable>
            <Pressable style={[styles.button, confirmButtonStyle]} onPress={onConfirm}>
              <Text style={styles.confirmButtonText}>{confirmText}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modal: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 20,
    width: '100%',
    maxWidth: 300,
    borderWidth: 1,
    borderColor: '#333',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 8,
    textAlign: 'center',
  },
  message: {
    fontSize: 16,
    color: '#cccccc',
    marginBottom: 20,
    textAlign: 'center',
    lineHeight: 20,
  },
  buttonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  button: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginHorizontal: 5,
  },
  cancelButton: {
    backgroundColor: '#333',
  },
  confirmButton: {
    backgroundColor: '#e1306c',
  },
  confirmButtonDanger: {
    backgroundColor: '#ff4444',
  },
  cancelButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  confirmButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
});