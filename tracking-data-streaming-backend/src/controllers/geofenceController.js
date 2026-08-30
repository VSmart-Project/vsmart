const geofenceService = require('../services/geofenceService');

const getOwnerUserId = (req) => req.user?.sub || null;
const isValidGeofenceId = (value) => typeof value === 'string' && /^[a-zA-Z0-9_.:-]{1,100}$/.test(value);

const isCoordinate = (coordinate) => Array.isArray(coordinate)
    && coordinate.length === 2
    && Number.isFinite(coordinate[0])
    && Number.isFinite(coordinate[1])
    && coordinate[0] >= -180
    && coordinate[0] <= 180
    && coordinate[1] >= -90
    && coordinate[1] <= 90;

const isValidPolygon = (polygon) => Array.isArray(polygon)
    && polygon.length >= 4
    && polygon.length <= 1000
    && polygon.every(isCoordinate)
    && polygon[0][0] === polygon[polygon.length - 1][0]
    && polygon[0][1] === polygon[polygon.length - 1][1];

const listGeofences = async (req, res, next) => {
    try {
        const entries = await geofenceService.listGeofencesForOwner(getOwnerUserId(req));
        return res.json({ success: true, Entries: entries, total: entries.length });
    } catch (error) {
        return next(error);
    }
};

const putGeofence = async (req, res, next) => {
    try {
        const { geofenceId, polygon } = req.body || {};
        if (!isValidGeofenceId(geofenceId)) {
            return res.status(400).json({ success: false, message: 'Invalid geofenceId' });
        }
        if (!isValidPolygon(polygon)) {
            return res.status(400).json({
                success: false,
                message: 'polygon must be a closed array of 4 to 1000 valid [longitude, latitude] coordinates',
            });
        }

        const result = await geofenceService.putGeofenceForOwner(
            getOwnerUserId(req),
            geofenceId,
            { Polygon: [polygon] }
        );
        return res.status(result.CreateTime ? 201 : 200).json({ success: true, ...result });
    } catch (error) {
        return next(error);
    }
};

const deleteGeofences = async (req, res, next) => {
    try {
        const { geofenceIds } = req.body || {};
        if (!Array.isArray(geofenceIds) || !geofenceIds.length || geofenceIds.length > 100
            || !geofenceIds.every(isValidGeofenceId)) {
            return res.status(400).json({ success: false, message: 'geofenceIds must contain 1 to 100 valid IDs' });
        }
        const result = await geofenceService.deleteGeofencesForOwner(getOwnerUserId(req), geofenceIds);
        return res.json({ success: true, ...result });
    } catch (error) {
        return next(error);
    }
};

module.exports = {
    deleteGeofences,
    isValidGeofenceId,
    isValidPolygon,
    listGeofences,
    putGeofence,
};
