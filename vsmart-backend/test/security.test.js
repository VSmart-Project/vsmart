const test = require('node:test');
const assert = require('node:assert/strict');

const {
    isValidGeofenceId,
    isValidPolygon,
} = require('../src/controllers/geofenceController');
const {
    REALTIME_EVENT_TYPES,
    createRealtimeEvent,
    validateRealtimeEnvelope,
} = require('../src/config/realtimeEventSchema');

test('geofence IDs reject unsafe or oversized values', () => {
    assert.equal(isValidGeofenceId('home-zone:1'), true);
    assert.equal(isValidGeofenceId('../other-user'), false);
    assert.equal(isValidGeofenceId('x'.repeat(101)), false);
});

test('geofence polygons must be closed and within coordinate bounds', () => {
    const valid = [
        [105.8, 21.02],
        [105.81, 21.02],
        [105.81, 21.03],
        [105.8, 21.02],
    ];
    assert.equal(isValidPolygon(valid), true);
    assert.equal(isValidPolygon(valid.slice(0, -1)), false);
    assert.equal(isValidPolygon([[181, 0], [0, 0], [0, 1], [181, 0]]), false);
});

test('realtime envelopes reject unsupported or incomplete events', () => {
    const event = createRealtimeEvent({
        type: REALTIME_EVENT_TYPES.DEVICE_ONLINE,
        userId: 'user-1',
        deviceId: 'device-1',
    });
    assert.equal(validateRealtimeEnvelope(event).valid, true);
    assert.equal(validateRealtimeEnvelope({ ...event, type: 'room.join' }).valid, false);
    assert.equal(validateRealtimeEnvelope({ ...event, userId: '' }).valid, false);
});
