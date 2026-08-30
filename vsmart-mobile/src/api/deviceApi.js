import { BACKEND_URL } from '../configuration';
import { getCurrentSession } from '../utils/cognitoAuth';

const apiFetch = async (path, options = {}) => {
    let token = '';
    try {
        const session = await getCurrentSession();
        token = session.idToken;
    } catch (_e) { }

    const url = `${BACKEND_URL}${path}`;
    const response = await fetch(url, {
        headers: {
            'Content-Type': 'application/json',
            ...(token && { 'Authorization': `Bearer ${token}` }),
            ...options.headers,
        },
        ...options,
    });

    const data = await response.json();
    if (!response.ok) {
        const error = new Error(data.message || `HTTP Error ${response.status}`);
        error.status = response.status;
        throw error;
    }
    return data;
};

export const deviceApi = {
    getAll: () => apiFetch('/api/devices'),
    getById: (id) => apiFetch(`/api/devices/${encodeURIComponent(id)}`),
    getHistory: (id, startTime, endTime, { matched } = {}) => {
        const params = new URLSearchParams();
        if (startTime) params.append('startTime', startTime);
        if (endTime) params.append('endTime', endTime);
        if (matched) params.append('matched', 'true');
        const q = params.toString() ? `?${params}` : '';
        return apiFetch(`/api/devices/${encodeURIComponent(id)}/history${q}`);
    },
    create: (payload) =>
        apiFetch('/api/devices', { method: 'POST', body: JSON.stringify(payload) }),
    update: (id, payload) =>
        apiFetch(`/api/devices/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(payload) }),
    delete: (id) =>
        apiFetch(`/api/devices/${encodeURIComponent(id)}`, { method: 'DELETE' }),
};

export const antitheftApi = {
    enable: (deviceId) =>
        apiFetch(`/api/antitheft/${encodeURIComponent(deviceId)}/enable`, { method: 'POST' }),
    disable: (deviceId) =>
        apiFetch(`/api/antitheft/${encodeURIComponent(deviceId)}/disable`, { method: 'POST' }),
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
