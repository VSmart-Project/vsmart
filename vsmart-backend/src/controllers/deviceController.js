const dynamoService = require('../services/dynamoService');
const locationService = require('../services/locationService');
const mapMatchingService = require('../services/mapMatchingService');
const { DEVICE_TYPES, DEVICE_STATUSES } = require('../config/constants');

const getOwnerUserIdFromRequest = (req) => {
    return req.user?.sub || req.user?.username || req.user?.email || null;
};


// ─── HELPERS ──────────────────────────────────────────────────────────────

/**
 * Validate deviceId:
 * - No dangerous special characters
 * - Maximum 64 characters
 */
const isValidDeviceId = (id) => {
    if (!id || typeof id !== 'string') return false;
    return /^[a-zA-Z0-9_\-:.]{1,64}$/.test(id);
};

const isValidOptionalText = (value, maximumLength) => value === undefined
    || (typeof value === 'string' && value.trim().length <= maximumLength);

const hasValidMetadata = ({ displayName, description } = {}) =>
    isValidOptionalText(displayName, 100) && isValidOptionalText(description, 1000);

// ─── GET ALL ──────────────────────────────────────────────────────────────

/**
 * GET /api/devices
 * Fetch all devices from DynamoDB, merged with real-time positions from Tracker
 */
const getAllDevices = async (req, res, next) => {
    try {
        const ownerUserId = getOwnerUserIdFromRequest(req);
        if (!ownerUserId) {
            return res.status(401).json({ success: false, message: 'Unauthorized: User ID not found' });
        }

        // Fetch in parallel for performance
        const [devices, positions] = await Promise.all([
            dynamoService.getAllDevicesByOwner(ownerUserId),
            locationService.getDevicePositions(),
        ]);

        const positionMap = locationService.buildPositionMap(positions);

        // Merge metadata (DynamoDB) + real-time position (Location Service)
        const merged = devices.map((device) => {
            const pos = positionMap[device.deviceId] || {};
            return {
                ...device,
                position: pos.position || null,
                sampleTime: pos.sampleTime || null,
                accuracy: pos.accuracy || null,
                positionProperties: pos.positionProperties || null,
                isOnline: !!pos.sampleTime,
            };
        });

        return res.json({
            success: true,
            data: merged,
            // Tracker entries without ownership metadata must never be exposed.
            unregistered: [],
            total: merged.length,
        });
    } catch (err) {
        next(err);
    }
};

// ─── GET ONE ──────────────────────────────────────────────────────────────

/**
 * GET /api/devices/:id
 * Fetch a single device with its current position
 */
const getDeviceById = async (req, res, next) => {
    try {
        const { id } = req.params;
        if (!isValidDeviceId(id)) {
            return res.status(400).json({ success: false, message: 'Invalid device ID' });
        }
        const device = await dynamoService.getDeviceById(id);

        if (!device) {
            return res.status(404).json({
                success: false,
                message: `Device "${id}" not found`,
            });
        }

        const ownerUserId = getOwnerUserIdFromRequest(req);
        if (device.ownerUserId !== ownerUserId) {
            return res.status(403).json({
                success: false,
                message: 'Forbidden: You do not own this device',
            });
        }

        const positions = await locationService.getDevicePositions();
        const positionMap = locationService.buildPositionMap(positions);
        const pos = positionMap[id] || {};

        return res.json({
            success: true,
            data: {
                ...device,
                position: pos.position || null,
                sampleTime: pos.sampleTime || null,
                accuracy: pos.accuracy || null,
                positionProperties: pos.positionProperties || null,
                isOnline: !!pos.sampleTime,
            },
        });
    } catch (err) {
        next(err);
    }
};

// ─── GET HISTORY ──────────────────────────────────────────────────────────

/**
 * GET /api/devices/:id/history
 * Fetch a device's historical positions
 * Query Params: startTime (ISO), endTime (ISO) - defaults to last 24 hours
 */
const getDeviceHistory = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { startTime, endTime, matched } = req.query;
        if (!isValidDeviceId(id)) {
            return res.status(400).json({ success: false, message: 'Invalid device ID' });
        }

        const device = await dynamoService.getDeviceById(id);
        if (!device) {
            return res.status(404).json({
                success: false,
                message: `Device "${id}" not found`,
            });
        }

        const ownerUserId = getOwnerUserIdFromRequest(req);
        if (device.ownerUserId !== ownerUserId) {
            return res.status(403).json({
                success: false,
                message: 'Forbidden: You do not own this device',
            });
        }

        const end = endTime ? new Date(endTime) : new Date();
        const start = startTime ? new Date(startTime) : new Date(end.getTime() - 72 * 60 * 60 * 1000); // Default to last 3 days (72 hours)
        const maximumRangeMs = 31 * 24 * 60 * 60 * 1000;
        if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime())
            || start >= end || end.getTime() - start.getTime() > maximumRangeMs) {
            return res.status(400).json({
                success: false,
                message: 'History range must be valid, ordered, and no longer than 31 days',
            });
        }

        const history = await locationService.getDevicePositionHistory(id, start, end);

        // Opt-in road-snapped path for the replay line. Existing callers that
        // don't pass ?matched=true keep getting exactly today's response shape.
        let matchedPath = null;
        if (matched === 'true' && mapMatchingService.isEnabled()) {
            matchedPath = await mapMatchingService.matchTrace(history);
        }

        return res.json({
            success: true,
            data: history,
            matchedPath,
        });
    } catch (err) {
        next(err);
    }
};

