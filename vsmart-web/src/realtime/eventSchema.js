export const REALTIME_SCHEMA_VERSION = 1;

export const REALTIME_EVENT_TYPES = {
  DEVICE_POSITION_UPDATED: 'device.position.updated',
  DEVICE_ONLINE: 'device.online',
  DEVICE_OFFLINE: 'device.offline',
  GEOFENCE_ENTER: 'geofence.enter',
  GEOFENCE_EXIT: 'geofence.exit',
  ANTITHEFT_BREACH: 'antitheft.breach',
  DEVICE_SNAPSHOT_SYNC: 'device.snapshot.sync',
};

const EVENT_ID_CACHE_LIMIT = 200;
const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

export function validateRealtimeEventEnvelope(event) {
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
}

export function createRealtimeEventTracker() {
  return {
    seenEventIds: new Set(),
    lastTimestampByDeviceId: new Map(),
  };
}

export function shouldProcessRealtimeEvent(tracker, event) {
  const validation = validateRealtimeEventEnvelope(event);
  if (!validation.valid) {
    return { accept: false, reason: validation.reason };
  }

  if (tracker.seenEventIds.has(event.eventId)) {
    return { accept: false, reason: 'Duplicate eventId' };
  }

  const lastTimestamp = tracker.lastTimestampByDeviceId.get(event.deviceId) || 0;
  if (
    event.type === REALTIME_EVENT_TYPES.DEVICE_POSITION_UPDATED &&
    Number(event.timestamp) < lastTimestamp
  ) {
    return { accept: false, reason: 'Out-of-order device position event' };
  }

  tracker.seenEventIds.add(event.eventId);
  if (tracker.seenEventIds.size > EVENT_ID_CACHE_LIMIT) {
    const oldestEventId = tracker.seenEventIds.values().next().value;
    tracker.seenEventIds.delete(oldestEventId);
  }

  tracker.lastTimestampByDeviceId.set(
    event.deviceId,
    Math.max(lastTimestamp, Number(event.timestamp))
  );

  return { accept: true };
}

function upsertDevice(list, nextDevice) {
  const idx = list.findIndex((item) => item.deviceId === nextDevice.deviceId);
  if (idx === -1) return [nextDevice, ...list];

  const clone = [...list];
  clone[idx] = { ...clone[idx], ...nextDevice };
  return clone;
}

export function applyRealtimeEventToDevices(devices, event) {
  const validation = validateRealtimeEventEnvelope(event);
  if (!validation.valid) {
    return devices;
  }

  switch (event.type) {
    case REALTIME_EVENT_TYPES.DEVICE_POSITION_UPDATED: {
      const payload = event.payload || {};
      return upsertDevice(devices, {
        deviceId: event.deviceId,
        displayName: payload.displayName,
        type: payload.type,
        position: payload.position || null,
        sampleTime: payload.sampleTime || null,
        isOnline: payload.isOnline ?? true,
        antitheftEnabled: payload.antitheftEnabled,
        positionProperties: payload.positionProperties,
        // smoothing metadata (see realtime/smoothFollow.js)
        serverTs: payload.serverTs ?? null,
        fixSeq: payload.fixSeq ?? null,
        correction: payload.correction ?? false,
        pathFromPrev: payload.pathFromPrev ?? null,
      });
    }

    case REALTIME_EVENT_TYPES.DEVICE_ONLINE:
      return upsertDevice(devices, {
        deviceId: event.deviceId,
        displayName: event.payload?.displayName,
        isOnline: true,
      });

    case REALTIME_EVENT_TYPES.DEVICE_OFFLINE:
      return upsertDevice(devices, {
        deviceId: event.deviceId,
        displayName: event.payload?.displayName,
        isOnline: false,
      });

    case REALTIME_EVENT_TYPES.DEVICE_SNAPSHOT_SYNC: {
      const nextDevices = Array.isArray(event.payload?.devices) ? event.payload.devices : null;
      return nextDevices || devices;
    }

    default:
      return devices;
  }
}

