/**
 * node --test src/realtime/smoothFollow.test.js
 *
 * Drives the follower with a synthetic fix stream on a controlled clock and
 * asserts the interpolation / heading / anti-teleport behaviour.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createFollower, bearingDeg, metersBetween } from './smoothFollow.js';

function makeRig(opts) {
  let t = 0;
  const f = createFollower({ clock: () => t, ...opts });
  return {
    at: (ms) => { t = ms; },
    push: (lat, lon, meta) => f.pushFix(lat, lon, meta),
    sample: () => f.sample(),
    follower: f,
  };
}

test('single fix: sits still, not moving', () => {
  const r = makeRig();
  r.at(0);
  r.push(10.0, 106.0);
  const s = r.sample();
  assert.equal(s.moving, false);
  assert.equal(s.lat, 10.0);
  assert.equal(s.lon, 106.0);
});

test('straight line: renders one interval behind, monotonic, bounded overshoot', () => {
  const r = makeRig();
  // ~22 m per 1000 ms — under the speed clamp
  r.at(0);     r.push(10.0, 106.0000);
  r.at(1000);  r.push(10.0, 106.0002);
  r.at(2000);  r.push(10.0, 106.0004);

  // anchored to the newest fix: at t=2000 we are at the PREVIOUS fix
  r.at(2000);
  let s = r.sample();
  assert.ok(Math.abs(s.lon - 106.0002) < 1e-4, `expected ~106.0002, got ${s.lon}`);

  // walk toward the newest fix, monotonically
  let prev = -Infinity;
  for (let dt = 0; dt <= 1000; dt += 100) {
    r.at(2000 + dt);
    s = r.sample();
    assert.ok(s.lon >= prev - 1e-12, `lon went backwards at dt=${dt}`);
    prev = s.lon;
  }
  r.at(3000);
  s = r.sample();
  assert.ok(Math.abs(s.lon - 106.0004) < 1e-4, `expected to reach newest fix ~106.0004, got ${s.lon}`);

  // no new fix: never runs away — clamps a few metres past the newest fix
  r.at(60_000);
  s = r.sample();
  const past = metersBetween(10.0, 106.0004, s.lat, s.lon);
  assert.ok(past <= 20, `overshoot ${past.toFixed(1)} m exceeds the cap`);
  assert.equal(s.moving, false);
});

test('anti-teleport: an off-road outlier fix is glided to, never jumped', () => {
  const r = makeRig();
  r.at(0);     r.push(10.0000, 106.0000);
  r.at(1000);  r.push(10.0002, 106.0000);
  // outlier ~66 m sideways over 1 s (~66 m/s apparent — above the 45 m/s clamp,
  // below the 90 m/s teleport-reset): must be approached at clamped speed
  r.at(2000);  r.push(10.0002, 106.0006);

  r.at(2000);
  let prev = r.sample();
  for (let dt = 100; dt <= 2000; dt += 100) {
    r.at(2000 + dt);
    const s = r.sample();
    const step = metersBetween(prev.lat, prev.lon, s.lat, s.lon);
    assert.ok(step <= 5, `frame step ${step.toFixed(1)} m — marker teleported`);
    prev = s;
  }
});

test('90-degree turn: heading sweeps smoothly, no snap', () => {
  const r = makeRig();
  r.at(0);     r.push(10.0000, 106.0000);
  r.at(1000);  r.push(10.0002, 106.0000);   // north
  r.at(2000);  r.push(10.0002, 106.0002);   // then east

  r.at(2000);
  let prev = r.sample().heading;
  for (let dt = 50; dt <= 1500; dt += 50) {
    r.at(2000 + dt);
    const h = r.sample().heading;
    const step = Math.abs(((h - prev + 540) % 360) - 180);
    assert.ok(step < 30, `heading jumped ${step.toFixed(1)}° in one frame`);
    prev = h;
  }
});

test('road-path mode: marker walks the supplied polyline, not a straight line', () => {
  const r = makeRig();
  r.at(0);     r.push(10.00000, 106.00000);
  // an L-shaped "road" (~15 m legs) from the last fix to the new one, over 2 s
  r.at(2000);  r.push(10.00000, 106.00020, {
    path: [
      [106.00000, 10.00000],
      [106.00010, 10.00000],
      [106.00010, 10.00010],
      [106.00020, 10.00010],
    ],
  });
  // straight-line lat between the two fixes is 10.00000, but the road dips north
  r.at(3000); // frac ~0.5 → middle of the L, which is north of the straight line
  const s = r.sample();
  assert.ok(s.lat > 10.00002, `expected the marker on the road (lat > 10.00002), got ${s.lat}`);
});

test('road-snap correction (same seq): re-targets in place without a restart', () => {
  const r = makeRig();
  r.at(0);     r.push(10.0, 106.0000, { seq: 1 });
  r.at(1000);  r.push(10.0, 106.0002, { seq: 2 });
  r.at(1050);  r.push(10.00003, 106.00021, { seq: 2 }); // snapped correction of fix #2

  r.at(2000);
  const s = r.sample();
  assert.ok(Math.abs(s.lat - 10.00003) < 5e-4, `corrected lat not applied: ${s.lat}`);
});

test('identical heartbeat: no fabricated motion', () => {
  const r = makeRig();
  r.at(0);     r.push(10.0, 106.0);
  r.at(3000);  r.push(10.0, 106.0);
  assert.equal(r.sample().moving, false);
});

test('helpers: bearing and distance sanity', () => {
  assert.ok(Math.abs(bearingDeg(10, 106, 11, 106)) < 1);
  assert.ok(Math.abs(bearingDeg(10, 106, 10, 107) - 90) < 1);
  const d = metersBetween(10, 106, 10, 106.001);
  assert.ok(d > 100 && d < 120);
});
