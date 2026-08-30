import { useRef, useEffect } from 'react';
import {
    View, Text, Modal, StyleSheet, TouchableOpacity, KeyboardAvoidingView,
    Platform, ScrollView, Animated, Keyboard,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const DARK = '#1A1F2E';
const BORDER = '#2D3548';
const TEXT = '#F1F5F9';

/**
 * BottomSheetModal - Reusable bottom sheet with keyboard avoidance
 * 
 * Features:
 * - Automatic keyboard avoidance on iOS and Android
 * - Smooth slide-in animation
 * - Safe area handling
 * - Scrollable content
 * - Consistent dark theme styling
 * 
 * @param {boolean} visible - Controls modal visibility
 * @param {function} onClose - Callback when modal is closed
 * @param {string} title - Modal title
 * @param {ReactNode} children - Modal content
 * @param {number} maxHeight - Maximum height as percentage (default: 85)
 * @param {boolean} showHandle - Show drag handle (default: true)
 */
export default function BottomSheetModal({
    visible = false,
    onClose,
    title,
    children,
    maxHeight = 85,
    showHandle = true,
}) {
    const insets = useSafeAreaInsets();
    const slideAnim = useRef(new Animated.Value(0)).current;
    const keyboardHeight = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (visible) {
            Animated.spring(slideAnim, {
                toValue: 1,
                useNativeDriver: true,
                damping: 20,
                stiffness: 150,
            }).start();
        } else {
            Animated.timing(slideAnim, {
                toValue: 0,
                duration: 200,
                useNativeDriver: true,
            }).start();
        }
    }, [slideAnim, visible]);

    useEffect(() => {
        const keyboardWillShow = Keyboard.addListener(
            Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
            (e) => {
                Animated.timing(keyboardHeight, {
                    toValue: e.endCoordinates.height,
                    duration: Platform.OS === 'ios' ? e.duration : 250,
                    useNativeDriver: false,
                }).start();
            }
        );

        const keyboardWillHide = Keyboard.addListener(
            Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
            (e) => {
                Animated.timing(keyboardHeight, {
                    toValue: 0,
                    duration: Platform.OS === 'ios' ? e.duration : 250,
                    useNativeDriver: false,
                }).start();
            }
        );

        return () => {
            keyboardWillShow.remove();
            keyboardWillHide.remove();
        };
    }, [keyboardHeight]);

    const translateY = slideAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [600, 0],
    });

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            statusBarTranslucent
            onRequestClose={onClose}
        >
            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
            >
                <View style={s.overlay}>
                    <TouchableOpacity
                        style={StyleSheet.absoluteFill}
                        activeOpacity={1}
                        onPress={onClose}
                    />
                    <Animated.View
                        style={[
                            s.modal,
                            {
                                maxHeight: `${maxHeight}%`,
                                paddingBottom: Math.max(insets.bottom, 20),
                                transform: [{ translateY }],
                            },
                        ]}
                    >
                        {showHandle && <View style={s.handle} />}
                        
                        <View style={s.header}>
                            <Text style={s.title}>{title}</Text>
                            <TouchableOpacity style={s.closeBtn} onPress={onClose}>
                                <Ionicons name="close" size={20} color={TEXT} />
                            </TouchableOpacity>
                        </View>

                        <ScrollView
                            style={s.content}
                            showsVerticalScrollIndicator={false}
                            keyboardShouldPersistTaps="handled"
                            bounces={false}
                        >
                            {children}
                        </ScrollView>
                    </Animated.View>
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
}

const s = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.6)',
        justifyContent: 'flex-end',
    },
    modal: {
        backgroundColor: DARK,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        paddingTop: 8,
        paddingHorizontal: 20,
        ...Platform.select({
            ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: -4 },
                shadowOpacity: 0.3,
                shadowRadius: 12,
            },
            android: {
                elevation: 24,
            },
        }),
    },
    handle: {
        width: 36,
        height: 4,
        borderRadius: 2,
        backgroundColor: BORDER,
        alignSelf: 'center',
        marginBottom: 16,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    title: {
        fontSize: 20,
        fontWeight: '800',
        color: TEXT,
    },
    closeBtn: {
        width: 36,
        height: 36,
        borderRadius: 10,
        backgroundColor: 'rgba(255,255,255,0.08)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    content: {
        flex: 1,
    },
});
