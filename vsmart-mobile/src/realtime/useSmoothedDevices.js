import { useEffect, useRef, useState } from 'react';
import { Animated, Platform } from 'react-native';
import { createFollower } from './smoothFollow';

let AnimatedRegion;
if (Platform.OS !== 'web') {
  try { AnimatedRegion = require('react-native-maps').AnimatedRegion; } catch (_) {}
}

const FRAME_MS = 20; // ~50 fps cap

/**
 * Drives one path-follower per device (see smoothFollow.js) from a single
 * requestAnimationFrame loop.
 *
 * The follower output is pushed straight into per-device Animated values
 * (`AnimatedRegion` for the coordinate, an `Animated.Value` for the heading) via
 * setValue — this updates the NATIVE marker view every frame WITHOUT a React
 * re-render. React only re-renders when the device set changes (add / remove).
 *
 * Returns { anims, membersKey }:
 *   anims      Map<deviceId, { coord, rot, state }>   — stable refs
 *   membersKey string that changes only when membership changes
 *
 * The loop parks itself when every device is settled and restarts on the next fix.
 */
export function useSmoothedDevices(devices) {
  const followersRef = useRef(new Map());
  const animsRef = useRef(new Map()); // deviceId -> { coord, rot, state }
  const seenRef = useRef(new Map());
  const runningRef = useRef(false);
  const rafRef = useRef(null);
  const [membersKey, setMembersKey] = useState('');

  useEffect(() => {
    const followers = followersRef.current;
    const anims = animsRef.current;
    const seen = seenRef.current;
    const live = new Set();
    let membershipChanged = false;

    for (const device of devices) {
      const pos = device.position;
      if (!pos || pos.length < 2) continue;
      const id = device.deviceId;
      live.add(id);

      let follower = followers.get(id);
      const isNew = !follower;
      if (isNew) {
        follower = createFollower();
        followers.set(id, follower);
        anims.set(id, {
          coord: AnimatedRegion
            ? new AnimatedRegion({ latitude: pos[1], longitude: pos[0], latitudeDelta: 0, longitudeDelta: 0 })
            : null,
          rot: new Animated.Value(0),
          state: { latitude: pos[1], longitude: pos[0], heading: 0, moving: false },
          pushed: { lat: pos[1], lon: pos[0], heading: 0 },
        });
        membershipChanged = true;
      }

      // Only feed real-time fixes (serverTs / fixSeq). The periodic REST poll
      // also swaps the devices array but a stale polled position must not drive
      // the animation.
      const stamp = Number.isFinite(device.serverTs)
        ? device.serverTs
        : (Number.isFinite(device.fixSeq) ? `seq:${device.fixSeq}` : null);
      if ((stamp != null && seen.get(id) !== stamp) || isNew) {
        if (stamp != null) seen.set(id, stamp);
        const sampleMs = device.sampleTime ? Date.parse(device.sampleTime) : NaN;
        follower.pushFix(pos[1], pos[0], {
          seq: Number.isFinite(device.fixSeq) ? device.fixSeq : null,
          serverTs: Number.isFinite(device.serverTs) ? device.serverTs : undefined,
          sampleMs: Number.isFinite(sampleMs) ? sampleMs : undefined,
          path:
            Array.isArray(device.pathFromPrev) && device.pathFromPrev.length >= 2
              ? device.pathFromPrev
              : undefined,
        });
      }
    }

    for (const id of [...followers.keys()]) {
      if (!live.has(id)) {
        followers.delete(id);
        anims.delete(id);
        seen.delete(id);
        membershipChanged = true;
      }
    }

    if (membershipChanged) setMembersKey([...live].sort().join('|'));

    // ── start / resume the frame loop ──
    if (!runningRef.current) {
      runningRef.current = true;
      let last = 0;
      const loop = (now) => {
        if (now - last >= FRAME_MS) {
          last = now;
          let active = false;
          followersRef.current.forEach((f, id) => {
            const s = f.sample(now);
            const a = animsRef.current.get(id);
            if (!s || !a) return;
            const p = a.pushed;
            // push to the native view only when it moved since the LAST push
            if (a.coord && (Math.abs(p.lat - s.lat) > 1e-7 || Math.abs(p.lon - s.lon) > 1e-7)) {
              a.coord.setValue({ latitude: s.lat, longitude: s.lon, latitudeDelta: 0, longitudeDelta: 0 });
              p.lat = s.lat;
              p.lon = s.lon;
            }
            if (Math.abs(p.heading - s.heading) > 0.25) {
              a.rot.setValue(s.heading);
              p.heading = s.heading;
            }
            // state = current value, read by camera-follow
            a.state.latitude = s.lat;
            a.state.longitude = s.lon;
            a.state.heading = s.heading;
            a.state.moving = s.moving;
            if (s.moving || !s.settled) active = true;
          });
          if (!active) {
            runningRef.current = false;
            rafRef.current = null;
            return;
          }
        }
        rafRef.current = requestAnimationFrame(loop);
      };
      rafRef.current = requestAnimationFrame(loop);
    }
  }, [devices]);

  useEffect(
    () => () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      runningRef.current = false;
    },
    []
  );

  return { anims: animsRef.current, membersKey };
}
