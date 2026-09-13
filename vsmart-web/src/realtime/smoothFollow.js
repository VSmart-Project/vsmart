/**
 * smoothFollow.js — Google-Maps-style position smoothing for live device markers.
 *
 * The device sends a sparse GPS fix every few seconds and delivery is jittery
 * (Lambda cold starts, Socket.io bursts, a road-snapped follow-up ~300 ms after
 * each raw fix). Rendering that raw stream makes the marker teleport / stutter.
 *
 * This follower is **playhead-based**: it keeps the marker's CURRENT displayed
 * position and, every animation frame, advances it along a target path at the
 * vehicle's real speed. Because every new fix rebuilds the target path *starting
 * from where the marker currently is*, the motion is always continuous — no
 * per-fix "snap" and no velocity discontinuity, however jittery the input.
 *
 *   - target path = the on-road polyline the backend supplies (`meta.path`,
 *     stitched to the current position) when available, else a straight line to
 *     the new fix.
 *   - pacing = distance / (GPS sample-time interval) — immune to pipeline jitter
 *     because it uses when the fix was TAKEN, not when it arrived.
 *   - heading = eased toward the path tangent so the icon turns like a car.
 *
 * NOTE: an identical copy lives at
 * vsmart-mobile/src/realtime/smoothFollow.js — keep the two in sync.
 */

export const SMOOTH_DEFAULTS = {
  HEADING_LP_ALPHA: 0.4,      // EMA on the raw fix-to-fix bearing (per fix)
  ROTATION_TAU_MS: 130,       // displayed-heading easing time constant
  ROTATION_SETTLE_DEG: 0.5,   // heading considered settled below this
  HEADING_DEADBAND_DEG: 4.0,  // ignore sub-wobble so the icon does not jitter
  STOP_DEADBAND_M: 1.2,       // once stopped, ignore drift smaller than this
  SPEED_TAU_MS: 450,          // how fast the shown speed eases toward the target
  COAST_M: 28,                // keep gliding this far past the last fix while the
                             //   next one is in flight (bridges delivery jitter)
  CATCHUP_MULT: 2.2,          // cap the eased speed at this × the segment pace so
                             //   a burst of fixes catches up without a lurch
  MAX_SPEED_MPS: 45,          // ~160 km/h hard ceiling (anti-teleport)
  MIN_SPEED_MPS: 0.3,         // below this the vehicle is treated as stopped
  RESET_JUMP_M: 400,          // a fix this far from the marker ⇒ teleport, jump once
  SEG_MIN_MS: 700,
  SEG_MAX_MS: 15000,
  STALE_MS: 12000,            // stop reporting "moving" after this much silence
};

const DEG = Math.PI / 180;
const EARTH_R = 6371000;

const clockNow = () =>
  (typeof performance !== 'undefined' && performance.now)
    ? performance.now()
    : Date.now();

function wrap360(d) {
  d %= 360;
  return d < 0 ? d + 360 : d;
}

/** signed shortest angular delta a -> b, in (-180, 180] */
function shortestDelta(a, b) {
  return ((((b - a) % 360) + 540) % 360) - 180;
}

export function bearingDeg(lat1, lon1, lat2, lon2) {
  const y = Math.sin((lon2 - lon1) * DEG) * Math.cos(lat2 * DEG);
  const x =
    Math.cos(lat1 * DEG) * Math.sin(lat2 * DEG) -
    Math.sin(lat1 * DEG) * Math.cos(lat2 * DEG) * Math.cos((lon2 - lon1) * DEG);
  return wrap360(Math.atan2(y, x) / DEG);
}

export function metersBetween(lat1, lon1, lat2, lon2) {
  const dLat = (lat2 - lat1) * DEG;
  const dLon = (lon2 - lon1) * DEG;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * DEG) * Math.cos(lat2 * DEG) * Math.sin(dLon / 2) ** 2;
  return EARTH_R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Measure a [lng,lat] polyline: cumulative distances + total length. */
