const {
    BatchDeleteDevicePositionHistoryCommand,
    paginateGetDevicePositionHistory,
    paginateListDevicePositions,
} = require('@aws-sdk/client-location');
const { locationClient } = require('../config/aws');
const { LOCATION_TRACKER_NAME } = require('../config/constants');

/**
 * Location Service
 * Interacts with AWS Location Service Tracker to read real-time device positions.
 */

let cachedPositions = null;
let lastCacheTime = 0;
const CACHE_TTL_MS = 5000; // 5 seconds cache

/**
 * Retrieve current positions of all devices from the Tracker
 * @returns {Array} device position entries
 */
const getDevicePositions = async () => {
    const now = Date.now();
    if (cachedPositions && (now - lastCacheTime < CACHE_TTL_MS)) {
        return cachedPositions;
    }
    try {
        const entries = [];
        const paginator = paginateListDevicePositions({ client: locationClient }, {
            TrackerName: LOCATION_TRACKER_NAME,
        });
        for await (const page of paginator) {
            entries.push(...(page.Entries || []));
        }
        cachedPositions = entries;
        lastCacheTime = now;
        return cachedPositions;
    } catch (err) {
        console.error('[LocationService] Failed to list device positions:', err);
        return cachedPositions || []; // Fallback to cache if request fails
    }
};

/**
 * Delete all position history for a device from the Tracker
 * @param {string} deviceId
 */
const deleteDevicePositionHistory = async (deviceId) => {
    try {
        const command = new BatchDeleteDevicePositionHistoryCommand({
            TrackerName: LOCATION_TRACKER_NAME,
            DeviceIds: [deviceId],
        });
        await locationClient.send(command);
        console.log(`[LocationService] Deleted position history for device: ${deviceId}`);
    } catch (err) {
        // Non-fatal if the device never sent position data
        if (err.name === 'ResourceNotFoundException') {
            console.warn(`[LocationService] No position history found for device: ${deviceId}`);
            return;
        }
        console.error('[LocationService] Failed to delete position history:', err);
        throw err;
    }
};

/**
 * Convert a positions array into a Map keyed by deviceId
 * for fast lookups when merging with DynamoDB metadata.
 * @param {Array} positions
 * @returns {Object} { [deviceId]: { position, sampleTime, accuracy, positionProperties } }
 */
const buildPositionMap = (positions) => {
    const map = {};
    positions.forEach((p) => {
        const id = p.DeviceId || p.deviceId;
        if (id) {
            map[id] = {
                position: p.Position,
                sampleTime: p.SampleTime,
                accuracy: p.Accuracy,
                positionProperties: p.PositionProperties,
            };
        }
    });
    return map;
};

const getDevicePositionHistory = async (deviceId, startTimeInclusive, endTimeExclusive) => {
    try {
        const allPositions = [];
        const paginator = paginateGetDevicePositionHistory({ client: locationClient }, {
            TrackerName: LOCATION_TRACKER_NAME,
            DeviceId: deviceId,
            StartTimeInclusive: startTimeInclusive,
            EndTimeExclusive: endTimeExclusive,
        });
        for await (const page of paginator) {
            allPositions.push(...(page.DevicePositions || []));
        }

        return allPositions;
    } catch (err) {
        if (err.name === 'ResourceNotFoundException') {
            console.warn(`[LocationService] No history found for device: ${deviceId}`);
            return [];
        }
        console.error('[LocationService] Failed to get device position history:', err);
        throw err;
    }
};

module.exports = {
    getDevicePositions,
    deleteDevicePositionHistory,
    buildPositionMap,
    getDevicePositionHistory,
};
