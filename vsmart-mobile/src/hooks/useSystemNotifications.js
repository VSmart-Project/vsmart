import { useEffect, useMemo, useRef } from 'react';
import { AppState } from 'react-native';
import { useLiveDevices } from '../contexts/DeviceDataContext';
import { useLiveGeofences } from '../contexts/GeofenceDataContext';
import {
    requestNotificationPermissions,
    showAntitheftAlert,
    showDeviceOfflineAlert,
    showDeviceOnlineAlert,
    showGeofenceAlert,
} from '../services/localNotificationService';

const EVENT_COOLDOWN_MS = 60000;

function normalizeDeviceName(device) {
    return device?.displayName || device?.deviceId || 'Unknown device';
}

function pointInPolygon(position, polygon) {
    if (!Array.isArray(position) || position.length < 2 || !Array.isArray(polygon) || polygon.length < 3) {
        return false;
    }

    const [lng, lat] = position;
    let inside = false;

    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const [xi, yi] = polygon[i];
        const [xj, yj] = polygon[j];
        const intersects =
            yi > lat !== yj > lat &&
            lng < ((xj - xi) * (lat - yi)) / ((yj - yi) || Number.EPSILON) + xi;

        if (intersects) inside = !inside;
    }

    return inside;
}

function getDeviceGeofences(device, geofences) {
    if (!Array.isArray(device?.position)) return [];

    return geofences
        .filter((geofence) => pointInPolygon(device.position, geofence.polygon))
        .map((geofence) => geofence.id);
}

function arraysEqual(a = [], b = []) {
    if (a.length !== b.length) return false;
    return a.every((item, index) => item === b[index]);
}

export function useSystemNotifications(isAuthenticated, toast) {
    const { devices } = useLiveDevices();
    const { geofences } = useLiveGeofences();
    const previousDevicesRef = useRef(new Map());
    const eventTimestampsRef = useRef(new Map());
    const initializedRef = useRef(false);
    const permissionGrantedRef = useRef(false);
    const appStateRef = useRef(AppState.currentState);

    const shouldNotify = useMemo(() => {
        return (key) => {
            const now = Date.now();
            const lastSent = eventTimestampsRef.current.get(key) || 0;
            if (now - lastSent < EVENT_COOLDOWN_MS) {
                return false;
            }
            eventTimestampsRef.current.set(key, now);
            return true;
        };
    }, []);

    useEffect(() => {
        if (!isAuthenticated) {
            previousDevicesRef.current = new Map();
            eventTimestampsRef.current.clear();
            initializedRef.current = false;
        }
    }, [isAuthenticated]);

    useEffect(() => {
        if (!isAuthenticated) return undefined;

        let cancelled = false;

        const bootstrap = async () => {
            permissionGrantedRef.current = await requestNotificationPermissions();
            if (cancelled) return;
        };

        bootstrap();
        return () => {
            cancelled = true;
        };
    }, [isAuthenticated]);

    useEffect(() => {
        const subscription = AppState.addEventListener('change', (nextState) => {
            appStateRef.current = nextState;
        });

        return () => subscription.remove();
    }, []);

    useEffect(() => {
        if (!isAuthenticated || appStateRef.current !== 'active') return undefined;

        let cancelled = false;

        const evaluate = async () => {
            try {
                const nextSnapshot = new Map();

                devices.forEach((device) => {
                    const previous = previousDevicesRef.current.get(device.deviceId);
                    const positionChanged = !previous || !arraysEqual(previous.position, device.position);
                    
                    let geofenceIds;
                    if (previous && !positionChanged) {
                        geofenceIds = previous.geofenceIds;
                    } else {
                        geofenceIds = getDeviceGeofences(device, geofences).sort();
                    }

                    nextSnapshot.set(device.deviceId, {
                        isOnline: !!device.isOnline,
                        antitheftEnabled: !!device.antitheftEnabled,
                        geofenceIds,
                        position: device.position || null,
                        name: normalizeDeviceName(device),
                    });
                });

                if (!initializedRef.current) {
                    previousDevicesRef.current = nextSnapshot;
                    initializedRef.current = true;
                    return;
                }

                for (const [deviceId, current] of nextSnapshot.entries()) {
                    const previous = previousDevicesRef.current.get(deviceId);
                    if (!previous) continue;

                    if (previous.isOnline !== current.isOnline) {
                        const key = `${deviceId}:${current.isOnline ? 'online' : 'offline'}`;
                        if (permissionGrantedRef.current && shouldNotify(key)) {
                            if (current.isOnline) {
                                await showDeviceOnlineAlert(current.name);
                            } else {
                                await showDeviceOfflineAlert(current.name);
                            }
                        }
                    }

                    const enteredGeofences = current.geofenceIds.filter((id) => !previous.geofenceIds.includes(id));
                    const exitedGeofences = previous.geofenceIds.filter((id) => !current.geofenceIds.includes(id));

                    for (const geofenceId of enteredGeofences) {
                        const key = `${deviceId}:enter:${geofenceId}`;
                        if (shouldNotify(key)) {
                            toast?.info?.('ENTER detected', `${current.name} entered ${geofenceId}`);
                            if (permissionGrantedRef.current) {
                                await showGeofenceAlert(current.name, geofenceId, 'ENTER');
                            }
                        }
                    }

                    for (const geofenceId of exitedGeofences) {
                        const key = `${deviceId}:exit:${geofenceId}`;
                        if (shouldNotify(key)) {
                            toast?.warning?.('EXIT detected', `${current.name} left ${geofenceId}`);
                            if (permissionGrantedRef.current) {
                                await showGeofenceAlert(current.name, geofenceId, 'EXIT');
                            }
                        }
                    }

                    const leftProtectedArea =
                        previous.antitheftEnabled &&
                        current.antitheftEnabled &&
                        previous.position &&
                        current.position &&
                        previous.geofenceIds.length > 0 &&
                        current.geofenceIds.length === 0 &&
                        !arraysEqual(previous.position, current.position);

                    if (leftProtectedArea) {
                        const key = `${deviceId}:antitheft:outside`;
                        if (permissionGrantedRef.current && shouldNotify(key)) {
                            await showAntitheftAlert(
                                current.name,
                                'Moved outside all configured geofence zones while anti-theft is enabled'
                            );
                        }
                    }
                }

                if (!cancelled) {
                    previousDevicesRef.current = nextSnapshot;
                }
            } catch (_error) {
                // Keep notification evaluation silent to avoid interrupting the main UX.
            }
        };

        evaluate();
        return () => {
            cancelled = true;
        };
    }, [devices, geofences, isAuthenticated, shouldNotify, toast]);
}
