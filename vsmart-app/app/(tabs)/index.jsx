import { useRef, useState } from 'react';
import {
    View, Text, TouchableOpacity, ScrollView, Platform,
    StyleSheet, RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLiveDevices } from '../../src/contexts/DeviceDataContext';
import SmoothDeviceMarkers from '../../src/components/map/SmoothDeviceMarkers';
import { useToast } from '../../src/components/ui/Toast';

let MapView;
if (Platform.OS !== 'web') {
    try { MapView = require('react-native-maps').default; } catch (_) {}
}

const BG = '#0B0F1A';
const CARD = '#151A2A';
const BORDER = '#1E2536';
const TEXT = '#F1F5F9';
const MUTED = '#64748B';
const ACCENT = '#7C3AED';
const MAP_H = 200;

function getGreeting() {
    const h = new Date().getHours();
    if (h < 12) return 'Good Morning';
    if (h < 18) return 'Good Afternoon';
    return 'Good Evening';
}

export default function HomeScreen() {
    const insets = useSafeAreaInsets();
    const toast = useToast();
    const mapRef = useRef(null);
    const [refreshing, setRefreshing] = useState(false);
    const { devices, refreshDevices } = useLiveDevices();

    const load = async () => {
        try {
            await refreshDevices();
        } catch (_) {
            toast.error('Load Failed', 'Could not refresh device data');
        } finally {
            setRefreshing(false);
        }
    };

    const online = devices.filter(d => d.isOnline);
    const offline = devices.filter(d => !d.isOnline);
    const armed = devices.filter(d => d.antitheftEnabled);
    const firstDevice = devices.find(d => d.position);

    const stats = [
        { label: 'Total', value: devices.length, icon: 'car-sport', color: '#A78BFA', bg: 'rgba(124,58,237,0.15)' },
        { label: 'Online', value: online.length, icon: 'pulse', color: '#34D399', bg: 'rgba(16,185,129,0.15)' },
        { label: 'Offline', value: offline.length, icon: 'cloud-offline', color: '#FBBF24', bg: 'rgba(245,158,11,0.15)' },
        { label: 'Armed', value: armed.length, icon: 'shield-checkmark', color: '#F87171', bg: 'rgba(239,68,68,0.15)' },
    ];

    return (
        <View style={s.container}>
            <ScrollView
                contentContainerStyle={{ paddingBottom: 24 }}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={ACCENT} />}
                showsVerticalScrollIndicator={false}
            >
                {/* Header */}
                <View style={[s.header, { paddingTop: insets.top + 12 }]}>
                    <View style={{ flex: 1 }}>
                        <Text style={s.greeting}>{getGreeting()}</Text>
                        <Text style={s.headerTitle}>VSmart Tracking</Text>
                    </View>
                </View>

                {/* Stats */}
                <View style={s.statsRow}>
                    {stats.map(st => (
                        <View key={st.label} style={s.statCard}>
                            <View style={[s.statIcon, { backgroundColor: st.bg }]}>
                                <Ionicons name={st.icon} size={18} color={st.color} />
                            </View>
                            <Text style={s.statValue}>{st.value}</Text>
                            <Text style={s.statLabel}>{st.label}</Text>
                        </View>
                    ))}
                </View>

                {/* Mini Map */}
                <View style={s.section}>
                    <View style={s.sectionHead}>
                        <Text style={s.sectionTitle}>Live Tracking</Text>
                        <TouchableOpacity onPress={() => router.push('/map')}>
                            <Text style={s.seeAll}>Full Map</Text>
                        </TouchableOpacity>
                    </View>
                    <View style={s.mapCard}>
                        {MapView && firstDevice ? (
                            <MapView
                                ref={mapRef}
                                style={s.map}
                                initialRegion={{
                                    latitude: firstDevice.position[1], longitude: firstDevice.position[0],
                                    latitudeDelta: 0.01, longitudeDelta: 0.01,
                                }}
                                scrollEnabled={false} zoomEnabled={false} pitchEnabled={false} rotateEnabled={false}
                            >
                                <SmoothDeviceMarkers devices={devices} />
                            </MapView>
                        ) : (
                            <View style={s.mapPlaceholder}>
                                <Ionicons name="map-outline" size={40} color={MUTED} />
                                <Text style={s.mapPlaceholderText}>No device positions yet</Text>
                            </View>
                        )}
                        {MapView && firstDevice && (
                            <View style={s.mapOverlay}>
                                <View style={s.mapLiveDot} />
                                <Text style={s.mapLiveText}>{online.length} device{online.length !== 1 ? 's' : ''} online</Text>
                            </View>
                        )}
                    </View>
                </View>

                {/* Recent Devices */}
                <View style={s.section}>
                    <View style={s.sectionHead}>
                        <Text style={s.sectionTitle}>Recent Devices</Text>
                        <TouchableOpacity onPress={() => router.push('/devices')}>
                            <Text style={s.seeAll}>See All</Text>
                        </TouchableOpacity>
                    </View>
                    {devices.length === 0 ? (
                        <View style={s.emptyCard}>
                            <Ionicons name="car-sport-outline" size={36} color={MUTED} />
                            <Text style={s.emptyText}>No devices added yet</Text>
                        </View>
                    ) : devices.slice(0, 5).map(d => (
                        <View key={d.deviceId} style={s.deviceRow}>
                            <View style={[s.deviceIcon, { backgroundColor: d.isOnline ? 'rgba(16,185,129,0.15)' : 'rgba(100,116,139,0.15)' }]}>
                                <Ionicons name={d.type === 'motorbike' ? 'bicycle' : 'car-sport'} size={20} color={d.isOnline ? '#34D399' : MUTED} />
                            </View>
                            <View style={{ flex: 1, marginLeft: 12 }}>
                                <Text style={s.deviceName}>{d.displayName || d.deviceId}</Text>
                                <Text style={s.deviceSub}>{d.type || 'vehicle'} · {d.isOnline ? 'Online' : 'Offline'}</Text>
                            </View>
                            <View style={[s.statusPill, { backgroundColor: d.isOnline ? 'rgba(16,185,129,0.15)' : 'rgba(100,116,139,0.1)' }]}>
                                <View style={[s.statusDot, { backgroundColor: d.isOnline ? '#34D399' : MUTED }]} />
                                <Text style={[s.statusPillText, { color: d.isOnline ? '#34D399' : MUTED }]}>
                                    {d.isOnline ? 'Active' : 'Idle'}
                                </Text>
                            </View>
                        </View>
                    ))}
                </View>
            </ScrollView>
        </View>
    );
}

