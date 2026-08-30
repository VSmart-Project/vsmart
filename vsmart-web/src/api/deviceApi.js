import { BACKEND_URL } from '../configuration';
import { fetchAuthSession } from 'aws-amplify/auth';

const BASE_URL = BACKEND_URL;

const apiFetch = async (path, options = {}) => {
    // Tự động lấy JWT token hiện tại của AWS Cognito
    let token = '';
    try {
        const session = await fetchAuthSession();
        token = session.tokens?.idToken?.toString();
    } catch (err) {
        console.warn("Could not fetch auth session to attach token:", err);
    }

    const url = `${BASE_URL}${path}`;
    const config = {
        headers: {
            'Content-Type': 'application/json',
            ...(token && { 'Authorization': `Bearer ${token}` }),
            ...options.headers,
        },
        ...options,
    };

    const response = await fetch(url, config);
    const data = await response.json();

    if (!response.ok) {
        const error = new Error(data.message || `HTTP Error ${response.status}`);
        error.status = response.status;
        error.data = data;
        throw error;
    }

    return data;
};

// ─── DEVICE API ───────────────────────────────────────────────────────────

export const deviceApi = {
    /**
     * Fetch all devices (merged with real-time Tracker positions)
     */
    getAll: () => apiFetch('/api/devices'),

    /**
     * Fetch a single device by ID
     */
    getById: (id) => apiFetch(`/api/devices/${encodeURIComponent(id)}`),

    /**
     * Fetch a single device's position history.
     * Pass `{ matched: true }` to also request a road-snapped `matchedPath`
     * (only populated when the backend has a local OSRM instance configured;
     * otherwise `matchedPath` comes back null and callers should fall back
     * to drawing from the raw `data` array as before).
     */
    getHistory: (id, startTime, endTime, { matched } = {}) => {
        const queryParams = new URLSearchParams();
        if (startTime) queryParams.append('startTime', startTime);
        if (endTime) queryParams.append('endTime', endTime);
        if (matched) queryParams.append('matched', 'true');
        const q = queryParams.toString() ? `?${queryParams.toString()}` : '';
        return apiFetch(`/api/devices/${encodeURIComponent(id)}/history${q}`);
    },

    /**
     * Create a new device
     * @param {{ deviceId, displayName, type, licensePlate, status, description }} payload
     */
    create: (payload) =>
        apiFetch('/api/devices', {
            method: 'POST',
            body: JSON.stringify(payload),
        }),

    /**
     * Update device metadata
     * @param {string} id
     * @param {{ displayName?, type?, licensePlate?, status?, description? }} payload
     */
    update: (id, payload) =>
        apiFetch(`/api/devices/${encodeURIComponent(id)}`, {
            method: 'PUT',
            body: JSON.stringify(payload),
        }),

    /**
     * Delete a device (DynamoDB record + Tracker position history)
     * @param {string} id
     */
    delete: (id) =>
        apiFetch(`/api/devices/${encodeURIComponent(id)}`, {
            method: 'DELETE',
        }),
};

// ─── ANTI-THEFT API ───────────────────────────────────────────────────────

export const antitheftApi = {
    /**
     * Enable anti-theft mode for a device.
     * Creates a 2m geofence at the device's current position.
     */
    enable: (deviceId) =>
        apiFetch(`/api/antitheft/${encodeURIComponent(deviceId)}/enable`, {
            method: 'POST',
        }),

    /**
     * Disable anti-theft mode and remove the geofence.
     */
    disable: (deviceId) =>
        apiFetch(`/api/antitheft/${encodeURIComponent(deviceId)}/disable`, {
            method: 'POST',
        }),
};

export const geofenceApi = {
    list: () => apiFetch('/api/geofences'),
    put: (geofenceId, polygon) =>
        apiFetch(`/api/geofences/${encodeURIComponent(geofenceId)}`, {
            method: 'PUT',
            body: JSON.stringify({ polygon }),
        }),
    delete: (geofenceIds) =>
        apiFetch('/api/geofences', {
            method: 'DELETE',
            body: JSON.stringify({ geofenceIds }),
        }),
};

export default apiFetch;
