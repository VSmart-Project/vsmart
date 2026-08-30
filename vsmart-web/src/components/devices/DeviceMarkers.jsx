import { Marker } from 'react-map-gl/maplibre';
import { Navigation2 } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { createFollower } from '../../realtime/smoothFollow';

/**
 * One requestAnimationFrame loop drives every device follower, so N markers cost
 * one rAF, not N. Callbacks unregister themselves once their follower settles.
 */
const tickers = new Set();
let rafId = null;

function pump() {
  const now = performance.now();
  tickers.forEach((cb) => cb(now));
  rafId = tickers.size ? requestAnimationFrame(pump) : null;
}

function addTicker(cb) {
  tickers.add(cb);
  if (rafId == null) rafId = requestAnimationFrame(pump);
}

function removeTicker(cb) {
  tickers.delete(cb);
  if (tickers.size === 0 && rafId != null) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }
}

/**
 * Feeds sparse fixes into a Catmull-Rom follower (see realtime/smoothFollow.js)
 * and returns a per-frame { lng, lat, heading } the marker renders from.
 */
function useSmoothFollow(position, { fixSeq, serverTs, sampleTime, pathFromPrev } = {}) {
  const followerRef = useRef(null);
  if (followerRef.current == null) followerRef.current = createFollower();

  const [out, setOut] = useState(() =>
    position ? { lng: position[0], lat: position[1], heading: 0 } : null
  );

  const lng = position ? position[0] : null;
  const lat = position ? position[1] : null;
  const stamp = Number.isFinite(serverTs) ? serverTs : sampleTime;

  useEffect(() => {
    if (lng == null || lat == null) return undefined;

    const follower = followerRef.current;
    // Drive the animation only from real-time fixes (they carry serverTs). The
    // periodic full-list REST refresh also re-renders this component but a
    // slightly stale polled position must not yank the marker. Always take the
    // very first fix so a fresh marker has something to show.
    const realtime = Number.isFinite(serverTs);
    if (realtime || follower.fixCount === 0) {
      // A repeated seq is a road-snap correction: the follower re-targets that
      // fix in place (with the on-road polyline, if given) instead of restarting.
      follower.pushFix(lat, lng, {
        seq: Number.isFinite(fixSeq) ? fixSeq : null,
        serverTs: realtime ? serverTs : undefined,
        path: Array.isArray(pathFromPrev) && pathFromPrev.length >= 2 ? pathFromPrev : undefined,
      });
    }

    let cancelled = false;
    const cb = (now) => {
      if (cancelled) return;
      const s = follower.sample(now);
      if (!s) return;
      setOut({ lng: s.lon, lat: s.lat, heading: s.heading });
      if (!s.moving && s.settled) removeTicker(cb);
    };
    addTicker(cb);
    cb(performance.now()); // paint the new fix immediately, don't wait a frame

    return () => {
      cancelled = true;
      removeTicker(cb);
    };
    // Re-run when a genuinely new fix (or its road-snap correction) lands.
  }, [stamp, serverTs, fixSeq, lng, lat, pathFromPrev]);

  return out;
}

const SmoothMarker = ({ deviceId, position, fixSeq, serverTs, sampleTime, pathFromPrev, statusColor, onClick }) => {
  const render = useSmoothFollow(position, { fixSeq, serverTs, sampleTime, pathFromPrev });

  if (!render) return null;

  return (
    <Marker longitude={render.lng} latitude={render.lat} anchor="center" onClick={onClick}>
      <div className="relative cursor-pointer group">
        <div
          className="absolute inset-0 rounded-full animate-ping opacity-75"
          style={{ backgroundColor: statusColor }}
        />
        <div
          className="relative w-10 h-10 rounded-full flex items-center justify-center shadow-lg border-2 border-white transition-transform group-hover:scale-110"
          style={{ backgroundColor: statusColor }}
        >
          <Navigation2
            className="w-5 h-5 text-white"
            style={{ transform: `rotate(${render.heading}deg)`, transition: 'transform 80ms linear' }}
          />
        </div>
        <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-1 px-2 py-1 bg-card dark:bg-card-dark border border-hairline dark:border-hairline-dark rounded shadow-md text-xs font-semibold whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity z-10 text-ink dark:text-ink-dark">
          {deviceId}
        </div>
      </div>
    </Marker>
  );
};

const DeviceMarkers = ({ devices = [], onDeviceClick }) => {
  const getDeviceId = (device) => device.DeviceId || device.deviceId;
  const getPosition = (device) => device.Position || device.position;
  const getSampleTime = (device) => device.SampleTime || device.sampleTime;

  const getStatusColor = (device) => {
    const sampleTime = getSampleTime(device);
    if (!sampleTime) return '#94A3B8'; // Slate 400
    const lastUpdate = new Date(sampleTime);
    const now = new Date();
    const diffMinutes = (now - lastUpdate) / 1000 / 60;

    if (diffMinutes < 5) return '#10B981'; // Green (Active)
    if (diffMinutes < 30) return '#F59E0B'; // Yellow (Warning)
    return '#EF4444'; // Red (Offline)
  };

  return (
    <>
      {devices.map((device) => {
        const deviceId = getDeviceId(device);
        const position = getPosition(device);

        if (!position || position.length < 2) return null;

        return (
          <SmoothMarker
            key={deviceId}
            deviceId={deviceId}
            position={position}
            fixSeq={device.fixSeq}
            serverTs={device.serverTs}
            sampleTime={getSampleTime(device)}
            pathFromPrev={device.pathFromPrev}
            statusColor={getStatusColor(device)}
            onClick={(e) => {
              if (e && e.stopPropagation) {
                e.stopPropagation();
              } else if (e && e.originalEvent && e.originalEvent.stopPropagation) {
                e.originalEvent.stopPropagation();
              }
              if (onDeviceClick) {
                onDeviceClick(device, true); // Select and zoom to device in left details sidebar
              }
            }}
          />
        );
      })}
    </>
  );
};

export default DeviceMarkers;
