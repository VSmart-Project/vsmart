import { useState, useCallback, useRef } from 'react';
import { deviceApi } from '../api/deviceApi';
import {
    applyRealtimeEventToDevices,
    createRealtimeEventTracker,
    shouldProcessRealtimeEvent,
} from '../realtime/eventSchema';

/**
 * useDeviceManager
 * Manages full CRUD state for devices through the backend API.
 * Replaces useLocationService for device management.
 */
export const useDeviceManager = () => {
    const [devices, setDevices] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    // Devices actively sending data but not yet registered in DynamoDB
    const [unregisteredDevices, setUnregisteredDevices] = useState([]);
    const realtimeTrackerRef = useRef(createRealtimeEventTracker());

    // ─── FETCH ALL ──────────────────────────────────────────────────────────

    const fetchDevices = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            const result = await deviceApi.getAll();
            setDevices(result.data || []);
            setUnregisteredDevices(result.unregistered || []);
        } catch (err) {
            console.error('[useDeviceManager] fetchDevices error:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, []);

    // ─── CREATE ─────────────────────────────────────────────────────────────

    const createDevice = useCallback(async (payload) => {
        const result = await deviceApi.create(payload);
        // Optimistically add to local state immediately
        setDevices((prev) => [result.data, ...prev]);
        return result;
    }, []);

    // ─── UPDATE ─────────────────────────────────────────────────────────────

    const updateDevice = useCallback(async (id, payload) => {
        const result = await deviceApi.update(id, payload);
        // Patch the matching item in local state
        setDevices((prev) =>
            prev.map((d) => (d.deviceId === id ? { ...d, ...result.data } : d))
        );
        return result;
    }, []);

    // ─── DELETE ─────────────────────────────────────────────────────────────

    const deleteDevice = useCallback(async (id) => {
        const result = await deviceApi.delete(id);
        // Remove from local state
        setDevices((prev) => prev.filter((d) => d.deviceId !== id));
        return result;
    }, []);

    // ─── REAL-TIME POSITION UPDATE (from IoT MQTT) ──────────────────────────

    const updateDevicePosition = useCallback((positionUpdate) => {
        setDevices((prev) => applyRealtimeEventToDevices(prev, {
            version: 1,
            eventId: `legacy-position-${positionUpdate.deviceId}-${positionUpdate.sampleTime || Date.now()}`,
            type: 'device.position.updated',
            timestamp: Date.now(),
            userId: 'legacy-web-bridge',
            deviceId: positionUpdate.deviceId,
            payload: {
                position: positionUpdate.position,
                sampleTime: positionUpdate.sampleTime,
                isOnline: true,
                positionProperties: positionUpdate.positionProperties,
            },
        }));
    }, []);

    const applyRealtimeEvent = useCallback((event) => {
        const decision = shouldProcessRealtimeEvent(realtimeTrackerRef.current, event);
        if (!decision.accept) {
            return false;
        }

        setDevices((prev) => applyRealtimeEventToDevices(prev, event));
        return true;
    }, []);

    return {
        devices,
        unregisteredDevices,
        loading,
        error,
        fetchDevices,
        createDevice,
        updateDevice,
        deleteDevice,
        updateDevicePosition,
        applyRealtimeEvent,
    };
};
