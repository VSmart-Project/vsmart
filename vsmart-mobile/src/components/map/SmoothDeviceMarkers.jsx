import { memo, useEffect, useRef, useState } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSmoothedDevices } from '../../realtime/useSmoothedDevices';

let MarkerAnimated;
if (Platform.OS !== 'web') {
    try { MarkerAnimated = require('react-native-maps').MarkerAnimated; } catch (_) {}
}

const ACCENT = '#A3E635';
const MUTED = '#6B7280';
const SELECTED = '#7C3AED';

/**
 * The coordinate + rotation come from Animated values updated natively every
 * frame (see useSmoothedDevices) — this component only re-renders when the
 * device's online/type/selected state changes, never per frame.
 */
const AnimatedDeviceMarker = memo(({ device, anim, isSelected, onPress }) => {
    const [tracks, setTracks] = useState(true);
    useEffect(() => {
        setTracks(true);
        const t = setTimeout(() => setTracks(false), 600);
        return () => clearTimeout(t);
    }, [device.isOnline, device.type, isSelected]);

    if (!anim || !anim.coord) return null;

    return (
        <MarkerAnimated
            coordinate={anim.coord}
            rotation={anim.rot}
            flat
            anchor={{ x: 0.5, y: 0.5 }}
            onPress={onPress}
            tracksViewChanges={tracks}
        >
            <View style={[s.marker, isSelected && s.markerSel, !device.isOnline && s.markerOff]}>
                <Ionicons
                    name={device.type === 'motorbike' ? 'bicycle' : 'car-sport'}
                    size={isSelected ? 18 : 14}
                    color="#FFF"
                />
            </View>
        </MarkerAnimated>
    );
});
AnimatedDeviceMarker.displayName = 'AnimatedDeviceMarker';

export default function SmoothDeviceMarkers({ devices, selectedId, onSelect, mapRef, followId }) {
    const { anims } = useSmoothedDevices(devices);
    const lastCam = useRef(0);

    // Camera-follow reads the follower's latest state on its own timer — no
    // dependency on React renders, so it stays smooth regardless of the tree.
    useEffect(() => {
        if (!followId || !mapRef?.current) return undefined;
        let alive = true;
        const tick = () => {
            if (!alive) return;
            const a = anims.get(followId);
            const now = Date.now();
            if (a && mapRef.current && now - lastCam.current >= 200) {
                lastCam.current = now;
                mapRef.current.animateCamera(
                    { center: { latitude: a.state.latitude, longitude: a.state.longitude }, heading: a.state.heading },
                    { duration: 220 }
                );
            }
            timer = setTimeout(tick, 200);
        };
        let timer = setTimeout(tick, 0);
        return () => { alive = false; clearTimeout(timer); };
    }, [followId, anims, mapRef]);

    if (!MarkerAnimated) return null;

    return devices.map((d) =>
        d.position ? (
            <AnimatedDeviceMarker
                key={d.deviceId}
                device={d}
                anim={anims.get(d.deviceId)}
                isSelected={selectedId === d.deviceId}
                onPress={() => onSelect?.(d)}
            />
        ) : null
    );
}

const s = StyleSheet.create({
    marker: {
        width: 32, height: 32, borderRadius: 16, backgroundColor: ACCENT,
        alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: '#FFF',
        shadowColor: ACCENT, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.4, shadowRadius: 4, elevation: 5,
    },
    markerSel: { width: 42, height: 42, borderRadius: 21, backgroundColor: SELECTED, shadowColor: SELECTED, shadowOpacity: 0.6 },
    markerOff: { backgroundColor: MUTED, shadowColor: MUTED, shadowOpacity: 0.3 },
});
