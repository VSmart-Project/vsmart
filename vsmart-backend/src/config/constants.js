module.exports = {
    DYNAMODB_DEVICES_TABLE: process.env.DYNAMODB_DEVICES_TABLE || 'Vsmart-Devices',
    LOCATION_TRACKER_NAME: process.env.LOCATION_TRACKER_NAME || 'Vsmart-Tracker',
    GEOFENCE: process.env.LOCATION_GEOFENCE_COLLECTION || 'Vsmart-GeofenceCollection',

    // Allowed device types
    DEVICE_TYPES: ['truck', 'car', 'motorbike', 'van', 'bus', 'other'],

    // Allowed device statuses
    DEVICE_STATUSES: ['active', 'inactive', 'maintenance'],

    // Local OSRM instance for road-snapping (map matching). Optional — leave
    // unset to disable the feature entirely and fall back to raw positions.
    OSRM_URL: process.env.OSRM_URL || '',
    OSRM_TIMEOUT_MS: Number(process.env.OSRM_TIMEOUT_MS) || 800,
};
