const { OSRM_URL, OSRM_TIMEOUT_MS } = require('../config/constants');

/**
 * Map Matching Service
 * Snaps noisy GPS points onto the road network via a self-hosted OSRM instance.
 * Fully optional: when OSRM_URL is unset or OSRM is unreachable, every function
 * here resolves to null/no-op so callers can fall back to raw positions.
 */

const MAX_MATCH_CHUNK_SIZE = 100; // OSRM /match practical point-count limit per request
const SEGMENT_GAP_MS = 10 * 60 * 1000; // new drive segment after a 10min silence
const TELEPORT_KM = 10; // ...or a >10km jump within 5min (GPS drift/teleport)
const TELEPORT_WINDOW_MS = 5 * 60 * 1000;

// Prevents overlapping /nearest calls for the same device if position updates
// arrive faster than OSRM responds.
const inFlightSnaps = new Set();

const isEnabled = () => Boolean(OSRM_URL);

const getDistanceKm = ([lon1, lat1], [lon2, lat2]) => {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
};

const fetchJson = async (url, timeoutMs) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const res = await fetch(url, { signal: controller.signal });
        if (!res.ok) return null;
        return await res.json();
    } catch (err) {
        return null;
    } finally {
        clearTimeout(timer);
    }
};

/**
 * Snap a single live GPS point onto the nearest road.
 * @returns {Promise<{lat:number,lng:number}|null>}
 */
const snapToRoad = async (deviceId, lat, lng) => {
    if (!isEnabled() || inFlightSnaps.has(deviceId)) return null;

    inFlightSnaps.add(deviceId);
    try {
        const url = `${OSRM_URL}/nearest/v1/driving/${lng},${lat}`;
        const data = await fetchJson(url, OSRM_TIMEOUT_MS);
        const location = data?.waypoints?.[0]?.location;
        if (!Array.isArray(location) || location.length !== 2) return null;
        return { lat: location[1], lng: location[0] };
    } catch (err) {
        console.error(`[MapMatchingService] snapToRoad failed for ${deviceId}:`, err.message);
        return null;
    } finally {
        inFlightSnaps.delete(deviceId);
    }
};

/**
 * Road geometry between two consecutive live fixes, so the client can animate
 * the marker ALONG the road for that interval instead of cutting the corner.
 * Returns null (caller falls back to a straight/spline segment) when OSRM is
 * off, the points are a gap/teleport apart, or the road result looks wrong.
 * @param {{lng:number,lat:number}} from
 * @param {{lng:number,lat:number}} to
 * @returns {Promise<Array<[number,number]>|null>} [lng,lat] polyline
 */
const routeBetween = async (from, to) => {
    if (!isEnabled() || !from || !to) return null;
    const straightKm = getDistanceKm([from.lng, from.lat], [to.lng, to.lat]);
    if (straightKm < 0.003 || straightKm > 0.4) return null; // barely moved, or a gap

    const url = `${OSRM_URL}/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}`
        + `?overview=full&geometries=geojson&continue_straight=true`;
    const data = await fetchJson(url, OSRM_TIMEOUT_MS * 2);
    const route = data?.routes?.[0];
    const coords = route?.geometry?.coordinates;
    if (!Array.isArray(coords) || coords.length < 2) return null;

    // A detour far longer than the straight line means OSRM matched the wrong
    // road — a straight segment is safer than a wrong one.
    const routeKm = (route.distance || 0) / 1000;
    if (routeKm > straightKm * 3 + 0.1) return null;
    return coords;
};

/**
 * Split a chronological position history into continuous drive segments,
 * mirroring the frontend's teleport/gap filter (DeviceHistoryPathLayer.jsx)
 * so each OSRM /match call only ever sees one real, continuous trip.
 */
const splitIntoSegments = (points) => {
    const segments = [];
    let current = [];

    for (let i = 0; i < points.length; i++) {
        const pt = points[i];
        if (current.length === 0) {
            current.push(pt);
            continue;
        }

        const prev = points[i - 1];
        const timeMs = Math.abs(new Date(pt.sampleTime) - new Date(prev.sampleTime));
        const dist = getDistanceKm([prev.lng, prev.lat], [pt.lng, pt.lat]);
        const isTimeGap = timeMs > SEGMENT_GAP_MS;
        const isTeleport = dist > TELEPORT_KM && timeMs < TELEPORT_WINDOW_MS;

        if (isTimeGap || isTeleport) {
            if (current.length >= 2) segments.push(current);
            current = [pt];
        } else {
            current.push(pt);
        }
    }
    if (current.length >= 2) segments.push(current);
    return segments;
};

const chunkArray = (arr, size) => {
    const chunks = [];
    for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size));
    return chunks;
};

const matchChunk = async (chunk) => {
    const coords = chunk.map((p) => `${p.lng},${p.lat}`).join(';');
    const timestamps = chunk.map((p) => Math.round(new Date(p.sampleTime).getTime() / 1000)).join(';');
    const url = `${OSRM_URL}/match/v1/driving/${coords}?timestamps=${timestamps}&geometries=geojson&overview=full`;

    // Trace matching does more work than a single /nearest lookup; give it more room.
    const data = await fetchJson(url, OSRM_TIMEOUT_MS * 4);
    const matched = data?.matchings?.flatMap((m) => m.geometry?.coordinates || []);

    if (!matched || matched.length === 0) {
        // Fall back to this chunk's own raw coordinates so the line still draws.
        return chunk.map((p) => [p.lng, p.lat]);
    }
    return matched;
};

/**
 * Snap a device's raw position history onto the road network.
 * @param {Array<{Position:[number,number], SampleTime:string}>} positions - AWS Location Service history shape
 * @returns {Promise<Array<[number,number]>|null>} matched [lng,lat] path, or null if OSRM is disabled/unreachable
 */
const matchTrace = async (positions) => {
    if (!isEnabled() || !Array.isArray(positions)) return null;

    const points = positions
        .filter((p) => Array.isArray(p.Position) && p.Position.length === 2 && p.SampleTime)
        .map((p) => ({ lng: p.Position[0], lat: p.Position[1], sampleTime: p.SampleTime }));

    if (points.length < 2) return null;

    const segments = splitIntoSegments(points);
    if (segments.length === 0) return null;

    const path = [];
    for (const segment of segments) {
        for (const chunk of chunkArray(segment, MAX_MATCH_CHUNK_SIZE)) {
            if (chunk.length < 2) {
                path.push(...chunk.map((p) => [p.lng, p.lat]));
                continue;
            }
            path.push(...await matchChunk(chunk));
        }
    }
    return path;
};

module.exports = {
    isEnabled,
    snapToRoad,
    routeBetween,
    matchTrace,
};
