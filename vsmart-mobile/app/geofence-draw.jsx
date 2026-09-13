import { useState, useRef } from 'react';
import {
    View, Text, TouchableOpacity, TextInput,
    ActivityIndicator, Platform, StyleSheet, KeyboardAvoidingView,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { geofenceApi } from '../src/api/deviceApi';
import { useToast } from '../src/components/ui/Toast';

let MapView, Marker, Polyline, Polygon, Circle;
if (Platform.OS !== 'web') {
    try {
        const Maps = require('react-native-maps');
        MapView = Maps.default;
        Marker = Maps.Marker;
        Polyline = Maps.Polyline;
        Polygon = Maps.Polygon;
        Circle = Maps.Circle;
    } catch (_e) { }
}

function buildCirclePolygon(center, radiusMeters, steps = 64) {
    const [lng, lat] = center;
    const coords = [];
    const radiusDeg = radiusMeters / 111320;
    for (let i = 0; i <= steps; i++) {
        const angle = (i / steps) * 2 * Math.PI;
        coords.push([
            lng + radiusDeg * Math.cos(angle) / Math.cos(lat * Math.PI / 180),
            lat + radiusDeg * Math.sin(angle),
        ]);
    }
    return coords;
}

const MODE = { IDLE: 'idle', POLYGON: 'polygon', CIRCLE_CENTER: 'circle_center', CIRCLE_RADIUS: 'circle_radius' };

export default function GeofenceDrawScreen() {
    const toast = useToast();
    const insets = useSafeAreaInsets();
    const mapRef = useRef(null);
    const [mode, setMode] = useState(MODE.IDLE);
    const [vertices, setVertices] = useState([]);
    const [circleCenter, setCircleCenter] = useState(null);
    const [circleRadius, setCircleRadius] = useState(500);
    const [radiusText, setRadiusText] = useState('500');
    const [geofenceName, setGeofenceName] = useState('');
    const [saving, setSaving] = useState(false);
    const [formError, setFormError] = useState('');

    const handleMapPress = (e) => {
        const { latitude, longitude } = e.nativeEvent.coordinate;
        if (mode === MODE.POLYGON) {
            setVertices(prev => [...prev, { latitude, longitude }]);
        } else if (mode === MODE.CIRCLE_CENTER) {
            setCircleCenter({ latitude, longitude });
            setMode(MODE.CIRCLE_RADIUS);
        }
    };

    const handleUndo = () => {
        if (mode === MODE.POLYGON && vertices.length > 0) {
            setVertices(prev => prev.slice(0, -1));
        }
    };

    const handleClear = () => {
        setVertices([]);
        setCircleCenter(null);
        setMode(MODE.IDLE);
        setGeofenceName('');
    };

    const handleSave = async () => {
        if (!geofenceName.trim()) return setFormError('Please enter a geofence name');

        let polygonCoords;
        if (mode === MODE.POLYGON) {
            if (vertices.length < 3) return setFormError('At least 3 points required');
            polygonCoords = vertices.map(v => [v.longitude, v.latitude]);
            const first = polygonCoords[0], last = polygonCoords[polygonCoords.length - 1];
            if (first[0] !== last[0] || first[1] !== last[1]) polygonCoords.push([...first]);
        } else if (mode === MODE.CIRCLE_RADIUS && circleCenter) {
            polygonCoords = buildCirclePolygon([circleCenter.longitude, circleCenter.latitude], circleRadius);
        } else {
            return setFormError('Please draw a geofence first');
        }

        setFormError('');
        setSaving(true);
        try {
            await geofenceApi.put(geofenceName.trim(), polygonCoords);
            toast.success('Geofence Created', `"${geofenceName}" has been saved successfully`);
            setTimeout(() => router.back(), 800);
        } catch (err) {
            setFormError(err.message || 'Could not save geofence');
        } finally {
            setSaving(false);
        }
    };

    const canSave = geofenceName.trim() && (
        (mode === MODE.POLYGON && vertices.length >= 3) ||
        (mode === MODE.CIRCLE_RADIUS && circleCenter)
    );

    if (!MapView) {
        return (
            <View style={s.fallback}>
                <Ionicons name="warning" size={50} color="#F59E0B" />
                <Text style={s.fallbackText}>Bản đồ chỉ hỗ trợ trên iOS/Android</Text>
                <TouchableOpacity style={s.fallbackBtn} onPress={() => router.back()}>
                    <Text style={s.fallbackBtnText}>Quay lại</Text>
                </TouchableOpacity>
            </View>
        );
    }

    return (
        <View style={s.container}>
            <MapView
                ref={mapRef}
                style={{ flex: 1 }}
                initialRegion={{ latitude: 10.8231, longitude: 106.6297, latitudeDelta: 0.05, longitudeDelta: 0.05 }}
                onPress={handleMapPress}
            >
                {mode === MODE.POLYGON && vertices.length >= 2 && (
                    <Polyline coordinates={vertices} strokeColor="#F97316" strokeWidth={3} lineDashPattern={[8, 4]} />
                )}
                {mode === MODE.POLYGON && vertices.length >= 3 && (
                    <Polygon coordinates={vertices} strokeColor="#F97316" fillColor="rgba(249,115,22,0.15)" strokeWidth={2} />
                )}
                {mode === MODE.POLYGON && vertices.map((v, i) => (
                    <Marker key={i} coordinate={v} anchor={{ x: 0.5, y: 0.5 }}>
                        <View style={[s.markerDot, { backgroundColor: i === 0 ? '#10B981' : '#F97316' }]}>
                            <Text style={s.markerText}>{i + 1}</Text>
                        </View>
                    </Marker>
                ))}
                {circleCenter && (
                    <Marker coordinate={circleCenter} anchor={{ x: 0.5, y: 0.5 }}>
                        <View style={s.circleMarker}>
                            <Ionicons name="locate" size={16} color="#FFF" />
                        </View>
                    </Marker>
                )}
                {mode === MODE.CIRCLE_RADIUS && circleCenter && (
                    <Circle center={circleCenter} radius={circleRadius} strokeColor="#3B82F6" fillColor="rgba(59,130,246,0.15)" strokeWidth={2} />
                )}
            </MapView>

            {/* Top Header */}
            <View style={s.header}>
                <View style={s.headerRow}>
                    <TouchableOpacity style={s.headerBtn} onPress={() => router.back()}>
                        <Ionicons name="arrow-back" size={22} color="#FFF" />
                    </TouchableOpacity>
                    <Text style={s.headerTitle}>Vẽ Geofence</Text>
                    <TouchableOpacity style={s.headerBtn} onPress={handleClear}>
                        <Ionicons name="refresh" size={22} color="#94A3B8" />
                    </TouchableOpacity>
                </View>

                {mode === MODE.IDLE && (
                    <View style={s.modeSelect}>
                        <Text style={s.hintText}>Chọn kiểu geofence để bắt đầu vẽ</Text>
                        <View style={s.modeRow}>
                            <TouchableOpacity style={[s.modeBtn, { backgroundColor: '#F97316' }]} onPress={() => setMode(MODE.POLYGON)}>
                                <Ionicons name="shapes-outline" size={18} color="#FFF" />
                                <Text style={s.modeBtnText}>Polygon</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[s.modeBtn, { backgroundColor: '#3B82F6', marginLeft: 12 }]} onPress={() => setMode(MODE.CIRCLE_CENTER)}>
                                <Ionicons name="ellipse-outline" size={18} color="#FFF" />
                                <Text style={s.modeBtnText}>Circle</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                )}

                {mode === MODE.POLYGON && (
                    <View style={{ marginTop: 8 }}>
                        <Text style={s.hintText}>
                            Nhấn lên bản đồ để thêm điểm ({vertices.length} điểm)
                            {vertices.length < 3 ? ' — cần tối thiểu 3' : ' ✓'}
                        </Text>
                        {vertices.length > 0 && (
                            <TouchableOpacity style={{ marginTop: 8, alignItems: 'center' }} onPress={handleUndo}>
                                <Text style={{ color: '#FB923C', fontSize: 12, fontWeight: '500' }}>Hoàn tác điểm cuối</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                )}

                {mode === MODE.CIRCLE_CENTER && (
                    <Text style={[s.hintText, { marginTop: 8 }]}>Nhấn lên bản đồ để chọn tâm vòng tròn</Text>
                )}
            </View>

            {/* Circle Radius Control */}
            {mode === MODE.CIRCLE_RADIUS && circleCenter && (
                <View style={s.radiusPanel}>
                    <Text style={s.radiusTitle}>Bán kính vòng tròn</Text>
                    <View style={s.radiusChips}>
                        {[100, 500, 1000, 5000].map((r, i) => (
                            <TouchableOpacity
                                key={r}
                                style={[s.chip, r === circleRadius && s.chipActive, i > 0 && { marginLeft: 8 }]}
                                onPress={() => { setCircleRadius(r); setRadiusText(String(r)); }}
                            >
                                <Text style={[s.chipText, r === circleRadius && s.chipTextActive]}>
                                    {r >= 1000 ? `${r / 1000}km` : `${r}m`}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                    <View style={s.radiusInputRow}>
                        <TextInput
                            style={s.radiusInput}
                            value={radiusText}
                            onChangeText={(t) => {
                                setRadiusText(t);
                                const n = parseInt(t, 10);
                                if (n > 0 && n <= 100000) setCircleRadius(n);
                            }}
                            keyboardType="number-pad"
                            placeholder="Nhập bán kính (m)"
                        />
                        <Text style={{ fontSize: 14, color: '#64748B', marginLeft: 8 }}>mét</Text>
                    </View>
                </View>
            )}

            {/* Bottom Save Panel */}
            {mode !== MODE.IDLE && (
                <View style={s.bottomDock} pointerEvents="box-none">
                    <KeyboardAvoidingView
                        pointerEvents="box-none"
                        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                        keyboardVerticalOffset={Math.max(insets.top, 0) + 12}
                    >
                        <View style={[s.bottomPanel, { marginBottom: Math.max(insets.bottom, 16) + 12 }]}>
                        {formError ? (
                            <View style={s.inlineError}>
                                <Ionicons name="alert-circle" size={16} color="#F87171" />
                                <Text style={s.inlineErrorText}>{formError}</Text>
                            </View>
                        ) : null}
                        <Text style={s.nameLabel}>Geofence Name</Text>
                        <TextInput
                            style={[s.nameInput, !geofenceName.trim() && formError ? s.nameInputError : null]}
                            placeholder="e.g. Zone-A"
                            placeholderTextColor="#94A3B8"
                            value={geofenceName}
                            onChangeText={v => { setGeofenceName(v); if (formError) setFormError(''); }}
                        />
                        <View style={s.actionRow}>
                            <TouchableOpacity style={s.cancelBtn} onPress={handleClear}>
                                <Text style={s.cancelText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[s.saveBtn, !canSave && s.saveBtnDisabled]}
                                onPress={handleSave}
                                disabled={!canSave || saving}
                            >
                                {saving ? (
                                    <ActivityIndicator color="#FFF" />
                                ) : (
                                    <Text style={[s.saveText, !canSave && { color: '#64748B' }]}>Save Geofence</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                        </View>
                    </KeyboardAvoidingView>
                </View>
            )}
        </View>
    );
}

const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F8FAFC' },
    bottomDock: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, zIndex: 999, elevation: 999, justifyContent: 'flex-end', paddingHorizontal: 20 },
    fallback: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8FAFC', padding: 24 },
    fallbackText: { textAlign: 'center', marginTop: 16, color: '#475569' },
    fallbackBtn: { marginTop: 16, backgroundColor: '#1E293B', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 },
    fallbackBtnText: { color: '#FFF', fontWeight: '700' },

    header: { position: 'absolute', top: 48, left: 20, right: 20, backgroundColor: 'rgba(15,23,42,0.9)', padding: 16, borderRadius: 16 },
    headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    headerBtn: { padding: 4 },
    headerTitle: { color: '#FFF', fontSize: 18, fontWeight: '700' },
    hintText: { color: '#CBD5E1', fontSize: 12, textAlign: 'center' },

    modeSelect: { marginTop: 12 },
    modeRow: { flexDirection: 'row', marginTop: 12 },
    modeBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: 12 },
    modeBtnText: { color: '#FFF', fontWeight: '700', marginLeft: 8 },

    markerDot: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: '#FFF', alignItems: 'center', justifyContent: 'center' },
    markerText: { color: '#FFF', fontSize: 8, fontWeight: '700' },
    circleMarker: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#3B82F6', borderWidth: 2, borderColor: '#FFF', alignItems: 'center', justifyContent: 'center' },

    radiusPanel: { position: 'absolute', top: 176, left: 20, right: 20, backgroundColor: 'rgba(255,255,255,0.95)', padding: 16, borderRadius: 16, borderWidth: 1, borderColor: '#DBEAFE' },
    radiusTitle: { fontSize: 14, fontWeight: '700', color: '#0F172A', marginBottom: 8 },
    radiusChips: { flexDirection: 'row' },
    chip: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center', backgroundColor: '#F1F5F9' },
    chipActive: { backgroundColor: '#3B82F6' },
    chipText: { fontSize: 12, fontWeight: '700', color: '#475569' },
    chipTextActive: { color: '#FFF' },
    radiusInputRow: { flexDirection: 'row', alignItems: 'center', marginTop: 12 },
    radiusInput: { flex: 1, backgroundColor: '#F1F5F9', borderRadius: 8, paddingHorizontal: 12, height: 40, fontSize: 14, color: '#0F172A' },

    bottomPanel: { backgroundColor: '#FFF', borderRadius: 24, padding: 20, shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.1, shadowRadius: 16, elevation: 12, borderWidth: 1, borderColor: '#F1F5F9', zIndex: 60 },
    inlineError: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(239,68,68,0.1)', borderRadius: 12, padding: 10, marginBottom: 10, borderWidth: 1, borderColor: 'rgba(239,68,68,0.25)' },
    inlineErrorText: { color: '#DC2626', fontSize: 13, fontWeight: '600', marginLeft: 8, flex: 1 },
    nameLabel: { fontSize: 14, fontWeight: '500', color: '#475569', marginBottom: 4 },
    nameInput: { backgroundColor: '#F1F5F9', borderRadius: 12, paddingHorizontal: 16, height: 48, fontSize: 16, color: '#0F172A', marginBottom: 16, borderWidth: 1, borderColor: 'transparent' },
    nameInputError: { borderColor: '#EF4444', borderWidth: 1.5 },
    actionRow: { flexDirection: 'row' },
    cancelBtn: { flex: 1, height: 48, backgroundColor: '#F1F5F9', borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    cancelText: { color: '#475569', fontWeight: '700' },
    saveBtn: { flex: 1, height: 48, backgroundColor: '#F97316', borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginLeft: 12 },
    saveBtnDisabled: { backgroundColor: '#CBD5E1' },
    saveText: { color: '#FFF', fontWeight: '700' },
});
