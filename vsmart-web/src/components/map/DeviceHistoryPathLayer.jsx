import { Source, Layer } from 'react-map-gl/maplibre';
import { useTheme } from '../../hooks/useTheme.js';

const historyLineLayout = { 'line-cap': 'round', 'line-join': 'round' };

// thin line, zoom-scaled; a contrasting casing underneath keeps it readable on
// both the light and the dark basemap.
const buildLineLayers = (isDark) => {
    const lineColor = isDark ? '#b9a8ff' : '#5b57d6';
    const casingColor = isDark ? '#0b0d14' : '#ffffff';
    const width = ['interpolate', ['linear'], ['zoom'], 11, 1.4, 15, 3, 18, 4];
    const casingWidth = ['interpolate', ['linear'], ['zoom'], 11, 3, 15, 5.5, 18, 7];
    return {
        casing: {
            id: 'device-history-casing',
            type: 'line',
            layout: historyLineLayout,
            paint: { 'line-color': casingColor, 'line-width': casingWidth, 'line-opacity': 0.55 },
        },
        line: {
            id: 'device-history-line',
            type: 'line',
            layout: historyLineLayout,
            paint: { 'line-color': lineColor, 'line-width': width, 'line-opacity': 0.95 },
        },
        points: {
            id: 'device-history-points',
            type: 'circle',
            paint: {
                'circle-radius': 3,
                'circle-color': casingColor,
                'circle-stroke-width': 2,
                'circle-stroke-color': lineColor,
            },
        },
    };
};

const getDistanceKm = (coords1, coords2) => {
    if (!coords1 || !coords2) return 0;
    const [lon1, lat1] = coords1;
    const [lon2, lat2] = coords2;
    const R = 6371; // Radius of the earth in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
        Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
};

export default function DeviceHistoryPathLayer({ deviceId, isVisible, history, matchedPath }) {
    const { theme } = useTheme();
    const layers = buildLineLayers(theme === 'dark');

    // We need at least 1 point to draw anything
    if (!history || history.length === 0 || !isVisible) {
        return null;
    }

    let lineSegments;
    if (Array.isArray(matchedPath) && matchedPath.length >= 2) {
        // Road-snapped path from the backend's local OSRM instance — already
        // one continuous, road-following line, no gap/teleport filtering needed.
        lineSegments = [matchedPath];
    } else {
        // Fallback: group raw history points into separate line segments to
        // prevent massive jumps/teleportation lines (used when OSRM isn't
        // configured/reachable).
        lineSegments = [];
        let currentSegment = [];

        for (let i = 0; i < history.length; i++) {
            const pt = history[i];
            if (currentSegment.length === 0) {
                currentSegment.push(pt.Position);
            } else {
                const lastPt = history[i - 1];
                const timeMs = Math.abs(new Date(pt.SampleTime) - new Date(lastPt.SampleTime));
                const dist = getDistanceKm(pt.Position, lastPt.Position);

                // Split line if gap is > 10 minutes or distance jump is > 10 km (teleportation/GPS drift)
                const isTimeGap = timeMs > 10 * 60 * 1000;
                const isTeleport = dist > 10 && timeMs < 5 * 60 * 1000;

                if (isTimeGap || isTeleport) {
                    if (currentSegment.length >= 2) {
                        lineSegments.push(currentSegment);
                    }
                    currentSegment = [pt.Position];
                } else {
                    currentSegment.push(pt.Position);
                }
            }
        }
        if (currentSegment.length >= 2) {
            lineSegments.push(currentSegment);
        }
    }

    const geojsonLine = {
        type: 'Feature',
        properties: {},
        geometry: {
            type: 'MultiLineString',
            coordinates: lineSegments,
        },
    };

    // Endpoints only (start/end of each drive segment) — a matched line does not
    // need every raw fix drawn on top of it, and the raw fallback stays legible.
    const endpointFeatures = lineSegments.flatMap((seg) =>
        seg.length
            ? [seg[0], seg[seg.length - 1]].map((coord) => ({
                type: 'Feature',
                properties: {},
                geometry: { type: 'Point', coordinates: coord },
            }))
            : []
    );
    const geojsonPoints = { type: 'FeatureCollection', features: endpointFeatures };

    return (
        <>
            {lineSegments.length > 0 && (
                <Source id={`history-line-source-${deviceId}`} type="geojson" data={geojsonLine}>
                    <Layer {...layers.casing} id={`history-casing-layer-${deviceId}`} />
                    <Layer {...layers.line} id={`history-line-layer-${deviceId}`} />
                </Source>
            )}
            <Source id={`history-points-source-${deviceId}`} type="geojson" data={geojsonPoints}>
                <Layer {...layers.points} id={`history-points-layer-${deviceId}`} />
            </Source>
        </>
    );
}
