const REALTIME_EVENT_TYPES = {
    DEVICE_POSITION_UPDATED: 'device.position.updated',
    DEVICE_ONLINE: 'device.online',
    DEVICE_OFFLINE: 'device.offline',
    GEOFENCE_ENTER: 'geofence.enter',
    GEOFENCE_EXIT: 'geofence.exit',
    ANTITHEFT_BREACH: 'antitheft.breach',
    DEVICE_SNAPSHOT_SYNC: 'device.snapshot.sync',
};

const APP_EVENTS_TOPIC_TEMPLATE = 'users/{userId}/events';
const RAW_TELEMETRY_TOPIC_TEMPLATE = 'devices/{deviceId}/telemetry';
const DEBUG_DEVICE_EVENTS_TOPIC_TEMPLATE = 'devices/{deviceId}/events';
const REALTIME_SCHEMA_VERSION = 1;
const SAMPLE_USER_ID = 'user-123';
const SAMPLE_DEVICE_ID = 'car-001';

const buildUserEventsTopic = (userId) =>
    APP_EVENTS_TOPIC_TEMPLATE.replace('{userId}', userId);

const buildRawTelemetryTopic = (deviceId) =>
    RAW_TELEMETRY_TOPIC_TEMPLATE.replace('{deviceId}', deviceId);

const buildDeviceEventsTopic = (deviceId) =>
    DEBUG_DEVICE_EVENTS_TOPIC_TEMPLATE.replace('{deviceId}', deviceId);

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

const createRealtimeEvent = ({
    type,
    userId,
    deviceId,
    payload = {},
    eventId,
    timestamp = Date.now(),
    version = REALTIME_SCHEMA_VERSION,
}) => {
    const event = {
        version,
        eventId: eventId || `evt-${type}-${deviceId}-${timestamp}`,
        type,
        timestamp,
        userId,
        deviceId,
        payload,
    };

    const validation = validateRealtimeEnvelope(event);
    if (!validation.valid) {
        throw new Error(`Invalid realtime event: ${validation.reason}`);
    }

    return event;
};

const validateRealtimeEnvelope = (event) => {
    if (!isObject(event)) {
        return { valid: false, reason: 'Event must be an object' };
    }

    const requiredFields = ['version', 'eventId', 'type', 'timestamp', 'userId', 'deviceId', 'payload'];
    for (const field of requiredFields) {
        if (event[field] === undefined || event[field] === null || event[field] === '') {
            return { valid: false, reason: `Missing required field: ${field}` };
        }
    }

    if (!Object.values(REALTIME_EVENT_TYPES).includes(event.type)) {
        return { valid: false, reason: `Unsupported event type: ${event.type}` };
    }

    if (!Number.isFinite(Number(event.timestamp))) {
        return { valid: false, reason: 'timestamp must be a finite number' };
    }

    if (!isObject(event.payload)) {
        return { valid: false, reason: 'payload must be an object' };
    }

    return { valid: true };
};

const SAMPLE_REALTIME_EVENTS = {
    positionUpdated: createRealtimeEvent({
        type: REALTIME_EVENT_TYPES.DEVICE_POSITION_UPDATED,
        userId: SAMPLE_USER_ID,
        deviceId: SAMPLE_DEVICE_ID,
        eventId: 'evt-pos-001',
        timestamp: 1714280000000,
        payload: {
            displayName: 'My Car',
            type: 'car',
            position: [105.8048, 21.0285],
            sampleTime: '2026-04-28T07:00:00.000Z',
            isOnline: true,
            antitheftEnabled: true,
        },
    }),
    deviceOnline: createRealtimeEvent({
        type: REALTIME_EVENT_TYPES.DEVICE_ONLINE,
        userId: SAMPLE_USER_ID,
        deviceId: SAMPLE_DEVICE_ID,
        eventId: 'evt-online-001',
        timestamp: 1714280010000,
        payload: { displayName: 'My Car' },
    }),
    deviceOffline: createRealtimeEvent({
        type: REALTIME_EVENT_TYPES.DEVICE_OFFLINE,
        userId: SAMPLE_USER_ID,
        deviceId: SAMPLE_DEVICE_ID,
        eventId: 'evt-offline-001',
        timestamp: 1714280050000,
        payload: {
            displayName: 'My Car',
            lastSeenAt: '2026-04-28T07:00:50.000Z',
        },
    }),
    geofenceEnter: createRealtimeEvent({
        type: REALTIME_EVENT_TYPES.GEOFENCE_ENTER,
        userId: SAMPLE_USER_ID,
        deviceId: SAMPLE_DEVICE_ID,
        eventId: 'evt-gf-enter-001',
        timestamp: 1714280100000,
        payload: {
            displayName: 'My Car',
            geofenceId: 'home-zone',
            position: [105.8051, 21.0289],
        },
    }),
    geofenceExit: createRealtimeEvent({
        type: REALTIME_EVENT_TYPES.GEOFENCE_EXIT,
        userId: SAMPLE_USER_ID,
        deviceId: SAMPLE_DEVICE_ID,
        eventId: 'evt-gf-exit-001',
        timestamp: 1714280110000,
        payload: {
            displayName: 'My Car',
            geofenceId: 'home-zone',
            position: [105.8071, 21.0312],
        },
    }),
    antitheftBreach: createRealtimeEvent({
        type: REALTIME_EVENT_TYPES.ANTITHEFT_BREACH,
        userId: SAMPLE_USER_ID,
        deviceId: SAMPLE_DEVICE_ID,
        eventId: 'evt-at-001',
        timestamp: 1714280120000,
        payload: {
            displayName: 'My Car',
            message: 'Moved outside safe zone while anti-theft is enabled',
        },
    }),
    deviceSnapshotSync: createRealtimeEvent({
        type: REALTIME_EVENT_TYPES.DEVICE_SNAPSHOT_SYNC,
        userId: SAMPLE_USER_ID,
        deviceId: '_snapshot',
        eventId: 'evt-sync-001',
        timestamp: 1714280130000,
        payload: {
            devices: [
                {
                    deviceId: SAMPLE_DEVICE_ID,
                    displayName: 'My Car',
                    type: 'car',
                    position: [105.8048, 21.0285],
                    isOnline: true,
                    antitheftEnabled: true,
                },
            ],
        },
    }),
};

module.exports = {
    REALTIME_SCHEMA_VERSION,
    REALTIME_EVENT_TYPES,
    APP_EVENTS_TOPIC_TEMPLATE,
    RAW_TELEMETRY_TOPIC_TEMPLATE,
    DEBUG_DEVICE_EVENTS_TOPIC_TEMPLATE,
    buildUserEventsTopic,
    buildRawTelemetryTopic,
    buildDeviceEventsTopic,
    createRealtimeEvent,
    SAMPLE_REALTIME_EVENTS,
    validateRealtimeEnvelope,
};
