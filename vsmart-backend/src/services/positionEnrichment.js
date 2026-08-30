/**
 * positionEnrichment.js — adds the fields the web / mobile smoothing layer needs
 * onto `device.position.updated` events before they are fanned out over Socket.io.
 *
 * The IoT firmware only reports lat/lon/speed on a sparse cadence, and the
 * road-snap follow-up arrives as a second near-duplicate event. Clients need:
 *   - `serverTs`   a single trusted clock for pacing interpolation
 *   - `fixSeq`     a per-device counter so the road-snapped follow-up can be
 *                  recognised as a correction of the same fix, not a new one
 *   - `heading`    derived from the previous emitted position when the device
 *                  does not send a course
 *
 * State is in-memory and per-process — fine for a single backend instance; a
 * restart just re-seeds the counters from 1 (clients treat a lower fixSeq after
 * a gap as a fresh fix).
 */

const DEG = Math.PI / 180;

function bearingDeg(lat1, lon1, lat2, lon2) {
  const y = Math.sin((lon2 - lon1) * DEG) * Math.cos(lat2 * DEG);
  const x =
    Math.cos(lat1 * DEG) * Math.sin(lat2 * DEG) -
    Math.sin(lat1 * DEG) * Math.cos(lat2 * DEG) * Math.cos((lon2 - lon1) * DEG);
  const deg = Math.atan2(y, x) / DEG;
  return (deg % 360 + 360) % 360;
}

function createPositionEnricher({ now = () => Date.now() } = {}) {
  const seqByDevice = new Map();
  const lastPosByDevice = new Map(); // deviceId -> { lng, lat } (most recent)
  const prevPosByDevice = new Map(); // deviceId -> { lng, lat } (the one before)

  /** Raw position fix: new fixSeq, compute heading if absent, stamp serverTs. */
  function enrichRaw(event) {
    const deviceId = event.deviceId;
    const payload = event.payload || {};
    const seq = (seqByDevice.get(deviceId) || 0) + 1;
    seqByDevice.set(deviceId, seq);

    const props = { ...(payload.positionProperties || {}) };
    const pos = payload.position;

    if (Array.isArray(pos) && pos.length === 2 &&
        Number.isFinite(pos[0]) && Number.isFinite(pos[1])) {
      const [lng, lat] = pos;
      const prev = lastPosByDevice.get(deviceId);
      const hasHeading =
        props.heading != null && props.heading !== '' &&
        Number.isFinite(Number(props.heading));
      if (!hasHeading && prev && (prev.lng !== lng || prev.lat !== lat)) {
        props.heading = String(Math.round(bearingDeg(prev.lat, prev.lng, lat, lng)));
      }
      if (prev) prevPosByDevice.set(deviceId, prev);
      lastPosByDevice.set(deviceId, { lng, lat });
    }

    return {
      ...event,
      payload: { ...payload, positionProperties: props, serverTs: now(), fixSeq: seq },
    };
  }

  /** Position one fix back — the "from" point for a pathFromPrev road segment. */
  function peekPrevPos(deviceId) {
    return prevPosByDevice.get(deviceId) || null;
  }

  /**
   * Road-snapped follow-up: reuse the current fixSeq, flag as a correction, and
   * (optionally) carry the on-road polyline from the previous fix to this one.
   * @param {object} event
   * @param {Array<[number,number]>|null} [pathFromPrev]
   */
  function enrichCorrection(event, pathFromPrev = null) {
    const deviceId = event.deviceId;
    const payload = event.payload || {};
    const pos = payload.position;
    if (Array.isArray(pos) && pos.length === 2 &&
        Number.isFinite(pos[0]) && Number.isFinite(pos[1])) {
      // measure the next heading from the snapped (on-road) point
      lastPosByDevice.set(deviceId, { lng: pos[0], lat: pos[1] });
    }
    const extra = { serverTs: now(), fixSeq: seqByDevice.get(deviceId) ?? null, correction: true };
    if (Array.isArray(pathFromPrev) && pathFromPrev.length >= 2) {
      extra.pathFromPrev = pathFromPrev;
    }
    return { ...event, payload: { ...payload, ...extra } };
  }

  return { enrichRaw, enrichCorrection, peekPrevPos };
}

module.exports = { createPositionEnricher, bearingDeg };