const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: BG },

    header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 24, backgroundColor: '#161B2E' },
    greeting: { fontSize: 13, color: MUTED, fontWeight: '500' },
    headerTitle: { fontSize: 24, fontWeight: '800', color: TEXT, marginTop: 2 },
    notifBtn: { width: 44, height: 44, borderRadius: 14, backgroundColor: CARD, alignItems: 'center', justifyContent: 'center' },
    badge: { position: 'absolute', top: 6, right: 6, width: 18, height: 18, borderRadius: 9, backgroundColor: '#EF4444', alignItems: 'center', justifyContent: 'center' },
    badgeText: { color: '#FFF', fontSize: 10, fontWeight: '800' },

    statsRow: { flexDirection: 'row', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 28, gap: 10, backgroundColor: '#161B2E', borderBottomLeftRadius: 24, borderBottomRightRadius: 24 },
    statCard: { flex: 1, backgroundColor: CARD, borderRadius: 16, padding: 12, alignItems: 'center', borderWidth: 1, borderColor: BORDER },
    statIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
    statValue: { fontSize: 20, fontWeight: '800', color: TEXT },
    statLabel: { fontSize: 11, color: MUTED, fontWeight: '600', marginTop: 2 },

    section: { paddingHorizontal: 16, marginTop: 28 },
    sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
    sectionTitle: { fontSize: 18, fontWeight: '800', color: TEXT },
    seeAll: { fontSize: 13, fontWeight: '700', color: '#A78BFA' },

    mapCard: { borderRadius: 20, overflow: 'hidden', backgroundColor: CARD, height: MAP_H, borderWidth: 1, borderColor: BORDER },
    map: { width: '100%', height: '100%' },
    mapPlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    mapPlaceholderText: { color: MUTED, fontSize: 13, marginTop: 8 },
    mapOverlay: { position: 'absolute', bottom: 12, left: 12, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(11,15,26,0.85)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
    mapLiveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#34D399', marginRight: 6 },
    mapLiveText: { color: '#FFF', fontSize: 12, fontWeight: '600' },
    pin: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#FFF' },


    emptyCard: { backgroundColor: CARD, borderRadius: 16, padding: 32, alignItems: 'center', borderWidth: 1, borderColor: BORDER },
    emptyText: { color: MUTED, fontSize: 14, marginTop: 8 },

    deviceRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: CARD, borderRadius: 14, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: BORDER },
    deviceIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    deviceName: { fontSize: 15, fontWeight: '700', color: TEXT },
    deviceSub: { fontSize: 12, color: MUTED, marginTop: 2 },
    statusPill: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
    statusDot: { width: 6, height: 6, borderRadius: 3, marginRight: 5 },
    statusPillText: { fontSize: 11, fontWeight: '700' },
});
