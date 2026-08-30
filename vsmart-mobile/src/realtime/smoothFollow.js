/**
 * smoothFollow.js — Google-Maps-style position smoothing for live device markers.
 *
 * Ported from ESP32_OSM_NAV/src/map/map_view.cpp (`map_follow_interp` +
 * `map_ease_rotation` + `map_apply_heading`) and the phone-side drive logic in
 * ESP32_OSM_NAV/web_ble_nav (`posAt` — walk a polyline by distance). Pure math,
 * no framework deps.
 *
 * The device sends a sparse GPS fix every few seconds. Rendering that raw stream
 * makes the marker teleport. A follower keeps the last few fixes and, on every
 * animation frame, returns a position that:
 *   - walks the ON-ROAD polyline for the current fix interval when the backend
 *     provides one (`opts.path`), otherwise a Catmull-Rom spline through the
 *     recent fixes (continuous velocity, no per-fix kink);
 *   - is anchored to the NEWEST fix's arrival time, so it interpolates TOWARD a
 *     known point instead of extrapolating toward an unknown one (renders ~1 fix
 *     behind real time — the reason it stays smooth);
 *   - is hard-clamped to a max speed, so a bad fix can never teleport the marker
 *     off the road and back ("nhảy lung tung");
 *   - carries an eased heading so the icon rotates like a car, not a compass.
 *
 * NOTE: an identical copy lives at
 * vsmart-web/src/realtime/smoothFollow.js — keep the two in sync.
 */

export const SMOOTH_DEFAULTS = {
  HEADING_LP_ALPHA: 0.4,      // EMA on the raw fix-to-fix bearing (per fix)
  ROTATION_TAU_MS: 130,       // displayed-heading easing time constant
  ROTATION_SETTLE_DEG: 0.5,   // heading considered settled below this
  HEADING_DEADBAND_DEG: 4.0,  // ignore sub-wobble so the icon does not jitter
  POS_DEADBAND_M: 0.6,        // hold still for sub-metre drift
  LOOKAHEAD_FRAC: 0.15,       // may glide 15% past the newest fix to hide latency
  EXTRAPOLATE_MAX_M: 18,      // ...but never more than this many metres past it
  MAX_SPEED_MPS: 45,          // ~160 km/h hard clamp on displayed motion (anti-teleport)
  RESET_SPEED_MPS: 90,        // ~324 km/h — beyond any vehicle ⇒ real teleport, jump once
  SEG_MIN_MS: 500,
  SEG_MAX_MS: 15000,
  FIX_RING: 4,
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

/** Build cumulative-distance metadata for a [lng,lat] polyline. */
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
  if (coords.length < 2) return { lat: coords[0][1], lon: coords[0][0], hdg: null };
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
  return {
    lat: y1 + (y2 - y1) * f,
    lon: x1 + (x2 - x1) * f,
    hdg: bearingDeg(y1, x1, y2, x2),
  };
}

/**
 * @param {Partial<typeof SMOOTH_DEFAULTS> & { clock?: () => number }} [opts]
 */