export function getRealtimeNotificationDescriptor(event) {
  const validation = validateRealtimeEventEnvelope(event);
  if (!validation.valid) return null;

  switch (event.type) {
    case REALTIME_EVENT_TYPES.GEOFENCE_ENTER:
      return {
        level: 'info',
        title: 'ENTER detected',
        message: `${event.payload?.displayName || event.deviceId} entered ${event.payload?.geofenceId || 'a geofence'}`,
      };
    case REALTIME_EVENT_TYPES.GEOFENCE_EXIT:
      return {
        level: 'warning',
        title: 'EXIT detected',
        message: `${event.payload?.displayName || event.deviceId} left ${event.payload?.geofenceId || 'a geofence'}`,
      };
    case REALTIME_EVENT_TYPES.ANTITHEFT_BREACH:
      return {
        level: 'error',
        title: 'Anti-theft breach',
        message: event.payload?.message || `${event.payload?.displayName || event.deviceId} triggered anti-theft alert`,
      };
    case REALTIME_EVENT_TYPES.DEVICE_OFFLINE:
      return {
        level: 'warning',
        title: 'Device offline',
        message: `${event.payload?.displayName || event.deviceId} is offline`,
      };
    case REALTIME_EVENT_TYPES.DEVICE_ONLINE:
      return {
        level: 'success',
        title: 'Device online',
        message: `${event.payload?.displayName || event.deviceId} is back online`,
      };
    default:
      return null;
  }
}

export const REALTIME_EVENT_SAMPLES = {
  positionUpdated: {
    version: 1,
    eventId: 'evt-pos-001',
    type: REALTIME_EVENT_TYPES.DEVICE_POSITION_UPDATED,
    timestamp: 1714280000000,
    userId: 'user-123',
    deviceId: 'car-001',
    payload: {
      displayName: 'My Car',
      type: 'car',
      position: [105.8048, 21.0285],
      sampleTime: '2026-04-28T07:00:00.000Z',
      isOnline: true,
      antitheftEnabled: true,
    },
  },
  deviceOnline: {
    version: 1,
    eventId: 'evt-online-001',
    type: REALTIME_EVENT_TYPES.DEVICE_ONLINE,
    timestamp: 1714280010000,
    userId: 'user-123',
    deviceId: 'car-001',
    payload: {
      displayName: 'My Car',
    },
  },
  deviceOffline: {
    version: 1,
    eventId: 'evt-offline-001',
    type: REALTIME_EVENT_TYPES.DEVICE_OFFLINE,
    timestamp: 1714280050000,
    userId: 'user-123',
    deviceId: 'car-001',
    payload: {
      displayName: 'My Car',
      lastSeenAt: '2026-04-28T07:00:50.000Z',
    },
  },
  geofenceEnter: {
    version: 1,
    eventId: 'evt-gf-enter-001',
    type: REALTIME_EVENT_TYPES.GEOFENCE_ENTER,
    timestamp: 1714280100000,
    userId: 'user-123',
    deviceId: 'car-001',
    payload: {
      displayName: 'My Car',
      geofenceId: 'home-zone',
      position: [105.8051, 21.0289],
    },
  },
  geofenceExit: {
    version: 1,
    eventId: 'evt-gf-exit-001',
    type: REALTIME_EVENT_TYPES.GEOFENCE_EXIT,
    timestamp: 1714280110000,
    userId: 'user-123',
    deviceId: 'car-001',
    payload: {
      displayName: 'My Car',
      geofenceId: 'home-zone',
      position: [105.8071, 21.0312],
    },
  },
  antitheftBreach: {
    version: 1,
    eventId: 'evt-at-001',
    type: REALTIME_EVENT_TYPES.ANTITHEFT_BREACH,
    timestamp: 1714280120000,
    userId: 'user-123',
    deviceId: 'car-001',
    payload: {
      displayName: 'My Car',
      message: 'Moved outside safe zone while anti-theft is enabled',
    },
  },
  deviceSnapshotSync: {
    version: 1,
    eventId: 'evt-sync-001',
    type: REALTIME_EVENT_TYPES.DEVICE_SNAPSHOT_SYNC,
    timestamp: 1714280130000,
    userId: 'user-123',
    deviceId: '_snapshot',
    payload: {
      devices: [
        {
          deviceId: 'car-001',
          displayName: 'My Car',
          type: 'car',
          position: [105.8048, 21.0285],
          isOnline: true,
          antitheftEnabled: true,
        },
      ],
    },
  },
};
