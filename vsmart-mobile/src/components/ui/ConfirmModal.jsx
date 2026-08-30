import {
    View, Text, TouchableOpacity, Modal, StyleSheet, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const DARK = '#1A1F2E';
const CARD = '#232837';
const BORDER = '#2D3548';
const TEXT = '#F1F5F9';
const MUTED = '#94A3B8';

const ICON_PRESETS = {
    delete:  { name: 'trash',           bg: 'rgba(239,68,68,0.15)', color: '#F87171' },
    logout:  { name: 'log-out-outline', bg: 'rgba(239,68,68,0.15)', color: '#F87171' },
    warning: { name: 'warning',         bg: 'rgba(251,191,36,0.15)', color: '#FBBF24' },
    info:    { name: 'information-circle', bg: 'rgba(96,165,250,0.15)', color: '#60A5FA' },
    success: { name: 'checkmark-circle', bg: 'rgba(16,185,129,0.15)', color: '#34D399' },
    shield:  { name: 'shield-checkmark', bg: 'rgba(124,58,237,0.15)', color: '#A78BFA' },
};

export default function ConfirmModal({
    visible = false,
    icon = 'warning',
    title = 'Confirm',
    message = '',
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    confirmColor = '#EF4444',
    loading = false,
    onConfirm,
    onCancel,
}) {
    const preset = ICON_PRESETS[icon] || ICON_PRESETS.warning;

    return (
        <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
            <View style={s.overlay}>
                <View style={s.modal}>
                    <View style={[s.iconWrap, { backgroundColor: preset.bg }]}>
                        <Ionicons name={preset.name} size={32} color={preset.color} />
                    </View>

                    <Text style={s.title}>{title}</Text>
                    {message ? <Text style={s.message}>{message}</Text> : null}

                    <View style={s.actions}>
                        <TouchableOpacity style={s.cancelBtn} onPress={onCancel} disabled={loading} activeOpacity={0.7}>
                            <Text style={s.cancelText}>{cancelText}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[s.confirmBtn, { backgroundColor: confirmColor }]}
                            onPress={onConfirm}
                            disabled={loading}
                            activeOpacity={0.8}
                        >
                            {loading ? (
                                <ActivityIndicator color="#FFF" size="small" />
                            ) : (
                                <Text style={s.confirmText}>{confirmText}</Text>
                            )}
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
}

const s = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.65)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 32,
    },
    modal: {
        width: '100%',
        backgroundColor: DARK,
        borderRadius: 24,
        padding: 28,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: BORDER,
    },
    iconWrap: {
        width: 64,
        height: 64,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
    },
    title: {
        fontSize: 20,
        fontWeight: '800',
        color: TEXT,
        textAlign: 'center',
        marginBottom: 8,
    },
    message: {
        fontSize: 14,
        color: MUTED,
        textAlign: 'center',
        lineHeight: 21,
        marginBottom: 4,
    },
    actions: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 24,
        width: '100%',
    },
    cancelBtn: {
        flex: 1,
        height: 48,
        borderRadius: 14,
        backgroundColor: CARD,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: BORDER,
    },
    cancelText: {
        color: MUTED,
        fontSize: 15,
        fontWeight: '700',
    },
    confirmBtn: {
        flex: 1,
        height: 48,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
    },
    confirmText: {
        color: '#FFF',
        fontSize: 15,
        fontWeight: '700',
    },
});