function measurePath(coords) {
  const cum = [0];
  for (let i = 1; i < coords.length; i++) {
    cum.push(cum[i - 1] + metersBetween(coords[i - 1][1], coords[i - 1][0], coords[i][1], coords[i][0]));
  }
  return { coords, cum, len: cum[cum.length - 1] };
}

/** Point + heading `d` metres along a measured polyline (clamped at both ends). */
function alongPath(path, d) {
  const { coords, cum, len } = path;
  if (coords.length < 2) {
    return { lat: coords[0][1], lon: coords[0][0], hdg: null };
  }
  if (d <= 0) {
    return { lat: coords[0][1], lon: coords[0][0], hdg: bearingDeg(coords[0][1], coords[0][0], coords[1][1], coords[1][0]) };
  }
  if (d >= len) {
    const n = coords.length - 1;
    return { lat: coords[n][1], lon: coords[n][0], hdg: bearingDeg(coords[n - 1][1], coords[n - 1][0], coords[n][1], coords[n][0]) };
  }
  let i = 1;
  while (cum[i] < d) i++;
  const f = (d - cum[i - 1]) / (cum[i] - cum[i - 1] || 1);
  const [x1, y1] = coords[i - 1];
  const [x2, y2] = coords[i];
  return { lat: y1 + (y2 - y1) * f, lon: x1 + (x2 - x1) * f, hdg: bearingDeg(y1, x1, y2, x2) };
}

/**
 * @param {Partial<typeof SMOOTH_DEFAULTS> & { clock?: () => number }} [opts]
 */
