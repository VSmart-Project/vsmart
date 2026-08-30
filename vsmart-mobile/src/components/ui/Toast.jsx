import { createContext, useContext, useState, useRef, useCallback, useMemo } from 'react';
import {
    View, Text, StyleSheet, Animated, Platform, Modal, Pressable,
} from 'react-native';
import { FullWindowOverlay } from 'react-native-screens';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

function safeText(v) {
    if (v == null || v === '') return undefined;
    if (typeof v === 'string') return v;
    if (typeof v === 'object' && v.message) return String(v.message);
    try { return String(v); } catch { return 'Error'; }
}

const VARIANTS = {
    success: { icon: 'checkmark-circle', accent: '#34D399', bg: '#0D2818', border: '#166534' },
    error:   { icon: 'close-circle',     accent: '#F87171', bg: '#2A0A0A', border: '#7F1D1D' },
    info:    { icon: 'information-circle',accent: '#60A5FA', bg: '#0A1A2A', border: '#1E3A5F' },
    warning: { icon: 'warning',          accent: '#FBBF24', bg: '#2A1F0A', border: '#78350F' },
};

const DURATION = 3500;

const ToastContext = createContext(null);

export function useToast() {
    const ctx = useContext(ToastContext);
    if (!ctx) throw new Error('useToast must be used within ToastProvider');
    return ctx;
}

export function ToastProvider({ children }) {
    const insets = useSafeAreaInsets();
    const [current, setCurrent] = useState(null);
    const [layerKey, setLayerKey] = useState(0);
    const translateY = useRef(new Animated.Value(-50)).current;
    const scale = useRef(new Animated.Value(0.9)).current;
    const opacity = useRef(new Animated.Value(0)).current;
    const timerRef = useRef(null);

    const dismiss = useCallback(() => {
        Animated.parallel([
            Animated.timing(translateY, { toValue: -50, duration: 220, useNativeDriver: true }),
            Animated.timing(scale, { toValue: 0.95, duration: 220, useNativeDriver: true }),
            Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }),
        ]).start(() => setCurrent(null));
    }, [translateY, scale, opacity]);

    const show = useCallback(({ type = 'info', title, message, duration = DURATION }) => {
        if (timerRef.current) clearTimeout(timerRef.current);

        const t = safeText(title);
        const m = safeText(message);
        if (t == null && m == null) return;
        translateY.setValue(-40);
        scale.setValue(0.96);
        opacity.setValue(0);

        setCurrent({ type, title: t, message: m });
        setLayerKey((k) => k + 1);

        requestAnimationFrame(() => {
            Animated.parallel([
                Animated.spring(translateY, { toValue: 0, useNativeDriver: true, damping: 16, stiffness: 160, mass: 0.8 }),
                Animated.spring(scale, { toValue: 1, useNativeDriver: true, damping: 14, stiffness: 180 }),
                Animated.timing(opacity, { toValue: 1, duration: 250, useNativeDriver: true }),
            ]).start();
        });

        timerRef.current = setTimeout(dismiss, duration);
    }, [translateY, scale, opacity, dismiss]);

    const toast = useMemo(() => ({
        success: (title, message) => show({ type: 'success', title, message }),
        error: (title, message) => show({ type: 'error', title, message }),
        info: (title, message) => show({ type: 'info', title, message }),
        warning: (title, message) => show({ type: 'warning', title, message }),
        show,
    }), [show]);

    const v = current ? VARIANTS[current.type] || VARIANTS.info : VARIANTS.info;

    const toastContent = current ? (
        <View
            style={[styles.modalRoot, { paddingTop: insets.top + 8 }]}
            pointerEvents="box-none"
        >
            <Animated.View
                style={[styles.animatedHost, { transform: [{ translateY }, { scale }], opacity }]}
            >
                <View style={styles.toastRow} pointerEvents="box-none">
                    <Pressable
                        style={({ pressed }) => [
                            styles.toast,
                            { backgroundColor: v.bg, borderColor: v.border, opacity: pressed ? 0.96 : 1 },
                        ]}
                        onPress={dismiss}
                    >
                        <View style={[styles.iconCircle, { backgroundColor: v.accent + '20' }]}>
                            <Ionicons name={v.icon} size={24} color={v.accent} />
                        </View>

                        <View style={styles.body}>
                            {!!current.title && (
                                <Text style={[styles.title, { color: v.accent }]} numberOfLines={2}>
                                    {current.title}
                                </Text>
                            )}
                            {!!current.message && (
                                <Text style={styles.message} numberOfLines={4}>
                                    {current.message}
                                </Text>
                            )}
                        </View>

                        <Pressable
                            style={({ pressed }) => [styles.closeBtn, pressed && { opacity: 0.7 }]}
                            onPress={dismiss}
                            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                        >
                            <Ionicons name="close" size={18} color="#94A3B8" />
                        </Pressable>

                        <View style={[styles.accentBar, { backgroundColor: v.accent }]} />
                    </Pressable>
                </View>
            </Animated.View>
        </View>
    ) : null;

    const useNativeOverlay = Platform.OS === 'ios';

    return (
        <ToastContext.Provider value={toast}>
            {children}
            {!!current
                && (useNativeOverlay ? (
                    <FullWindowOverlay unstable_accessibilityContainerViewIsModal>
                        <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
                            {toastContent}
                        </View>
                    </FullWindowOverlay>
                ) : (
                    <Modal
                        key={layerKey}
                        visible={true}
                        transparent
                        animationType="none"
                        statusBarTranslucent
                        onRequestClose={dismiss}
                    >
                        {toastContent}
                    </Modal>
                ))}
        </ToastContext.Provider>
    );
}

const styles = StyleSheet.create({
    modalRoot: {
        flex: 1,
        backgroundColor: 'transparent',
        alignItems: 'center',
    },
    animatedHost: {
        width: '100%',
        maxWidth: 420,
        paddingHorizontal: 16,
        zIndex: 100000,
        ...Platform.select({
            android: { elevation: 100 },
        }),
    },
    toastRow: {
        width: '100%',
    },
    toast: {
        width: '100%',
        flexDirection: 'row',
        alignItems: 'center',
        paddingLeft: 16,
        paddingRight: 10,
        paddingVertical: 14,
        borderRadius: 16,
        borderWidth: 1.5,
        overflow: 'hidden',
        ...Platform.select({
            ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.45, shadowRadius: 20 },
            android: { elevation: 28 },
        }),
    },
    iconCircle: {
        width: 40,
        height: 40,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    body: {
        flex: 1,
        marginLeft: 12,
        marginRight: 8,
    },
    title: {
        fontSize: 15,
        fontWeight: '800',
        letterSpacing: 0.2,
    },
    message: {
        fontSize: 13,
        color: '#94A3B8',
        marginTop: 2,
        lineHeight: 18,
    },
    closeBtn: {
        width: 32,
        height: 32,
        borderRadius: 10,
        backgroundColor: 'rgba(255,255,255,0.06)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    accentBar: {
        position: 'absolute',
        left: 0,
        top: 0,
        bottom: 0,
        width: 4,
        borderTopLeftRadius: 16,
        borderBottomLeftRadius: 16,
    },
});
