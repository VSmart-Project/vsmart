import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { geofenceApi } from '../api/deviceApi';

const GEOFENCE_REFRESH_INTERVAL_MS = 30000;

const GeofenceDataContext = createContext(null);

function normalizeGeofences(entries) {
    return (entries || [])
        .map((entry) => {
            const polygon = entry.Geometry?.Polygon?.[0] || [];
            return {
                id: entry.GeofenceId,
                polygon,
                coordinates: polygon.map((point) => ({
                    latitude: point[1],
                    longitude: point[0],
                })),
            };
        })
        .filter((entry) => entry.polygon.length >= 3);
}

export function GeofenceDataProvider({ children, isAuthenticated }) {
    const [geofences, setGeofences] = useState([]);
    const [loading, setLoading] = useState(false);
    const [initialLoaded, setInitialLoaded] = useState(false);
    const [lastUpdatedAt, setLastUpdatedAt] = useState(null);
    const appStateRef = useRef(AppState.currentState);
    const intervalRef = useRef(null);
    const inFlightRef = useRef(false);

    const refreshGeofences = useCallback(async ({ silent = false } = {}) => {
        if (!isAuthenticated || inFlightRef.current) return null;

        inFlightRef.current = true;
        if (!silent) {
            setLoading(true);
        }

        try {
            const response = await geofenceApi.list();
            const normalized = normalizeGeofences(response.Entries);
            setGeofences(normalized);
            setLastUpdatedAt(Date.now());
            setInitialLoaded(true);
            return normalized;
        } catch (error) {
            if (!initialLoaded) {
                setInitialLoaded(true);
            }
            throw error;
        } finally {
            inFlightRef.current = false;
            if (!silent) {
                setLoading(false);
            }
        }
    }, [initialLoaded, isAuthenticated]);

    useEffect(() => {
        if (!isAuthenticated) {
            setGeofences([]);
            setLoading(false);
            setInitialLoaded(false);
            setLastUpdatedAt(null);
            return undefined;
        }

        let cancelled = false;

        const poll = async ({ silent = true } = {}) => {
            if (cancelled || appStateRef.current !== 'active') return;
            try {
                await refreshGeofences({ silent });
            } catch (_error) {
                // Keep shared geofence polling silent.
            }
        };

        poll({ silent: false });
        intervalRef.current = setInterval(() => poll({ silent: true }), GEOFENCE_REFRESH_INTERVAL_MS);

        const subscription = AppState.addEventListener('change', (nextState) => {
            appStateRef.current = nextState;
            if (nextState === 'active') {
                poll({ silent: true });
            }
        });

        return () => {
            cancelled = true;
            if (intervalRef.current) clearInterval(intervalRef.current);
            subscription.remove();
        };
    }, [isAuthenticated, refreshGeofences]);

    const value = useMemo(() => ({
        geofences,
        loading,
        initialLoaded,
        lastUpdatedAt,
        refreshGeofences,
    }), [geofences, loading, initialLoaded, lastUpdatedAt, refreshGeofences]);

    return (
        <GeofenceDataContext.Provider value={value}>
            {children}
        </GeofenceDataContext.Provider>
    );
}

export function useLiveGeofences() {
    const context = useContext(GeofenceDataContext);
    if (!context) {
        throw new Error('useLiveGeofences must be used within GeofenceDataProvider');
    }
    return context;
}