export function createFollower(opts = {}) {
  const { clock, ...tuning } = opts;
  const C = { ...SMOOTH_DEFAULTS, ...tuning };
  const now = typeof clock === 'function' ? clock : clockNow;

  let out = null;        // { lat, lon } — the authoritative displayed position
  let smHdg = null;      // EMA of the raw fix-to-fix bearing
  let dispHdg = null;    // eased heading actually shown
  let lastSampleT = null;
  let curSpeed = 0;      // m/s the marker is CURRENTLY moving (eased, continuous)

  // active segment
  let seg = null;        // { path (measured), pace (m/s), playhead, seq, lastSampleMs }
  let lastFix = null;    // { lat, lon, sampleMs, tLocal } — newest fix received
  let lastArrivalT = null;
  let emaGapMs = null;   // EMA of how often fixes actually arrive (delivery cadence)

  function easeHeadingTo(rawHdg) {
    if (rawHdg == null) return;
    smHdg = smHdg == null ? rawHdg : wrap360(smHdg + shortestDelta(smHdg, rawHdg) * C.HEADING_LP_ALPHA);
  }

  /** Drop the part of a [lng,lat] polyline that lies behind `from`, so the
   *  stitched path only ever goes forward (no backward lurch). */
  function trimAhead(coords, from) {
    let bestI = 0;
    let bestT = 0;
    let bestD = Infinity;
    for (let i = 1; i < coords.length; i++) {
      const [x1, y1] = coords[i - 1];
      const [x2, y2] = coords[i];
      const vx = x2 - x1;
      const vy = y2 - y1;
      const len2 = vx * vx + vy * vy || 1e-12;
      let t = ((from.lon - x1) * vx + (from.lat - y1) * vy) / len2;
      if (t < 0) t = 0;
      else if (t > 1) t = 1;
      const d = metersBetween(from.lat, from.lon, y1 + vy * t, x1 + vx * t);
      if (d < bestD) { bestD = d; bestI = i; bestT = t; }
    }
    const [ax, ay] = coords[bestI - 1];
    const [bx, by] = coords[bestI];
    const split = [ax + (bx - ax) * bestT, ay + (by - ay) * bestT];
    return [[from.lon, from.lat], split, ...coords.slice(bestI)];
  }

  /** (Re)build the target path from the current marker position to `fix`, and
   *  set the pace (m/s) at which the marker should traverse it. */
  function retarget(fix, pathCoords, tNow, sampleMs, seq, extendMs) {
    const from = out || { lat: fix.lat, lon: fix.lon };
    let coords;
    if (Array.isArray(pathCoords) && pathCoords.length >= 2) {
      coords = trimAhead(pathCoords.map(([x, y]) => [x, y]), from);
    } else {
      const toFix = bearingDeg(from.lat, from.lon, fix.lat, fix.lon);
      const behind = dispHdg != null && Math.abs(shortestDelta(dispHdg, toFix)) > 120;
      coords = behind
        ? [[from.lon, from.lat], [from.lon, from.lat]]
        : [[from.lon, from.lat], [fix.lon, fix.lat]];
    }
    const path = measurePath(coords);

    // How long the marker should take to cover this path. The vehicle's real
    // travel time is the GPS sample-time interval; but pace it over the OBSERVED
    // delivery cadence (× margin) when that is longer, so the marker is still
    // gliding when the next (jittery) fix lands instead of stalling at the end.
    const prevSampleMs = seg && Number.isFinite(seg.lastSampleMs) ? seg.lastSampleMs : null;
    const sampleGap = Number.isFinite(sampleMs) && prevSampleMs != null ? sampleMs - prevSampleMs : null;
    const cadence = emaGapMs != null ? emaGapMs * 1.3 : null;
    let dur = Math.max(sampleGap || 0, cadence || 0)
      || (lastArrivalT != null ? tNow - lastArrivalT : C.SEG_MIN_MS);
    dur += (extendMs || 0);
    dur = Math.min(Math.max(dur, C.SEG_MIN_MS), C.SEG_MAX_MS);

    seg = {
      path,
      playhead: 0,
      pace: path.len / (dur / 1000),
      lastSampleMs: Number.isFinite(sampleMs) ? sampleMs : (prevSampleMs ?? null),
      seq: seq ?? null,
    };
  }


  /**
   * @param {number} lat
   * @param {number} lon
   * @param {{ serverTs?: number, sampleMs?: number, seq?: number|null, path?: Array<[number,number]> }} [meta]
   */
  function pushFix(lat, lon, meta = {}) {
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;
    const { sampleMs, seq = null, path } = meta;
    const tNow = now();

    // first fix ever
    if (!out) {
      out = { lat, lon };
      lastFix = { lat, lon, sampleMs: Number.isFinite(sampleMs) ? sampleMs : null, tLocal: tNow };
      lastArrivalT = tNow;
      seg = null;
      dispHdg = null;
      smHdg = null;
      return;
    }

    // road-snap / refinement of the fix we're already animating toward
    const isCorrection = seq != null && seg && seg.seq === seq;

    // teleport guard (GPS glitch / device jumped) — snap once
    const jump = metersBetween(out.lat, out.lon, lat, lon);
    if (!isCorrection && jump > C.RESET_JUMP_M) {
      out = { lat, lon };
      lastFix = { lat, lon, sampleMs: Number.isFinite(sampleMs) ? sampleMs : null, tLocal: tNow };
      lastArrivalT = tNow;
      seg = null;
      dispHdg = null;
      smHdg = null;
      return;
    }

    // heading target from the real fix-to-fix bearing
    if (lastFix && (lastFix.lat !== lat || lastFix.lon !== lon)) {
      easeHeadingTo(bearingDeg(lastFix.lat, lastFix.lon, lat, lon));
      if (dispHdg == null) dispHdg = smHdg;
    }

    if (isCorrection) {
      // small road-snap adjustment of the fix we're already heading to — retarget
      // in place, keep the current pace (extendMs 0 keeps the cadence-based dur).
      retarget({ lat, lon }, path, tNow, seg.lastSampleMs, seq, 0);
    } else {
      if (lastArrivalT != null) {
        const gap = tNow - lastArrivalT;
        if (gap > 300 && gap < 30000) {
          emaGapMs = emaGapMs == null ? gap : emaGapMs + (gap - emaGapMs) * 0.3;
        }
      }
      retarget({ lat, lon }, path, tNow, sampleMs, seq, 0);
      lastArrivalT = tNow;
    }
    lastFix = { lat, lon, sampleMs: Number.isFinite(sampleMs) ? sampleMs : (lastFix && lastFix.sampleMs), tLocal: tNow };
  }

  function sample(tNow = now()) {
    if (!out) return null;
    if (!seg) {
      return { lat: out.lat, lon: out.lon, heading: dispHdg ?? 0, moving: false, settled: true };
    }

    const dtMs = lastSampleT == null ? 16 : Math.min(Math.max(tNow - lastSampleT, 1), 200);
    const dt = dtMs / 1000;
    lastSampleT = tNow;

    // Velocity model: ease the shown speed toward the segment pace, then advance.
    // `curSpeed` is follower-level state so retargets never restart from zero —
    // the marker keeps its momentum and motion is continuous whatever the input.
    const remaining = seg.path.len - seg.playhead;
    let wantSpeed;
    if (remaining > 0.2) {
      wantSpeed = seg.pace;
    } else if (seg.playhead < seg.path.len + C.COAST_M) {
      wantSpeed = seg.pace * 0.6;           // coast past the last fix, decaying
    } else {
      wantSpeed = 0;                        // truly out of runway — hold
    }
    const cap = Math.min(Math.max(seg.pace * C.CATCHUP_MULT, C.MIN_SPEED_MPS), C.MAX_SPEED_MPS);
    if (wantSpeed > cap) wantSpeed = cap;

    const k = 1 - Math.exp(-dtMs / C.SPEED_TAU_MS);
    curSpeed += (wantSpeed - curSpeed) * k;
    if (curSpeed < 0.02) curSpeed = 0;

    seg.playhead = Math.min(seg.playhead + curSpeed * dt, seg.path.len + C.COAST_M);

    // position — coast straight past the polyline end along the last heading
    let hit;
    if (seg.playhead <= seg.path.len) {
      hit = alongPath(seg.path, seg.playhead);
    } else {
      const end = alongPath(seg.path, seg.path.len);
      const over = seg.playhead - seg.path.len;
      const h = (end.hdg == null ? (dispHdg ?? 0) : end.hdg) * DEG;
      hit = {
        lat: end.lat + (over * Math.cos(h)) / 111320,
        lon: end.lon + (over * Math.sin(h)) / ((111320 * Math.cos(end.lat * DEG)) || 1),
        hdg: end.hdg,
      };
    }

    // While moving, always commit the frame's position (a deadband here would
    // chop smooth motion into stop-go). Only when essentially stopped do we
    // freeze against GPS drift.
    const moved = metersBetween(out.lat, out.lon, hit.lat, hit.lon);
    if (curSpeed > 0.15 || moved >= C.STOP_DEADBAND_M) {
      out = { lat: hit.lat, lon: hit.lon };
    }

    // eased heading
    let settled = true;
    if (hit.hdg != null) easeHeadingTo(hit.hdg);
    if (smHdg != null) {
      if (dispHdg == null) dispHdg = smHdg;
      const gapH = shortestDelta(dispHdg, smHdg);
      if (Math.abs(gapH) > C.HEADING_DEADBAND_DEG) {
        dispHdg = wrap360(dispHdg + gapH * (1 - Math.exp(-dtMs / C.ROTATION_TAU_MS)));
      }
      settled = Math.abs(shortestDelta(dispHdg, smHdg)) <= C.ROTATION_SETTLE_DEG;
    }

    const stale = !lastFix || tNow - lastFix.tLocal > C.STALE_MS;
    const moving = !stale && curSpeed > C.MIN_SPEED_MPS;

    return { lat: out.lat, lon: out.lon, heading: dispHdg ?? 0, moving, settled };
  }

  return {
    pushFix,
    sample,
    reset: (lat, lon) => {
      out = Number.isFinite(lat) ? { lat, lon } : null;
      seg = null;
      curSpeed = 0;
      lastFix = out ? { lat, lon, sampleMs: null, tLocal: now() } : null;
      smHdg = null;
      dispHdg = null;
    },
    get fixCount() {
      return out ? (seg ? 2 : 1) : 0;
    },
  };
}
