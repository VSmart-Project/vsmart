const test = require('node:test');
const assert = require('node:assert/strict');

const { createPositionEnricher, bearingDeg } = require('../src/services/positionEnrichment');

const posEvent = (deviceId, position, extra = {}) => ({
    version: 1,
    eventId: `evt-${deviceId}-${position.join(',')}`,
    type: 'device.position.updated',
    timestamp: 1_700_000_000_000,
    userId: 'owner-1',
    deviceId,
    payload: { position, ...extra },
});

test('enrichRaw stamps serverTs and an incrementing per-device fixSeq', () => {
    let clock = 1000;
    const e = createPositionEnricher({ now: () => clock });

    const a1 = e.enrichRaw(posEvent('dev-a', [106.0, 10.0]));
    clock = 2000;
    const a2 = e.enrichRaw(posEvent('dev-a', [106.001, 10.0]));
    const b1 = e.enrichRaw(posEvent('dev-b', [105.0, 21.0]));

    assert.equal(a1.payload.fixSeq, 1);
    assert.equal(a2.payload.fixSeq, 2);
    assert.equal(b1.payload.fixSeq, 1, 'fixSeq is per-device');
    assert.equal(a1.payload.serverTs, 1000);
    assert.equal(a2.payload.serverTs, 2000);
});

test('enrichRaw derives heading from the previous position when the device sends none', () => {
    const e = createPositionEnricher();
    e.enrichRaw(posEvent('dev-a', [106.0, 10.0]));           // no prior -> no heading
    const second = e.enrichRaw(posEvent('dev-a', [106.0, 10.001])); // moved due north

    const hdg = Number(second.payload.positionProperties.heading);
    assert.ok(Math.abs(hdg - 0) < 2 || Math.abs(hdg - 360) < 2, `expected ~0 (north), got ${hdg}`);
});

test('enrichRaw keeps a heading the device already provided', () => {
    const e = createPositionEnricher();
    e.enrichRaw(posEvent('dev-a', [106.0, 10.0]));
    const second = e.enrichRaw(
        posEvent('dev-a', [106.0, 10.001], { positionProperties: { heading: '123', speed: '40' } })
    );
    assert.equal(second.payload.positionProperties.heading, '123');
    assert.equal(second.payload.positionProperties.speed, '40');
});

test('enrichCorrection reuses the current fixSeq, flags correction, carries a path', () => {
    const e = createPositionEnricher();
    const raw = e.enrichRaw(posEvent('dev-a', [106.0, 10.0]));
    e.enrichRaw(posEvent('dev-a', [106.001, 10.0])); // fixSeq now 2

    const path = [[106.0, 10.0], [106.0005, 10.0], [106.001, 10.00005]];
    const corrected = e.enrichCorrection({
        ...posEvent('dev-a', [106.0011, 10.00005]),
        eventId: 'evt-x-snapped',
    }, path);

    assert.equal(corrected.payload.fixSeq, 2, 'shares the fixSeq of the latest raw fix');
    assert.equal(corrected.payload.correction, true);
    assert.equal(typeof corrected.payload.serverTs, 'number');
    assert.deepEqual(corrected.payload.pathFromPrev, path);
    assert.notEqual(raw.payload.fixSeq, undefined);

    // no pathFromPrev key when none supplied
    const bare = e.enrichCorrection({ ...posEvent('dev-a', [106.0012, 10.0]), eventId: 'e2' });
    assert.equal('pathFromPrev' in bare.payload, false);
});

test('peekPrevPos returns the position one fix back', () => {
    const e = createPositionEnricher();
    assert.equal(e.peekPrevPos('dev-a'), null);
    e.enrichRaw(posEvent('dev-a', [106.0, 10.0]));
    assert.equal(e.peekPrevPos('dev-a'), null, 'still null after the first fix');
    e.enrichRaw(posEvent('dev-a', [106.001, 10.0]));
    assert.deepEqual(e.peekPrevPos('dev-a'), { lng: 106.0, lat: 10.0 });
    e.enrichRaw(posEvent('dev-a', [106.002, 10.0]));
    assert.deepEqual(e.peekPrevPos('dev-a'), { lng: 106.001, lat: 10.0 });
});

test('enrichRaw does not mutate the input event', () => {
    const e = createPositionEnricher();
    const input = posEvent('dev-a', [106.0, 10.0]);
    const snapshot = JSON.stringify(input);
    e.enrichRaw(input);
    assert.equal(JSON.stringify(input), snapshot);
});

test('bearingDeg cardinal directions', () => {
    assert.ok(Math.abs(bearingDeg(10, 106, 11, 106)) < 1);            // north
    assert.ok(Math.abs(bearingDeg(10, 106, 10, 107) - 90) < 1);      // east
    assert.ok(Math.abs(bearingDeg(10, 106, 9, 106) - 180) < 1);      // south
});
