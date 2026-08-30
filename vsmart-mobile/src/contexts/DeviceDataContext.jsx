import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { io } from 'socket.io-client';
import { deviceApi } from '../api/deviceApi';
import { BACKEND_URL } from '../configuration';
import { getCurrentSession } from '../utils/cognitoAuth';
import {
    applyRealtimeEventToDevices,
    createRealtimeEventTracker,
    shouldProcessRealtimeEvent,
} from '../realtime/eventSchema';

const DEVICE_POLL_INTERVAL_MS = 5000;

const DeviceDataContext = createContext(null);

export function DeviceDataProvider({ children, isAuthenticated }) {
    const [devices, setDevices] = useState([]);
    const [loading, setLoading] = useState(false);
    const [initialLoaded, setInitialLoaded] = useState(false);
    const [lastUpdatedAt, setLastUpdatedAt] = useState(null);
    const appStateRef = useRef(AppState.currentState);
    const intervalRef = useRef(null);
    const inFlightRef = useRef(false);
    const realtimeTrackerRef = useRef(createRealtimeEventTracker());

    const refreshDevices = useCallback(async ({ silent = false } = {}) => {
        if (!isAuthenticated || inFlightRef.current) return null;

        inFlightRef.current = true;
        if (!silent) {
            setLoading(true);
        }

        try {
            const response = await deviceApi.getAll();
            const list = response?.data || response || [];
            setDevices(list);
            setLastUpdatedAt(Date.now());
            setInitialLoaded(true);
            return list;
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

    const applyRealtimeEvent = useCallback((event) => {
        const decision = shouldProcessRealtimeEvent(realtimeTrackerRef.current, event);
        if (!decision.accept) {
            return false;
        }

        setDevices((prev) => applyRealtimeEventToDevices(prev, event));
        setLastUpdatedAt(Date.now());
        return true;
    }, []);

    useEffect(() => {
        if (!isAuthenticated) {
            setDevices([]);
            setLoading(false);
            setInitialLoaded(false);
            setLastUpdatedAt(null);
            realtimeTrackerRef.current = createRealtimeEventTracker();
            return undefined;
        }

        let cancelled = false;

        const poll = async ({ silent = true } = {}) => {
            if (cancelled || appStateRef.current !== 'active') return;
            try {
                await refreshDevices({ silent });
            } catch (_error) {
                // Keep shared polling silent. Screens can surface manual refresh failures.
            }
        };

        poll({ silent: false });
        intervalRef.current = setInterval(() => poll({ silent: true }), DEVICE_POLL_INTERVAL_MS);

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
    }, [isAuthenticated, refreshDevices]);

    // Socket.io Real-time connection
    useEffect(() => {
        if (!isAuthenticated) return undefined;

        console.log('🔌 Connecting to Socket.io server at:', BACKEND_URL);
        let socket;

        getCurrentSession().then((session) => {
            if (!session.idToken) throw new Error('Missing ID token');
            socket = io(BACKEND_URL, { auth: { token: session.idToken } });

            socket.on('connect', () => {
                console.log('Connected to Socket.io with ID:', socket.id);
            });

            socket.on('realtime-event', (event) => {
                console.log('Mobile received realtime event:', event);
                applyRealtimeEvent(event);
            });

            socket.on('disconnect', () => {
                console.log('Disconnected from Socket.io server');
            });

            socket.on('connect_error', (error) => {
                console.warn('Socket authentication failed:', error.message);
            });
        }).catch((error) => {
            console.warn('Could not start realtime connection:', error.message);
        });

        return () => {
            socket?.disconnect();
        };
    }, [isAuthenticated, applyRealtimeEvent]);

    const value = useMemo(() => ({
        devices,
        loading,
        initialLoaded,
        lastUpdatedAt,
        refreshDevices,
        applyRealtimeEvent,
    }), [devices, loading, initialLoaded, lastUpdatedAt, refreshDevices, applyRealtimeEvent]);

    return (
        <DeviceDataContext.Provider value={value}>
            {children}
        </DeviceDataContext.Provider>
    );
}

export function useLiveDevices() {
    const context = useContext(DeviceDataContext);
    if (!context) {
        throw new Error('useLiveDevices must be used within DeviceDataProvider');
    }
    return context;
}