export function createFollower(opts = {}) {
  const { clock, ...tuning } = opts;
  const C = { ...SMOOTH_DEFAULTS, ...tuning };
  const now = typeof clock === 'function' ? clock : clockNow;

  // ring[0] = newest: { lat, lon, tLocal, serverTs, seq, path? (measured) }
  const ring = [];
  let smHdg = null;
  let dispHdg = null;
  let lastSampleT = null;
  let outLat = null;
  let outLon = null;
  let outT = null;

  function refreshHeadingTail() {
    if (ring.length < 2) return;
    const raw = bearingDeg(ring[1].lat, ring[1].lon, ring[0].lat, ring[0].lon);
    if (smHdg == null) {
      smHdg = raw;
      dispHdg = raw;
    } else {
      smHdg = wrap360(smHdg + shortestDelta(smHdg, raw) * C.HEADING_LP_ALPHA);
    }
  }

  function hardReset(lat, lon, serverTs, seq, path) {
    ring.length = 0;
    ring.push({
      lat, lon, tLocal: now(), serverTs: serverTs ?? now(), seq: seq ?? null,
      path: path && path.length >= 2 ? measurePath(path) : null,
    });
    smHdg = null;
    dispHdg = null;
    outLat = lat;
    outLon = lon;
    outT = now();
  }

  /**
   * @param {number} lat
   * @param {number} lon
   * @param {{ serverTs?: number, seq?: number|null, path?: Array<[number,number]> }} [meta]
   */
  function pushFix(lat, lon, meta = {}) {
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;
    const { serverTs, seq = null, path } = meta;
    const measured = path && path.length >= 2 ? measurePath(path) : null;
    const t = now();

    if (ring.length) {
      const head = ring[0];

      // Road-snap / refinement correction: same seq as the newest fix →
      // re-target that fix in place (keep its arrival time so playback continues).
      if (seq != null && head.seq === seq) {
        head.lat = lat;
        head.lon = lon;
        if (measured) head.path = measured;
        refreshHeadingTail();
        return;
      }

      // Identical heartbeat — keep it fresh, do not fabricate a zero segment.
      if (head.lat === lat && head.lon === lon) {
        head.tLocal = t;
        if (serverTs != null) head.serverTs = serverTs;
        return;
      }

      // Use the server clock for the elapsed time so bursty Socket.io delivery
      // (two events arriving milliseconds apart) is not mistaken for a teleport.
      const gapMs = (serverTs != null && head.serverTs != null)
        ? serverTs - head.serverTs
        : t - head.tLocal;
      const localGapMs = t - head.tLocal;
      const jumpM = metersBetween(head.lat, head.lon, lat, lon);
      const impliedSpeed = jumpM / Math.max(gapMs / 1000, 0.1);
      if (localGapMs > C.STALE_MS || impliedSpeed > C.RESET_SPEED_MPS) {
        hardReset(lat, lon, serverTs, seq, path);
        return;
      }
    } else {
      hardReset(lat, lon, serverTs, seq, path);
      return;
    }

    ring.unshift({ lat, lon, tLocal: t, serverTs: serverTs ?? t, seq, path: measured });
    if (ring.length > C.FIX_RING) ring.pop();
    refreshHeadingTail();
  }

  function sample(tNow = now()) {
    if (!ring.length) return null;

    if (ring.length === 1) {
      const p = ring[0];
      outLat = p.lat;
      outLon = p.lon;
      outT = tNow;
      return { lat: p.lat, lon: p.lon, heading: dispHdg ?? 0, moving: false, settled: true };
    }

    const p2 = ring[0];
    const p1 = ring[1];

    // Prefer the server-measured interval (jitter-free); fall back to local
    // arrival delta when a serverTs is missing or the two clocks disagree
    // (e.g. a REST-bootstrapped first fix vs. an epoch-stamped socket fix).
    let segDur = (p2.serverTs || 0) - (p1.serverTs || 0);
    if (!(segDur > 0 && segDur < 60000)) segDur = p2.tLocal - p1.tLocal;
    segDur = Math.min(Math.max(segDur, C.SEG_MIN_MS), C.SEG_MAX_MS);

    // Anchor to the NEWEST fix's arrival: frac 0→1 walks p1→p2 over the interval
    // that follows p2, i.e. we render one fix behind and interpolate toward a
    // known point. A small overshoot hides delivery latency.
    let frac = (tNow - p2.tLocal) / segDur;
    if (frac < 0) frac = 0;
    const maxFrac = 1 + C.LOOKAHEAD_FRAC;
    if (frac > maxFrac) frac = maxFrac;

    let lat;
    let lon;
    let rawHdg = null;

    if (p2.path) {
      // Walk the on-road polyline for this segment.
      const hit = alongPath(p2.path, frac * p2.path.len);
      lat = hit.lat;
      lon = hit.lon;
      rawHdg = hit.hdg;
    } else {
      // Uniform Catmull-Rom between p1 and p2 (C1 continuous velocity).
      const p0 = ring[2] || p1;
      const p3lat = p2.lat + (p2.lat - p1.lat);
      const p3lon = p2.lon + (p2.lon - p1.lon);
      const u = frac;
      const u2 = u * u;
      const u3 = u2 * u;
      const cr = (a, b, c, d) =>
        0.5 * (2 * b + (-a + c) * u + (2 * a - 5 * b + 4 * c - d) * u2 + (-a + 3 * b - 3 * c + d) * u3);
      lat = cr(p0.lat, p1.lat, p2.lat, p3lat);
      lon = cr(p0.lon, p1.lon, p2.lon, p3lon);
    }

    // Cap how far we may sit past the newest fix.
    if (frac > 1) {
      const past = metersBetween(p2.lat, p2.lon, lat, lon);
      if (past > C.EXTRAPOLATE_MAX_M) {
        const k = C.EXTRAPOLATE_MAX_M / past;
        lat = p2.lat + (lat - p2.lat) * k;
        lon = p2.lon + (lon - p2.lon) * k;
      }
    }

    // Hard speed clamp vs the last emitted position — the anti-teleport net.
    if (outLat != null) {
      const dt = Math.max((tNow - (outT ?? tNow)) / 1000, 1 / 120);
      const moved = metersBetween(outLat, outLon, lat, lon);
      const maxMove = C.MAX_SPEED_MPS * dt;
      if (moved > maxMove && moved > 0) {
        const k = maxMove / moved;
        lat = outLat + (lat - outLat) * k;
        lon = outLon + (lon - outLon) * k;
      } else if (moved < C.POS_DEADBAND_M) {
        lat = outLat;
        lon = outLon;
      }
    }
    outLat = lat;
    outLon = lon;
    outT = tNow;

    // Eased displayed heading.
    let settled = true;
    if (rawHdg != null) {
      smHdg = smHdg == null ? rawHdg : wrap360(smHdg + shortestDelta(smHdg, rawHdg) * C.HEADING_LP_ALPHA);
    }
    if (smHdg != null) {
      if (dispHdg == null) dispHdg = smHdg;
      const gap = shortestDelta(dispHdg, smHdg);
      if (Math.abs(gap) > C.HEADING_DEADBAND_DEG) {
        const dt = lastSampleT == null ? 16 : Math.max(tNow - lastSampleT, 1);
        const alpha = 1 - Math.exp(-dt / C.ROTATION_TAU_MS);
        dispHdg = wrap360(dispHdg + gap * alpha);
      }
      settled = Math.abs(shortestDelta(dispHdg, smHdg)) <= C.ROTATION_SETTLE_DEG;
    }
    lastSampleT = tNow;

    const moving =
      metersBetween(p1.lat, p1.lon, p2.lat, p2.lon) > C.POS_DEADBAND_M &&
      tNow - p2.tLocal < Math.max(segDur * 1.5, C.STALE_MS);

    return { lat, lon, heading: dispHdg ?? 0, moving, settled };
  }

  return {
    pushFix,
    sample,
    reset: (lat, lon) => hardReset(lat, lon),
    get fixCount() {
      return ring.length;
    },
  };
}
