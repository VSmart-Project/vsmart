import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
    View, Text, TouchableOpacity, Platform, StyleSheet,
    ScrollView, Animated, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { deviceApi, antitheftApi } from '../src/api/deviceApi';
import { useLiveDevices } from '../src/contexts/DeviceDataContext';
import { useLiveGeofences } from '../src/contexts/GeofenceDataContext';
import SmoothDeviceMarkers from '../src/components/map/SmoothDeviceMarkers';
import { useToast } from '../src/components/ui/Toast';
import ConfirmModal from '../src/components/ui/ConfirmModal';

let MapView, Polyline, Polygon;
if (Platform.OS !== 'web') {
    try {
        const M = require('react-native-maps');
        MapView = M.default;
        Polyline = M.Polyline;
        Polygon = M.Polygon;
    } catch (_) {}
}

const ACCENT = '#A3E635';
const DARK = '#1A1F2E';
const DARK_CARD = '#232837';
const MUTED = '#6B7280';

export default function MapScreen() {
    const insets = useSafeAreaInsets();
    const toast = useToast();
    const mapRef = useRef(null);
    const { devices, refreshDevices } = useLiveDevices();
    const { geofences, refreshGeofences } = useLiveGeofences();
    const [selected, setSelected] = useState(null);
    const [history, setHistory] = useState([]);
    const [matchedPath, setMatchedPath] = useState([]);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [armLoading, setArmLoading] = useState(false);
    const [showGeofences, setShowGeofences] = useState(true);
    const [showArmModal, setShowArmModal] = useState(false);
    const [showDisarmModal, setShowDisarmModal] = useState(false);
    const [region, setRegion] = useState({ latitude: 10.8231, longitude: 106.6297, latitudeDelta: 0.08, longitudeDelta: 0.08 });
    const [followId, setFollowId] = useState(null);
    const sheetAnim = useRef(new Animated.Value(0)).current;
    const hasFitted = useRef(false);

    const fitToDevices = useCallback((list) => {
        const coords = list.filter(d => d.position).map(d => ({
            latitude: d.position[1], longitude: d.position[0],
        }));
        if (coords.length === 0 || !mapRef.current) return;
        if (coords.length === 1) {
            mapRef.current.animateToRegion({
                latitude: coords[0].latitude, longitude: coords[0].longitude,
                latitudeDelta: 0.008, longitudeDelta: 0.008,
            }, 600);
        } else {
            mapRef.current.fitToCoordinates(coords, {
                edgePadding: { top: 120, right: 60, bottom: 320, left: 60 },
                animated: true,
            });
        }
    }, []);

    const load = useCallback(async () => {
        try {
            await refreshDevices();
        } catch (_) {}
    }, [refreshDevices]);

    useEffect(() => {
        Animated.spring(sheetAnim, {
            toValue: selected ? 1 : 0,
            useNativeDriver: true,
            damping: 22,
            stiffness: 200,
            mass: 0.8,
        }).start();
    }, [selected, sheetAnim]);

    useEffect(() => {
        if (selected) {
            const updatedDevice = devices.find((device) => device.deviceId === selected.deviceId);
            if (updatedDevice) {
                setSelected(updatedDevice);
            }
        }

        if (!hasFitted.current && devices.some((device) => device.position)) {
            hasFitted.current = true;
            setTimeout(() => fitToDevices(devices), 300);
        }
    }, [devices, fitToDevices, selected]);

    // Camera-follow itself lives in <SmoothDeviceMarkers> (it owns the per-frame
    // position). Here we only release it when the device is deselected.

    // Follow only makes sense for the currently selected device.
    useEffect(() => {
        if (followId && selected?.deviceId !== followId) setFollowId(null);
    }, [selected, followId]);

    const selectDevice = (d) => {
        setSelected(d);
        setHistory([]);
        if (d.position && mapRef.current) {
            mapRef.current.animateToRegion({
                latitude: d.position[1], longitude: d.position[0],
                latitudeDelta: 0.008, longitudeDelta: 0.008,
            }, 600);
        }
    };

    const loadHistory = async () => {
        if (!selected || historyLoading) return;
        setHistoryLoading(true);
        setMatchedPath([]);
        try {
            // Fast: raw points first so the route draws immediately.
            const data = await deviceApi.getHistory(selected.deviceId);
            const h = (data.data || data || []).map(p => ({
                latitude: p.Position?.[1] ?? p.position?.[1],
                longitude: p.Position?.[0] ?? p.position?.[0],
            })).filter(c => c.latitude && c.longitude);
            setHistory(h);
            if (h.length === 0) {
                toast.info('No History', 'No route history available for this device');
            } else if (mapRef.current) {
                mapRef.current.fitToCoordinates(h, {
                    edgePadding: { top: 120, right: 60, bottom: 320, left: 60 },
                    animated: true,
                });
            }
            // Slower: road-matched polyline swaps in when OSRM returns.
            deviceApi.getHistory(selected.deviceId, undefined, undefined, { matched: true })
                .then(res => {
                    const mp = (res.matchedPath || [])
                        .map(([lng, lat]) => ({ latitude: lat, longitude: lng }))
                        .filter(c => c.latitude && c.longitude);
                    if (mp.length >= 2) setMatchedPath(mp);
                })
                .catch(() => { /* raw line already shown */ });
        } catch (_) {
            toast.error('Error', 'Could not load history');
        } finally {
            setHistoryLoading(false);
        }
    };

    const toggleAntitheft = async () => {
        if (!selected || armLoading) return;
        
        // Show confirm modal for both arming and disarming
        if (selected.antitheftEnabled) {
            setShowDisarmModal(true);
        } else {
            setShowArmModal(true);
        }
    };

    const performAntitheftToggle = useCallback(async () => {
        if (!selected || armLoading) return;
        setArmLoading(true);
        setShowArmModal(false);
        setShowDisarmModal(false);
        
        try {
            if (selected.antitheftEnabled) {
                await antitheftApi.disable(selected.deviceId);
                toast.success('Disarmed', 'Anti-theft protection disabled');
                // Reload geofences to remove the deleted one
                await refreshGeofences();
            } else {
                await antitheftApi.enable(selected.deviceId);
                toast.success('Armed', 'Anti-theft protection enabled');
                // Show geofences when armed and reload to show new one
                if (!showGeofences) {
                    setShowGeofences(true);
                }
                await refreshGeofences();
            }
            await load();
        } catch (e) {
            toast.error('Error', e.message || 'Could not toggle anti-theft');
        } finally {
            setArmLoading(false);
        }
    }, [armLoading, load, refreshGeofences, selected, showGeofences, toast]);

    const onlineCount = devices.filter(d => d.isOnline).length;
    const selectedDevice = useMemo(
        () => (selected ? devices.find((device) => device.deviceId === selected.deviceId) || selected : null),
        [devices, selected]
    );

    const sheetTranslate = sheetAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [200, 0],
    });

    if (!MapView) {
        return (
            <View style={s.fallback}>
                <Ionicons name="map-outline" size={48} color={MUTED} />
                <Text style={[s.fallbackText, { color: MUTED }]}>Map unavailable on this platform</Text>
            </View>
        );
    }

    return (
        <View style={s.container}>
            {/* IMPORTANT: on the New Architecture (Fabric), react-native-maps only
                lays out with flex sizing — StyleSheet.absoluteFillObject makes the
                Fabric shadow node compute 0×0 and the map renders blank. */}
            <MapView
                ref={mapRef}
                style={{ flex: 1 }}
                initialRegion={{ latitude: 10.8231, longitude: 106.6297, latitudeDelta: 0.08, longitudeDelta: 0.08 }}
                showsUserLocation
                showsMyLocationButton={false}
                customMapStyle={mapDarkStyle}
                onRegionChangeComplete={setRegion}
                onPanDrag={() => { if (followId) setFollowId(null); }}
            >
                {Polygon && geofences.map(gf => (
                    <Polygon
                        key={gf.id}
                        coordinates={gf.coordinates}
                        strokeColor={showGeofences ? "#F59E0B" : "rgba(245,158,11,0)"}
                        fillColor={showGeofences ? "rgba(245,158,11,0.08)" : "rgba(245,158,11,0)"}
                        strokeWidth={showGeofences ? 1.5 : 0}
                        tappable={showGeofences}
                        onPress={() => showGeofences && toast.info(gf.id, `Geofence zone · ${gf.coordinates.length} points`)}
                    />
                ))}
                {matchedPath.length >= 2 ? (
                    <Polyline coordinates={matchedPath} strokeColor={ACCENT} strokeWidth={2.5} lineCap="round" lineJoin="round" />
                ) : history.length > 0 ? (
                    <Polyline coordinates={history} strokeColor={`${ACCENT}99`} strokeWidth={2} lineCap="round" lineJoin="round" lineDashPattern={[6, 5]} />
                ) : null}
                <SmoothDeviceMarkers
                    devices={devices}
                    selectedId={selected?.deviceId}
                    onSelect={selectDevice}
                    mapRef={mapRef}
                    followId={followId}
                />
            </MapView>

            {/* Top Label */}
            <View style={[s.topLabel, { top: insets.top + 8 }]}>
                <Text style={s.topLabelText}>Live Tracking</Text>
            </View>

            {/* Back Button */}
            <TouchableOpacity style={[s.backBtn, { top: insets.top + 8 }]} onPress={() => router.back()}>
                <Ionicons name="arrow-back" size={22} color="#FFF" />
            </TouchableOpacity>

            {/* Map Controls */}
            <View style={s.mapControls}>
                <TouchableOpacity
                    style={s.controlBtn}
                    onPress={() => fitToDevices(devices)}
                    activeOpacity={0.7}
                >
                    <Ionicons name="navigate" size={20} color={ACCENT} />
                </TouchableOpacity>
                <TouchableOpacity
                    style={[s.controlBtn, followId && s.controlBtnActive]}
                    onPress={() => {
                        if (followId) { setFollowId(null); return; }
                        const target = selected || devices.find(d => d.position);
                        if (!target?.position) {
                            toast.info('Follow', 'Select a device to follow it');
                            return;
                        }
                        if (!selected) setSelected(target);
                        setFollowId(target.deviceId);
                    }}
                    activeOpacity={0.7}
                >
                    <Ionicons name="compass" size={20} color={followId ? ACCENT : '#6B7280'} />
                </TouchableOpacity>
                <TouchableOpacity
                    style={[s.controlBtn, showGeofences && s.controlBtnActive]}
                    onPress={() => setShowGeofences(v => !v)}
                    activeOpacity={0.7}
                >
                    <Ionicons name="location" size={20} color={showGeofences ? '#F59E0B' : '#6B7280'} />
                </TouchableOpacity>
                <TouchableOpacity 
                    style={s.controlBtn} 
                    onPress={() => mapRef.current?.animateToRegion({ ...region, latitudeDelta: region.latitudeDelta / 2, longitudeDelta: region.longitudeDelta / 2 }, 300)}
                    activeOpacity={0.7}
                >
                    <Ionicons name="add" size={22} color="#FFF" />
                </TouchableOpacity>
                <TouchableOpacity 
                    style={s.controlBtn} 
                    onPress={() => mapRef.current?.animateToRegion({ ...region, latitudeDelta: region.latitudeDelta * 2, longitudeDelta: region.longitudeDelta * 2 }, 300)}
                    activeOpacity={0.7}
                >
                    <Ionicons name="remove" size={22} color="#FFF" />
                </TouchableOpacity>
            </View>

            {/* Bottom Sheet */}
            <View style={[s.sheet, { paddingBottom: insets.bottom + 16 }]}>
                {selectedDevice ? (
                    <Animated.View style={{ transform: [{ translateY: sheetTranslate }] }}>
                        {/* Device Info Card */}
                        <View style={s.deviceCard}>
                            <View style={[s.deviceAvatar, { backgroundColor: selectedDevice.isOnline ? '#A3E63520' : '#6B728020' }]}>
                                <Ionicons
                                    name={selectedDevice.type === 'motorbike' ? 'bicycle' : 'car-sport'}
                                    size={22}
                                    color={selectedDevice.isOnline ? ACCENT : MUTED}
                                />
                            </View>
                            <View style={{ flex: 1, marginLeft: 12 }}>
                                <Text style={s.deviceName}>{selectedDevice.displayName || selectedDevice.deviceId}</Text>
                                <Text style={s.deviceType}>{selectedDevice.type || 'Vehicle'} · {selectedDevice.isOnline ? 'Active' : 'Idle'}</Text>
                            </View>
                            <TouchableOpacity style={s.closeSheetBtn} onPress={() => { setSelected(null); setHistory([]); setMatchedPath([]); }}>
                                <Ionicons name="close" size={18} color="#FFF" />
                            </TouchableOpacity>
                        </View>

                        {/* Actions */}
                        <View style={s.actionsRow}>
                            <TouchableOpacity style={s.actionBtn} onPress={loadHistory} disabled={historyLoading} activeOpacity={0.7}>
                                {historyLoading ? (
                                    <ActivityIndicator size="small" color={ACCENT} />
                                ) : (
                                    <Ionicons name="analytics-outline" size={18} color={ACCENT} />
                                )}
                                <Text style={s.actionText}>{historyLoading ? 'Loading...' : 'History'}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={s.actionBtn} onPress={toggleAntitheft} disabled={armLoading} activeOpacity={0.7}>
                                {armLoading ? (
                                    <ActivityIndicator size="small" color={selectedDevice.antitheftEnabled ? '#EF4444' : ACCENT} />
                                ) : (
                                    <Ionicons name={selectedDevice.antitheftEnabled ? 'shield' : 'shield-outline'} size={18} color={selectedDevice.antitheftEnabled ? '#EF4444' : ACCENT} />
                                )}
                                <Text style={s.actionText}>{selectedDevice.antitheftEnabled ? 'Disarm' : 'Arm'}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={s.actionBtn} onPress={() => {
                                if (selectedDevice.position && mapRef.current) {
                                    mapRef.current.animateToRegion({
                                        latitude: selectedDevice.position[1], longitude: selectedDevice.position[0],
                                        latitudeDelta: 0.003, longitudeDelta: 0.003,
                                    }, 600);
                                }
                            }} activeOpacity={0.7}>
                                <Ionicons name="locate-outline" size={18} color={ACCENT} />
                                <Text style={s.actionText}>Focus</Text>
                            </TouchableOpacity>
                        </View>

                        {/* Tracking Status */}
                        <Text style={s.statusTitle}>Tracking Status</Text>
                        <View style={s.timeline}>
                            <TimelineItem
                                active
                                icon="location"
                                text={selectedDevice.position ? `Lat ${selectedDevice.position[1]?.toFixed(4)}, Lng ${selectedDevice.position[0]?.toFixed(4)}` : 'No position data'}
                                sub="Current position"
                            />
                            <TimelineItem
                                icon="pulse"
                                text={selectedDevice.isOnline ? 'Device is online' : 'Device is offline'}
                                sub={`Status: ${selectedDevice.isOnline ? 'Connected' : 'Disconnected'}`}
                            />
                            {history.length > 0 && (
                                <TimelineItem
                                    icon="analytics"
                                    text={`${history.length} position records`}
                                    sub="Route history loaded"
                                />
                            )}
                        </View>
                    </Animated.View>
                ) : (
                    <View>
                        <Text style={s.sheetHint}>{onlineCount} of {devices.length} devices online{geofences.length > 0 ? ` · ${geofences.length} zone${geofences.length > 1 ? 's' : ''}` : ''}</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingTop: 8 }}>
                            {devices.map(d => (
                                <TouchableOpacity key={d.deviceId} style={s.deviceChip} onPress={() => selectDevice(d)} activeOpacity={0.7}>
                                    <View style={[s.chipDot, { backgroundColor: d.isOnline ? ACCENT : MUTED }]} />
                                    <Text style={s.chipName} numberOfLines={1}>{d.displayName || d.deviceId}</Text>
                                    <Ionicons name="chevron-forward" size={14} color={MUTED} />
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>
                )}
            </View>

            {/* Confirm Modals */}
            <ConfirmModal
                visible={showArmModal}
                icon="shield-checkmark"
                title="Enable Anti-theft?"
                message={`Arm ${selectedDevice?.displayName || 'this device'} with anti-theft protection? You'll be alerted if it moves outside the safe zone.`}
                confirmText="Enable Protection"
                confirmColor={ACCENT}
                onConfirm={performAntitheftToggle}
                onCancel={() => setShowArmModal(false)}
            />

            <ConfirmModal
                visible={showDisarmModal}
                icon="shield-outline"
                title="Disable Anti-theft?"
                message={`Disarm ${selectedDevice?.displayName || 'this device'}? You will no longer receive alerts if it moves.`}
                confirmText="Disable Protection"
                confirmColor="#EF4444"
                onConfirm={performAntitheftToggle}
                onCancel={() => setShowDisarmModal(false)}
            />
        </View>
    );
}

