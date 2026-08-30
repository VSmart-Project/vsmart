import { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as LocalNotifications from '../src/services/localNotificationService';
import { useToast } from '../src/components/ui/Toast';

const BG = '#0B0F1A';
const CARD = '#151A2A';
const BORDER = '#1E2536';
const TEXT = '#F1F5F9';
const MUTED = '#64748B';
const ACCENT = '#7C3AED';

export default function NotificationTestScreen() {
    const insets = useSafeAreaInsets();
    const toast = useToast();
    const [permissionGranted, setPermissionGranted] = useState(false);

    const checkPermission = useCallback(async () => {
        const granted = await LocalNotifications.requestNotificationPermissions();
        setPermissionGranted(granted);
        if (!granted) {
            toast.error('Permission Denied', 'Please enable notifications in Settings');
        }
    }, [toast]);

    useEffect(() => {
        checkPermission();
    }, [checkPermission]);

    const testNotifications = [
        {
            title: 'Anti-theft Alert',
            description: 'Device moved outside safe zone',
            icon: 'shield-checkmark',
            color: '#EF4444',
            onPress: () => {
                LocalNotifications.showAntitheftAlert(
                    'My Car',
                    'Device moved 150m outside safe zone'
                );
                toast.success('Sent!', 'Check your notification tray');
            },
        },
        {
            title: 'Geofence Exit',
            description: 'Device left geofence area',
            icon: 'exit-outline',
            color: '#F59E0B',
            onPress: () => {
                LocalNotifications.showGeofenceAlert(
                    'My Car',
                    'Home Zone',
                    'EXIT'
                );
                toast.success('Sent!', 'Check your notification tray');
            },
        },
        {
            title: 'Geofence Enter',
            description: 'Device entered geofence area',
            icon: 'enter-outline',
            color: '#10B981',
            onPress: () => {
                LocalNotifications.showGeofenceAlert(
                    'My Car',
                    'Office Zone',
                    'ENTER'
                );
                toast.success('Sent!', 'Check your notification tray');
            },
        },
        {
            title: 'Device Offline',
            description: 'Lost connection to device',
            icon: 'cloud-offline-outline',
            color: '#6B7280',
            onPress: () => {
                LocalNotifications.showDeviceOfflineAlert('My Car');
                toast.success('Sent!', 'Check your notification tray');
            },
        },
        {
            title: 'Device Online',
            description: 'Device reconnected',
            icon: 'checkmark-circle-outline',
            color: '#34D399',
            onPress: () => {
                LocalNotifications.showDeviceOnlineAlert('My Car');
                toast.success('Sent!', 'Check your notification tray');
            },
        },
    ];

    return (
        <View style={s.container}>
            {/* Header */}
            <View style={[s.header, { paddingTop: insets.top + 12 }]}>
                <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
                    <Ionicons name="arrow-back" size={24} color={TEXT} />
                </TouchableOpacity>
                <Text style={s.headerTitle}>Test Notifications</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
                {/* Permission Status */}
                <View style={[s.statusCard, { borderColor: permissionGranted ? '#10B981' : '#EF4444' }]}>
                    <View style={[s.statusIcon, { backgroundColor: permissionGranted ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)' }]}>
                        <Ionicons 
                            name={permissionGranted ? 'checkmark-circle' : 'close-circle'} 
                            size={24} 
                            color={permissionGranted ? '#10B981' : '#EF4444'} 
                        />
                    </View>
                    <View style={{ flex: 1, marginLeft: 12 }}>
                        <Text style={s.statusTitle}>
                            {permissionGranted ? 'Notifications Enabled' : 'Notifications Disabled'}
                        </Text>
                        <Text style={s.statusDesc}>
                            {permissionGranted 
                                ? 'Tap any button below to test notifications' 
                                : 'Please enable notifications in Settings'}
                        </Text>
                    </View>
                </View>

                {/* Info Card */}
                <View style={s.infoCard}>
                    <Ionicons name="information-circle" size={20} color={ACCENT} />
                    <Text style={s.infoText}>
                        These are local notifications for demo purposes. In production, they would be triggered by real events from your devices.
                    </Text>
                </View>

                {/* Test Buttons */}
                <Text style={s.sectionTitle}>TEST NOTIFICATIONS</Text>
                {testNotifications.map((item, idx) => (
                    <TouchableOpacity
                        key={idx}
                        style={s.testCard}
                        onPress={item.onPress}
                        disabled={!permissionGranted}
                        activeOpacity={0.7}
                    >
                        <View style={[s.testIcon, { backgroundColor: `${item.color}15` }]}>
                            <Ionicons name={item.icon} size={24} color={item.color} />
                        </View>
                        <View style={{ flex: 1, marginLeft: 14 }}>
                            <Text style={s.testTitle}>{item.title}</Text>
                            <Text style={s.testDesc}>{item.description}</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={20} color={MUTED} />
                    </TouchableOpacity>
                ))}

                {/* Clear Button */}
                <TouchableOpacity
                    style={s.clearBtn}
                    onPress={async () => {
                        await LocalNotifications.clearAllNotifications();
                        await LocalNotifications.setBadgeCount(0);
                        toast.info('Cleared', 'All notifications cleared');
                    }}
                    activeOpacity={0.8}
                >
                    <Ionicons name="trash-outline" size={20} color="#FFF" />
                    <Text style={s.clearText}>Clear All Notifications</Text>
                </TouchableOpacity>
            </ScrollView>
        </View>
    );
}

const s = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: BG,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingBottom: 16,
        backgroundColor: '#161B2E',
        borderBottomLeftRadius: 24,
        borderBottomRightRadius: 24,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: TEXT,
    },
    backBtn: {
        width: 40,
        height: 40,
        borderRadius: 12,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    statusCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: CARD,
        borderRadius: 16,
        padding: 16,
        marginBottom: 16,
        borderWidth: 2,
    },
    statusIcon: {
        width: 48,
        height: 48,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    statusTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: TEXT,
        marginBottom: 4,
    },
    statusDesc: {
        fontSize: 13,
        color: MUTED,
        lineHeight: 18,
    },
    infoCard: {
        flexDirection: 'row',
        backgroundColor: 'rgba(124, 58, 237, 0.1)',
        borderRadius: 12,
        padding: 14,
        marginBottom: 24,
        borderWidth: 1,
        borderColor: 'rgba(124, 58, 237, 0.3)',
    },
    infoText: {
        flex: 1,
        fontSize: 13,
        color: MUTED,
        lineHeight: 19,
        marginLeft: 10,
    },
    sectionTitle: {
        fontSize: 11,
        fontWeight: '700',
        color: MUTED,
        letterSpacing: 1,
        marginBottom: 12,
        marginLeft: 4,
    },
    testCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: CARD,
        borderRadius: 14,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: BORDER,
    },
    testIcon: {
        width: 48,
        height: 48,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    testTitle: {
        fontSize: 15,
        fontWeight: '700',
        color: TEXT,
        marginBottom: 4,
    },
    testDesc: {
        fontSize: 13,
        color: MUTED,
    },
    clearBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#EF4444',
        height: 52,
        borderRadius: 14,
        gap: 8,
        marginTop: 12,
    },
    clearText: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: '700',
    },
});