// ─── CREATE ───────────────────────────────────────────────────────────────

/**
 * POST /api/devices
 * Body: { deviceId, displayName, type, licensePlate, status, description }
 */
const createDevice = async (req, res, next) => {
    try {
        const { deviceId, displayName, type, status, description } = req.body;

        // Validation
        if (!deviceId) {
            return res.status(400).json({ success: false, message: 'deviceId is required' });
        }
        if (!isValidDeviceId(deviceId)) {
            return res.status(400).json({
                success: false,
                message: 'deviceId may only contain letters, numbers, and: _ - : . (max 64 characters)',
            });
        }
        if (!hasValidMetadata({ displayName, description })) {
            return res.status(400).json({
                success: false,
                message: 'displayName and description must be valid text within allowed lengths',
            });
        }
        if (type && !DEVICE_TYPES.includes(type)) {
            return res.status(400).json({
                success: false,
                message: `type must be one of: ${DEVICE_TYPES.join(', ')}`,
            });
        }
        if (status && !DEVICE_STATUSES.includes(status)) {
            return res.status(400).json({
                success: false,
                message: `status must be one of: ${DEVICE_STATUSES.join(', ')}`,
            });
        }

        const device = await dynamoService.createDevice({
            deviceId,
            displayName,
            type,
            status,
            description,
            ownerUserId: getOwnerUserIdFromRequest(req),
        });

        return res.status(201).json({
            success: true,
            message: `Device "${deviceId}" created successfully`,
            data: device,
        });
    } catch (err) {
        if (err.name === 'ConditionalCheckFailedException') {
            return res.status(409).json({
                success: false,
                message: `Device "${req.body.deviceId}" already exists`,
            });
        }
        next(err);
    }
};

// ─── UPDATE ───────────────────────────────────────────────────────────────

/**
 * PUT /api/devices/:id
 * Body: { displayName?, type?, licensePlate?, status?, description? }
 */
const updateDevice = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { type, status } = req.body;
        if (!isValidDeviceId(id) || !hasValidMetadata(req.body)) {
            return res.status(400).json({ success: false, message: 'Invalid device metadata' });
        }

        const device = await dynamoService.getDeviceById(id);
        if (!device) {
            return res.status(404).json({
                success: false,
                message: `Device "${id}" not found`,
            });
        }

        const ownerUserId = getOwnerUserIdFromRequest(req);
        if (device.ownerUserId !== ownerUserId) {
            return res.status(403).json({
                success: false,
                message: 'Forbidden: You do not own this device',
            });
        }

        if (type && !DEVICE_TYPES.includes(type)) {
            return res.status(400).json({
                success: false,
                message: `type must be one of: ${DEVICE_TYPES.join(', ')}`,
            });
        }
        if (status && !DEVICE_STATUSES.includes(status)) {
            return res.status(400).json({
                success: false,
                message: `status must be one of: ${DEVICE_STATUSES.join(', ')}`,
            });
        }

        const updated = await dynamoService.updateDevice(id, req.body);

        return res.json({
            success: true,
            message: `Device "${id}" updated successfully`,
            data: updated,
        });
    } catch (err) {
        if (err.name === 'ConditionalCheckFailedException') {
            return res.status(404).json({
                success: false,
                message: `Device "${req.params.id}" not found`,
            });
        }
        next(err);
    }
};

// ─── DELETE ───────────────────────────────────────────────────────────────

/**
 * DELETE /api/devices/:id
 * Removes from DynamoDB + deletes position history from Tracker
 */
const deleteDevice = async (req, res, next) => {
    try {
        const { id } = req.params;
        if (!isValidDeviceId(id)) {
            return res.status(400).json({ success: false, message: 'Invalid device ID' });
        }

        const device = await dynamoService.getDeviceById(id);
        if (!device) {
            return res.status(404).json({
                success: false,
                message: `Device "${id}" not found`,
            });
        }

        const ownerUserId = getOwnerUserIdFromRequest(req);
        if (device.ownerUserId !== ownerUserId) {
            return res.status(403).json({
                success: false,
                message: 'Forbidden: You do not own this device',
            });
        }

        // Keep metadata intact if deleting the external position history fails.
        await locationService.deleteDevicePositionHistory(id);
        const deletedDevice = await dynamoService.deleteDevice(id);

        return res.json({
            success: true,
            message: `Device "${id}" permanently deleted from the system`,
            data: deletedDevice,
        });
    } catch (err) {
        if (err.name === 'ConditionalCheckFailedException') {
            return res.status(404).json({
                success: false,
                message: `Device "${req.params.id}" not found`,
            });
        }
        next(err);
    }
};

module.exports = {
    getAllDevices,
    getDeviceById,
    getDeviceHistory,
    createDevice,
    updateDevice,
    deleteDevice,
};