function TimelineItem({ active, icon, text, sub }) {
    return (
        <View style={s.tlItem}>
            <View style={s.tlDotCol}>
                <View style={[s.tlDot, active && { backgroundColor: ACCENT }]}>
                    <Ionicons name={icon} size={12} color={active ? '#1A1F2E' : '#9CA3AF'} />
                </View>
                <View style={s.tlLine} />
            </View>
            <View style={{ flex: 1, paddingBottom: 16 }}>
                <Text style={[s.tlText, active && { color: '#FFF', fontWeight: '700' }]}>{text}</Text>
                <Text style={s.tlSub}>{sub}</Text>
            </View>
        </View>
    );
}

const mapDarkStyle = [
    { elementType: 'geometry', stylers: [{ color: '#242f3e' }] },
    { elementType: 'labels.text.stroke', stylers: [{ color: '#242f3e' }] },
    { elementType: 'labels.text.fill', stylers: [{ color: '#746855' }] },
    { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#38414e' }] },
    { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#212a37' }] },
    { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#746855' }] },
    { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#17263c' }] },
    { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#515c6d' }] },
    { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] },
    { featureType: 'transit', stylers: [{ visibility: 'off' }] },
];

const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: DARK },
    fallback: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: DARK },
    fallbackText: { marginTop: 12, fontSize: 14 },

    topLabel: { position: 'absolute', alignSelf: 'center', backgroundColor: 'rgba(26,31,46,0.85)', paddingHorizontal: 20, paddingVertical: 8, borderRadius: 20 },
    topLabelText: { color: '#FFF', fontSize: 14, fontWeight: '700' },

    backBtn: { position: 'absolute', left: 16, width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(26,31,46,0.7)', alignItems: 'center', justifyContent: 'center' },

    mapControls: { position: 'absolute', right: 16, top: '40%', gap: 10 },
    controlBtn: { 
        width: 46, 
        height: 46, 
        borderRadius: 23, 
        backgroundColor: 'rgba(26,31,46,0.9)', 
        alignItems: 'center', 
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
        elevation: 5,
    },
    controlBtnActive: { 
        backgroundColor: 'rgba(245,158,11,0.25)', 
        borderWidth: 2, 
        borderColor: 'rgba(245,158,11,0.6)' 
    },

    marker: { 
        width: 32, 
        height: 32, 
        borderRadius: 16, 
        backgroundColor: ACCENT, 
        alignItems: 'center', 
        justifyContent: 'center', 
        borderWidth: 3, 
        borderColor: '#FFF',
        shadowColor: ACCENT,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.4,
        shadowRadius: 4,
        elevation: 5,
    },
    markerSel: { 
        width: 42, 
        height: 42, 
        borderRadius: 21, 
        backgroundColor: '#7C3AED',
        shadowColor: '#7C3AED',
        shadowOpacity: 0.6,
    },
    markerOff: { 
        backgroundColor: MUTED,
        shadowColor: MUTED,
        shadowOpacity: 0.3,
    },

    sheet: { 
        position: 'absolute', 
        bottom: 0, 
        left: 0, 
        right: 0, 
        backgroundColor: DARK, 
        borderTopLeftRadius: 28, 
        borderTopRightRadius: 28, 
        paddingHorizontal: 20, 
        paddingTop: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 10,
    },

    deviceCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: DARK_CARD, borderRadius: 16, padding: 14 },
    deviceAvatar: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
    deviceName: { color: '#FFF', fontSize: 16, fontWeight: '700' },
    deviceType: { color: MUTED, fontSize: 13, marginTop: 2 },
    closeSheetBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' },

    actionsRow: { flexDirection: 'row', gap: 12, marginTop: 14 },
    actionBtn: { 
        flex: 1, 
        flexDirection: 'row', 
        alignItems: 'center', 
        justifyContent: 'center', 
        backgroundColor: DARK_CARD, 
        height: 48, 
        borderRadius: 14, 
        gap: 7,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)',
    },
    actionText: { color: '#E5E7EB', fontSize: 14, fontWeight: '700' },

    statusTitle: { color: '#FFF', fontSize: 17, fontWeight: '800', marginTop: 20, marginBottom: 12 },

    timeline: { marginLeft: 4 },
    tlItem: { flexDirection: 'row' },
    tlDotCol: { alignItems: 'center', width: 28, marginRight: 10 },
    tlDot: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#374151', alignItems: 'center', justifyContent: 'center' },
    tlLine: { width: 2, flex: 1, backgroundColor: '#374151', marginVertical: 2 },
    tlText: { color: '#D1D5DB', fontSize: 14 },
    tlSub: { color: MUTED, fontSize: 12, marginTop: 2 },

    sheetHint: { color: '#D1D5DB', fontSize: 15, fontWeight: '600' },
    deviceChip: { flexDirection: 'row', alignItems: 'center', backgroundColor: DARK_CARD, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, gap: 8 },
    chipDot: { width: 8, height: 8, borderRadius: 4 },
    chipName: { color: '#FFF', fontSize: 13, fontWeight: '600', maxWidth: 120 },
});
