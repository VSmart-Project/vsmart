/**
 * node --test src/realtime/smoothFollow.test.js
 *
 * Drives the follower with a synthetic fix stream on a controlled clock and
 * asserts continuous, non-stuttering motion under realistic delivery jitter.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createFollower, bearingDeg, metersBetween } from './smoothFollow.js';

/** Play a fix stream, sample at 30 fps, return the position trace. */
function drive({ arrivalGaps, sampleDt = 3000, stepDeg = 0.00027, withSnap = false }) {
  let clk = 0;
  const f = createFollower({ clock: () => clk });
  const fixes = arrivalGaps.map((_, i) => ({
    lat: 10.8, lon: 106.7 + i * stepDeg, sampleMs: i * sampleDt,
  }));
  let arrival = 0;
  const trace = [];
  for (let i = 0; i < fixes.length; i++) {
    arrival += arrivalGaps[i];
    clk = arrival;
    f.pushFix(fixes[i].lat, fixes[i].lon, { seq: i, serverTs: arrival, sampleMs: fixes[i].sampleMs });
    if (withSnap) {
      clk = arrival + 300;
      f.pushFix(fixes[i].lat + 6e-6, fixes[i].lon + 4e-6, { seq: i, serverTs: arrival + 300, sampleMs: fixes[i].sampleMs });
    }
    const next = i + 1 < fixes.length ? arrival + arrivalGaps[i + 1] : arrival + sampleDt;
    for (let t = arrival; t < next; t += 33) {
      clk = t;
      const s = f.sample(t);
      if (s) trace.push({ t, ...s });
    }
  }
  return trace;
}

function speedStats(trace, fromT, toT) {
  const w = trace.filter((p) => p.t >= fromT && p.t <= toT);
  const spd = [];
  for (let i = 1; i < w.length; i++) {
    spd.push(metersBetween(w[i - 1].lat, w[i - 1].lon, w[i].lat, w[i].lon) / ((w[i].t - w[i - 1].t) / 1000));
  }
  const mean = spd.reduce((a, b) => a + b, 0) / spd.length;
  const std = Math.sqrt(spd.reduce((a, b) => a + (b - mean) ** 2, 0) / spd.length);
  let jerk = 0;
  for (let i = 1; i < spd.length; i++) jerk += Math.abs(spd[i] - spd[i - 1]);
  return { mean, std, cv: std / mean, jerk: jerk / spd.length, stalls: spd.filter((s) => s < 0.5).length, spd };
}

test('single fix: sits still', () => {
  let clk = 0;
  const f = createFollower({ clock: () => clk });
  f.pushFix(10, 106, { seq: 0, serverTs: 0, sampleMs: 0 });
  const s = f.sample(500);
  assert.equal(s.moving, false);
  assert.ok(Math.abs(s.lat - 10) < 1e-9 && Math.abs(s.lon - 106) < 1e-9);
});

test('mild delivery jitter: motion is smooth, never stalls', () => {
  const trace = drive({ arrivalGaps: [0, 3000, 2900, 3100, 3000, 3200, 2800, 3100, 3000, 3000, 3000], withSnap: true });
  const st = speedStats(trace, 4000, trace[trace.length - 1].t - 2000);
  assert.ok(st.cv < 0.30, `speed CV ${(st.cv * 100).toFixed(0)}% too high (stuttering)`);
  assert.ok(st.jerk < 1.0, `frame-to-frame jerk ${st.jerk.toFixed(2)} too high`);
  assert.equal(st.stalls, 0, `${st.stalls} mid-drive stalls`);
  assert.ok(st.mean > 6 && st.mean < 13, `mean speed ${st.mean.toFixed(1)} off (expected ~9.5)`);
});

test('rough jitter (±40%): still smooth, no stalls', () => {
  const trace = drive({ arrivalGaps: [0, 2600, 3400, 2500, 4200, 2700, 3600, 2400, 3800, 2900, 3300], withSnap: true });
  const st = speedStats(trace, 4000, trace[trace.length - 1].t - 2000);
  assert.ok(st.cv < 0.45, `speed CV ${(st.cv * 100).toFixed(0)}%`);
  assert.equal(st.stalls, 0);
});

test('cold-lambda gaps (6–7 s): coasts, no teleport, recovers', () => {
  const trace = drive({ arrivalGaps: [0, 3000, 3000, 6500, 3000, 7000, 3000, 3000], withSnap: true });
  // no single frame moves more than a highway-speed step
  let maxStep = 0;
  for (let i = 1; i < trace.length; i++) {
    maxStep = Math.max(maxStep, metersBetween(trace[i - 1].lat, trace[i - 1].lon, trace[i].lat, trace[i].lon));
  }
  assert.ok(maxStep < 45 * 0.033 + 0.5, `max frame step ${maxStep.toFixed(2)} m — teleport`);
});

test('never lurches backward along the drive', () => {
  const trace = drive({ arrivalGaps: [0, 2600, 3400, 2500, 4200, 2700, 3600, 2400], withSnap: true });
  let back = 0;
  for (let i = 1; i < trace.length; i++) {
    if (trace[i].lon < trace[i - 1].lon - 1e-9) back++;
  }
  assert.equal(back, 0, `${back} backward frames`);
});

test('road path: marker follows the supplied polyline', () => {
  let clk = 0;
  const f = createFollower({ clock: () => clk });
  f.pushFix(10.0, 106.0, { seq: 0, serverTs: 0, sampleMs: 0 });
  clk = 3000; f.pushFix(10.0, 106.0003, { seq: 1, serverTs: 3000, sampleMs: 3000 });
  clk = 6000;
  // straight-line fix would stay at lat 10.0; the road bulges north ~16 m
  f.pushFix(10.0, 106.0006, {
    seq: 2, serverTs: 6000, sampleMs: 6000,
    path: [[106.0003, 10.0], [106.00045, 10.00015], [106.0006, 10.0]],
  });
  let onBulge = false;
  for (let t = 6000; t < 9000; t += 100) {
    clk = t;
    if (f.sample(t).lat > 10.00006) onBulge = true;
  }
  assert.ok(onBulge, 'marker never rode the road bulge');
});

test('teleport (GPS glitch far away): snaps once, no long crawl', () => {
  let clk = 0;
  const f = createFollower({ clock: () => clk });
  f.pushFix(10.0, 106.0, { seq: 0, serverTs: 0, sampleMs: 0 });
  clk = 3000; f.pushFix(10.0, 106.0003, { seq: 1, serverTs: 3000, sampleMs: 3000 });
  clk = 6000; f.pushFix(10.5, 107.0, { seq: 2, serverTs: 6000, sampleMs: 6000 }); // ~150 km away
  const s = f.sample(6100);
  assert.ok(metersBetween(s.lat, s.lon, 10.5, 107.0) < 2000, 'did not snap to the teleport');
});

test('helpers: bearing + distance', () => {
  assert.ok(Math.abs(bearingDeg(10, 106, 11, 106)) < 1);
  assert.ok(Math.abs(bearingDeg(10, 106, 10, 107) - 90) < 1);
  const d = metersBetween(10, 106, 10, 106.001);
  assert.ok(d > 100 && d < 120);
});
