const dynamoService = require('../services/dynamoService');
const locationService = require('../services/locationService');
const { generateCirclePolygon } = require('../services/geoUtils');
const { PutGeofenceCommand, BatchDeleteGeofenceCommand } = require('@aws-sdk/client-location');
const { locationClient } = require('../config/aws');
const { LOCATION_TRACKER_NAME } = require('../config/constants');
const { GEOFENCE } = require('../config/constants');

const ANTITHEFT_GEOFENCE_PREFIX = 'AntiTheft-';
const ANTITHEFT_RADIUS_M = 10; // 10 metres to avoid GPS drift false alarms

// ─── ENABLE ───────────────────────────────────────────────────────────────

/**
 * POST /api/antitheft/:deviceId/enable
 * 1. Verify device exists
 * 2. Get current position
 * 3. Create 2m geofence in Location Service
 * 4. Persist anti-theft metadata in DynamoDB
 */
const enableAntitheft = async (req, res, next) => {
    try {
        const { deviceId } = req.params;

        // Verify device is registered
        const device = await dynamoService.getDeviceById(deviceId);
        if (!device) {
            return res.status(404).json({ success: false, message: `Device "${deviceId}" not found` });
        }

        // Verify ownership
        const ownerUserId = req.user?.sub || req.user?.username || req.user?.email || null;
        if (device.ownerUserId !== ownerUserId) {
            return res.status(403).json({ success: false, message: 'Forbidden: You do not own this device' });
        }

        // Current position from Location Service
        const positions = await locationService.getDevicePositions();
        const posMap = locationService.buildPositionMap(positions);
        const pos = posMap[deviceId];

        if (!pos?.position) {
            return res.status(400).json({
                success: false,
                message: 'Device has no position data yet. Send a position update first, then retry.',
            });
        }

        const [currentLng, currentLat] = pos.position;

        // Build 2m circle polygon (counter-clockwise)
        const polygon = generateCirclePolygon(currentLng, currentLat, ANTITHEFT_RADIUS_M);

        // Create geofence in Location Service
        const geofenceId = `${ANTITHEFT_GEOFENCE_PREFIX}${deviceId}`;
        try {
            await locationClient.send(
                new PutGeofenceCommand({
                    CollectionName: GEOFENCE,
                    GeofenceId: geofenceId,
                    Geometry: { Polygon: [polygon] },
                    GeofenceProperties: { ownerUserId },
                })
            );
        } catch (err) {
            if (err.name !== 'ConflictException') throw err;
            // Geofence already exists — update it (PUT is idempotent in Location Service)
        }

        // Persist anti-theft fields in DynamoDB
        await dynamoService.enableAntitheftForDevice(deviceId, {
            antitheftLat: currentLat,
            antitheftLng: currentLng,
            antitheftRadius: ANTITHEFT_RADIUS_M,
        });

        return res.json({
            success: true,
            message: `Anti-theft enabled for "${deviceId}". Geofence set at current position (radius: ${ANTITHEFT_RADIUS_M}m).`,
            data: {
                geofenceId,
                centerLat: currentLat,
                centerLng: currentLng,
                radiusM: ANTITHEFT_RADIUS_M,
            },
        });
    } catch (err) {
        next(err);
    }
};

// ─── DISABLE ──────────────────────────────────────────────────────────────

/**
 * POST /api/antitheft/:deviceId/disable
 * 1. Delete the anti-theft geofence from Location Service
 * 2. Clear anti-theft fields in DynamoDB
 */
const disableAntitheft = async (req, res, next) => {
    try {
        const { deviceId } = req.params;

        // Verify device exists
        const device = await dynamoService.getDeviceById(deviceId);
        if (!device) {
            return res.status(404).json({ success: false, message: `Device "${deviceId}" not found` });
        }

        // Verify ownership
        const ownerUserId = req.user?.sub || req.user?.username || req.user?.email || null;
        if (device.ownerUserId !== ownerUserId) {
            return res.status(403).json({ success: false, message: 'Forbidden: You do not own this device' });
        }

        // Delete geofence (ignore if already gone)
        const geofenceId = `${ANTITHEFT_GEOFENCE_PREFIX}${deviceId}`;
        try {
            await locationClient.send(
                new BatchDeleteGeofenceCommand({
                    CollectionName: GEOFENCE,
                    GeofenceIds: [geofenceId],
                })
            );
        } catch (err) {
            if (err.name !== 'ResourceNotFoundException') throw err;
        }

        // Clear DynamoDB anti-theft fields
        await dynamoService.disableAntitheftForDevice(deviceId);

        return res.json({
            success: true,
            message: `Anti-theft disabled for "${deviceId}". Geofence removed.`,
        });
    } catch (err) {
        next(err);
    }
};

module.exports = { enableAntitheft, disableAntitheft };
