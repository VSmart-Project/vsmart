import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  X, ChevronLeft, ChevronRight, ChevronsRight, RefreshCw, CalendarDays,
  Truck, Car, Bike, Bus, Package, Gauge, Clock, Route, MapPin, Sparkles,
} from 'lucide-react';
import { deviceApi } from '../../api/deviceApi';
import { clsx } from 'clsx';

// ─── Reverse geocoding (best-effort, resilient) ────────────────────────────
// Nominatim is public + rate-limited, and on some networks it is DNS-blackholed.
// So: one shared cache keyed by rounded coords (~11 m), and a circuit breaker
// that stops hammering it after repeated failures.
const geocodeCache = new Map();
const geocodeBreaker = { fails: 0, until: 0 };
const geoKey = (lat, lon) => `${lat.toFixed(4)},${lon.toFixed(4)}`;

async function reverseGeocode(lat, lon) {
  const key = geoKey(lat, lon);
  if (geocodeCache.has(key)) return geocodeCache.get(key);
  const fallback = `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
  if (Date.now() < geocodeBreaker.until) return fallback;
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 4000);
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=16`,
      { signal: ctrl.signal, headers: { 'Accept-Language': 'vi' } },
    );
    clearTimeout(timer);
    const data = await res.json();
    geocodeBreaker.fails = 0;
    const name = data.display_name || fallback;
    geocodeCache.set(key, name);
    return name;
  } catch {
    if (++geocodeBreaker.fails >= 3) geocodeBreaker.until = Date.now() + 5 * 60_000;
    geocodeCache.set(key, fallback);
    return fallback;
  }
}

// ─── Config ────────────────────────────────────────────────────────────────

const VEHICLE_ICON = {
  truck: Truck,
  car: Car,
  motorbike: Bike,
  van: Package,
  bus: Bus,
  other: Car,
};

const STATUS_CONFIG = {
  active: {
    label: 'Active',
    pill: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 border-emerald-100 dark:border-emerald-500/30',
    dot: 'bg-emerald-500',
  },
  inactive: {
    label: 'Inactive',
    pill: 'text-subtle dark:text-subtle-dark bg-surface dark:bg-white/5 border-hairline dark:border-hairline-dark',
    dot: 'bg-subtle dark:bg-subtle-dark',
  },
  maintenance: {
    label: 'Maintenance',
    pill: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 border-amber-100 dark:border-amber-500/30',
    dot: 'bg-amber-500',
  },
};

const EVENT_LABEL = { driving: 'Driving', stopped: 'Stopped' };
const TABS = ['tracking', 'analytics', 'details'];

// ─── Helpers ───────────────────────────────────────────────────────────────

// Distance between two [lng, lat] coordinates in km (Haversine formula)
const getDistanceKm = (coords1, coords2) => {
  if (!coords1 || !coords2) return 0;
  const [lon1, lat1] = coords1;
  const [lon2, lat2] = coords2;
  const R = 6371; // Radius of the earth in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const formatRelative = (ts) => {
  if (!ts) return '—';
  const s = Math.round((Date.now() - new Date(ts).getTime()) / 1000);
  if (s < 45) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} hr ago`;
  return `${Math.round(h / 24)} d ago`;
};

// ─── Small presentational pieces ───────────────────────────────────────────

const InfoRow = ({ label, value, mono }) => (
  <div className="flex items-center justify-between gap-4 py-2.5">
    <dt className="shrink-0 text-xs text-subtle dark:text-subtle-dark">{label}</dt>
    <dd className={clsx('min-w-0 truncate text-right text-xs font-semibold text-ink dark:text-ink-dark', mono && 'font-mono')}>
      {value}
    </dd>
  </div>
);

const MetricChip = ({ icon, children, tone = 'brand' }) => {
  const Icon = icon;
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-xs font-medium font-mono tabular-nums',
        tone === 'brand'
          ? 'bg-brand-50 dark:bg-brand-400/10 text-brand-600 dark:text-brand-300 border-brand-100 dark:border-brand-400/20'
          : 'bg-surface dark:bg-white/5 text-muted dark:text-muted-dark border-hairline dark:border-hairline-dark'
      )}
    >
      <Icon className="h-3 w-3 shrink-0" />
      {children}
    </span>
  );
};

// ─── Component ─────────────────────────────────────────────────────────────

export default function DeviceDetailPanel({ device, selectedDate, onSelectedDateChange, historyPoints, onHistoryPointsChange, onMatchedPathChange, onClose }) {
  const [activeTab, setActiveTab] = useState('tracking'); // 'tracking' | 'analytics' | 'details'
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [addresses, setAddresses] = useState({});
  const dateInputRef = useRef(null);

  const changeDate = (days) => {
    const next = new Date(selectedDate);
    next.setDate(next.getDate() + days);
    onSelectedDateChange(next);
  };

  const formatSelectedDate = (date) => {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const formatInputDate = (date) => {
    const y = date.getFullYear();
    const m = (date.getMonth() + 1).toString().padStart(2, '0');
    const d = date.getDate().toString().padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  const isToday = formatInputDate(new Date(selectedDate)) === formatInputDate(new Date());

  // Reset date selection when active device changes
  useEffect(() => {
    if (device?.sampleTime) {
      const devDate = new Date(device.sampleTime);
      const currentFormatted = formatInputDate(selectedDate);
      const nextFormatted = formatInputDate(devDate);
      if (currentFormatted !== nextFormatted) {
        onSelectedDateChange(devDate);
      }
    } else {
      const todayFormatted = formatInputDate(new Date());
      const currentFormatted = formatInputDate(selectedDate);
      if (currentFormatted !== todayFormatted) {
        onSelectedDateChange(new Date());
      }
    }
  }, [device?.deviceId, device?.sampleTime, onSelectedDateChange, selectedDate]);

  // Fetch history from API and store in parent state
  const deviceId = device?.deviceId;
  const fetchHistory = useCallback(() => {
    if (!deviceId) return;
    setLoading(true);

    const startOfDay = new Date(selectedDate);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(selectedDate);
    endOfDay.setHours(23, 59, 59, 999);

    const startIso = startOfDay.toISOString();
    const endIso = endOfDay.toISOString();
    const sortChrono = (rows) => [...(rows || [])].sort(
      (a, b) => new Date(a.SampleTime) - new Date(b.SampleTime)
    );

    // 1) Fast: raw points render immediately (no OSRM round-trip).
    deviceApi.getHistory(deviceId, startIso, endIso)
      .then(res => {
        onHistoryPointsChange(sortChrono(res.data));
      })
      .catch(err => console.error('[History] Failed to load:', err))
      .finally(() => setLoading(false));

    // 2) Slower: road-matched path swaps in when OSRM returns (null ⇒ keep raw).
    onMatchedPathChange?.([]);
    deviceApi.getHistory(deviceId, startIso, endIso, { matched: true })
      .then(res => onMatchedPathChange?.(res.matchedPath || []))
      .catch(() => { /* raw line already shown */ });
  }, [deviceId, selectedDate, onHistoryPointsChange, onMatchedPathChange]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  // Parse chronological events when historyPoints update
  useEffect(() => {
    if (!device) return;

    // Group consecutive updates into "Driving" or "Stopped" segments
    const segments = [];
    let currentSegment = null;

    for (let i = 0; i < historyPoints.length - 1; i++) {
      const pt = historyPoints[i];
      const nextPt = historyPoints[i + 1];

      const distance = getDistanceKm(pt.Position, nextPt.Position);
      const timeMs = Math.abs(new Date(nextPt.SampleTime) - new Date(pt.SampleTime));

      let type = 'stopped';
      let speed = 0;

      // If the gap between two pings is longer than 30 seconds, treat it as a stop gap
      const isGap = timeMs > 30000;

      if (!isGap) {
        const timeHrs = timeMs / 3600000;
        speed = timeHrs > 0 ? (distance / timeHrs) : 0;
        type = speed > 3 ? 'driving' : 'stopped';
      } else {
        type = 'stopped';
      }

      if (isGap) {
        // Finalize current segment before gap
        if (currentSegment) {
          segments.push(currentSegment);
          currentSegment = null;
        }
        // Add a dedicated stopped segment for the gap duration
        const gapMin = Math.round(timeMs / 60000);
        segments.push({
          type: 'stopped',
          startTime: pt.SampleTime,
          endTime: nextPt.SampleTime,
          durationMs: timeMs,
          distance: 0,
          startPosition: pt.Position,
          endPosition: pt.Position,
          speeds: [0],
          duration: gapMin > 0 ? `${gapMin} min` : null,
          rawDurationMin: gapMin,
          position: pt.Position
        });
      } else {
        if (!currentSegment) {
          currentSegment = {
            type,
            startTime: pt.SampleTime,
            endTime: nextPt.SampleTime,
            durationMs: timeMs,
            distance: distance,
            startPosition: pt.Position,
            endPosition: nextPt.Position,
            speeds: [speed]
          };
        } else if (currentSegment.type === type) {
          // Merge same state into current segment
          currentSegment.endTime = nextPt.SampleTime;
          currentSegment.durationMs += timeMs;
          currentSegment.distance += distance;
          currentSegment.endPosition = nextPt.Position;
          currentSegment.speeds.push(speed);
        } else {
          // State changed: finalize old segment and start new one
          segments.push(currentSegment);
          currentSegment = {
            type,
            startTime: pt.SampleTime,
            endTime: nextPt.SampleTime,
            durationMs: timeMs,
            distance: distance,
            startPosition: pt.Position,
            endPosition: nextPt.Position,
            speeds: [speed]
          };
        }
      }
    }

    // Push last segment
    if (currentSegment) {
      segments.push(currentSegment);
    }

    // Map segments to timeline event cards (newest first)
    const parsedEvents = segments.reverse().map((seg, idx) => {
      if (seg.type === 'stopped' && seg.duration) {
        // Already created gap segment
        return seg;
      }

      let durationMs = seg.durationMs;

      // If the latest event is 'stopped', add elapsed time from the last ping to now
      if (idx === 0 && seg.type === 'stopped') {
        const timeSinceLastPingMs = new Date() - new Date(seg.endTime);
        if (timeSinceLastPingMs > 0) {
          durationMs += timeSinceLastPingMs;
        }
      }

      const durationMin = Math.round(durationMs / 60000);

      // Calculate average speed for driving segment
      const avgSpeed = seg.type === 'driving'
        ? seg.speeds.reduce((a, b) => a + b, 0) / seg.speeds.length
        : 0;

      return {
        type: seg.type,
        time: seg.endTime
          ? new Date(seg.endTime).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' })
          : '12:00',
        startTime: seg.startTime,
        endTime: seg.endTime,
        rawTime: seg.endTime,
        speed: seg.type === 'driving' ? `${Math.min(Math.round(avgSpeed), 100)} km/h` : null,
        duration: durationMin > 0 ? `${durationMin} min` : null,
        rawDurationMin: durationMin,
        distance: seg.type === 'driving' && seg.distance > 0.05 ? `${seg.distance.toFixed(1)} km` : null,
        position: seg.endPosition // Use final position of the segment
      };
    });

    // Fallback if history is empty but device is currently active
    if (parsedEvents.length === 0 && device.position) {
      let durationMs = 600000; // 10 minutes default
      if (device.sampleTime) {
        const diffMs = new Date() - new Date(device.sampleTime);
        if (diffMs > 0) durationMs = diffMs;
      }
      const durationMin = Math.round(durationMs / 60000);

      parsedEvents.push({
        type: 'stopped',
        time: device.sampleTime
          ? new Date(device.sampleTime).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' })
          : 'Just now',
        startTime: device.sampleTime ? new Date(device.sampleTime).getTime() - 600000 : new Date().getTime() - 600000,
        endTime: device.sampleTime ? new Date(device.sampleTime) : new Date(),
        rawTime: device.sampleTime,
        speed: null,
        duration: durationMin > 0 ? `${durationMin} min` : null,
        rawDurationMin: durationMin,
        distance: null,
        position: device.position
      });
    }

    setEvents(parsedEvents.slice(0, 5));
  }, [device, historyPoints]);

  // Resolve addresses for the timeline events (deduped by rounded coords).
  useEffect(() => {
    let cancelled = false;
    const pending = [];
    const seen = new Set();
    for (const eventItem of events) {
      if (!eventItem.position) continue;
      const [lon, lat] = eventItem.position;
      const key = geoKey(lat, lon);
      if (seen.has(key) || addresses[key]) continue;
      seen.add(key);
      pending.push({ key, lat, lon });
    }
    if (pending.length === 0) return undefined;
    Promise.all(
      pending.map(async ({ key, lat, lon }) => [key, await reverseGeocode(lat, lon)]),
    ).then((results) => {
      if (cancelled) return;
      setAddresses(prev => {
        const next = { ...prev };
        for (const [k, v] of results) next[k] = v;
        return next;
      });
    });
    return () => { cancelled = true; };
    // `addresses` intentionally omitted — reading it for the guard, not reacting to it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events]);

  // Day summary derived from the same movement heuristic used for the timeline
  const daySummary = useMemo(() => {
    if (!historyPoints || historyPoints.length < 2) return null;
    let distanceKm = 0;
    let driveMs = 0;
    let stopMs = 0;
    let topKmh = 0;
    let stops = 0;
    let wasMoving = false;

    for (let i = 0; i < historyPoints.length - 1; i++) {
      const pt = historyPoints[i];
      const nextPt = historyPoints[i + 1];
      const d = getDistanceKm(pt.Position, nextPt.Position);
      const ms = Math.abs(new Date(nextPt.SampleTime) - new Date(pt.SampleTime));
      const isGap = ms > 30000;
      const spd = !isGap && ms > 0 ? d / (ms / 3600000) : 0;

      if (!isGap && spd > 3) {
        distanceKm += d;
        driveMs += ms;
        topKmh = Math.max(topKmh, spd);
        wasMoving = true;
      } else {
        stopMs += ms;
        if (wasMoving) stops += 1;
        wasMoving = false;
      }
    }

    return {
      distanceKm,
      driveMin: Math.round(driveMs / 60000),
      stopMin: Math.round(stopMs / 60000),
      stops,
      topKmh: Math.min(Math.round(topKmh), 120),
      points: historyPoints.length,
    };
  }, [historyPoints]);

  if (!device) return null;

  // Calculate timeline ranges dynamically (optimized for 30+ minutes span with 5-minute steps)
  let timelineStart = null;
  let timelineEnd = null;
  let timelineLabels = [];

  if (events.length > 0) {
    const timestamps = events.flatMap(e => [new Date(e.startTime || e.rawTime), new Date(e.endTime || e.rawTime)]);
    const minTime = new Date(Math.min(...timestamps));
    const maxTime = new Date(Math.max(...timestamps));

    // Round min time down to nearest 5 minutes
    const roundedMin = new Date(minTime);
    const minMin = roundedMin.getMinutes();
    roundedMin.setMinutes(Math.floor(minMin / 5) * 5, 0, 0);
    timelineStart = roundedMin;

    // Round max time up to nearest 5 minutes
    const roundedMax = new Date(maxTime);
    const maxMin = roundedMax.getMinutes();
    roundedMax.setMinutes(Math.ceil(maxMin / 5) * 5, 0, 0);
    timelineEnd = roundedMax;

    // Ensure the total timeline span is at least 30 minutes
    const currentSpanMin = (timelineEnd.getTime() - timelineStart.getTime()) / 60000;
    if (currentSpanMin < 30) {
      timelineEnd = new Date(timelineStart.getTime() + 30 * 60000);
    }

    // Generate labels every 5 minutes (or 10 minutes if span is very long)
    const finalSpanMin = (timelineEnd.getTime() - timelineStart.getTime()) / 60000;
    const stepMin = finalSpanMin > 50 ? 10 : 5;

    for (let t = timelineStart.getTime(); t <= timelineEnd.getTime(); t += stepMin * 60000) {
      const dt = new Date(t);
      const formatted = `${dt.getHours().toString().padStart(2, '0')}:${dt.getMinutes().toString().padStart(2, '0')}`;
      timelineLabels.push(formatted);
    }
  }

  const timelineStartMs = timelineStart ? timelineStart.getTime() : 0;
  const timelineEndMs = timelineEnd ? timelineEnd.getTime() : 1;
  const totalRangeMs = timelineEndMs - timelineStartMs;

  // Position each segment absolutely on the timeline bar
  const timelineBars = events.map(e => {
    const startMs = new Date(e.startTime || e.rawTime).getTime();
    const endMs = new Date(e.endTime || e.rawTime).getTime();

    const leftPct = Math.max(0, Math.min(100, ((startMs - timelineStartMs) / totalRangeMs) * 100));
    const rightPct = Math.max(0, Math.min(100, ((endMs - timelineStartMs) / totalRangeMs) * 100));

    let widthPct = rightPct - leftPct;
    if (widthPct < 1.5) widthPct = 1.5; // Ensure small events are visible

    return {
      type: e.type,
      left: `${leftPct}%`,
      width: `${widthPct}%`
    };
  });

  const status = STATUS_CONFIG[device.status] || {
    label: device.status ? device.status[0].toUpperCase() + device.status.slice(1) : 'Unknown',
    pill: STATUS_CONFIG.inactive.pill,
    dot: STATUS_CONFIG.inactive.dot,
  };
  const VehicleIcon = VEHICLE_ICON[device.type] || VEHICLE_ICON.other;
  const coordText = device.position
    ? `${device.position[1].toFixed(4)}, ${device.position[0].toFixed(4)}`
    : '—';

  return (
    <div className="absolute top-4 right-4 bottom-4 z-20 flex w-96 max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-3xl border border-hairline dark:border-hairline-dark bg-card/95 dark:bg-card-dark/95 shadow-panel-lg dark:shadow-panel-lg-dark backdrop-blur-md select-none animate-fade-in">

      {/* ── Identity header (sticky) ── */}
      <header className="shrink-0 border-b border-hairline dark:border-hairline-dark px-5 pb-4 pt-5">
        <div className="flex items-start gap-3">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-500 dark:bg-brand-400/10 dark:text-brand-400">
            <VehicleIcon className="h-5 w-5" />
          </div>

          <div className="min-w-0 flex-1">
            <h2 className="truncate text-base font-bold leading-tight text-ink dark:text-ink-dark">
              {device.displayName || 'Unnamed vehicle'}
            </h2>
            <div className="mt-1.5 flex items-center gap-2">
              <span className={clsx('inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-semibold', status.pill)}>
                <span className={clsx('h-1.5 w-1.5 rounded-full', status.dot)} />
                {status.label}
              </span>
              <span className="truncate font-mono text-xs text-subtle dark:text-subtle-dark">
                #{device.deviceId}
              </span>
            </div>
          </div>

          <button
            onClick={onClose}
            aria-label="Close panel"
            className="-mr-1.5 -mt-1.5 shrink-0 rounded-lg p-1.5 text-subtle transition-colors hover:bg-surface hover:text-ink dark:text-subtle-dark dark:hover:bg-white/5 dark:hover:text-ink-dark"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <dl className="mt-3.5 divide-y divide-hairline dark:divide-hairline-dark rounded-xl border border-hairline dark:border-hairline-dark bg-surface/70 px-3 dark:bg-white/[0.03]">
          <InfoRow label="Position" value={coordText} mono />
          <InfoRow label="Last signal" value={formatRelative(device.sampleTime)} />
        </dl>
      </header>

      {/* ── Tabs (sticky) ── */}
      <div className="flex shrink-0 border-b border-hairline dark:border-hairline-dark px-3">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={clsx(
              'relative flex-1 px-2 py-3 text-xs font-bold uppercase tracking-wider transition-colors',
              activeTab === tab
                ? 'text-brand-600 dark:text-brand-400'
                : 'text-subtle hover:text-muted dark:text-subtle-dark dark:hover:text-muted-dark'
            )}
          >
            {tab}
            {activeTab === tab && (
              <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-brand-500 dark:bg-brand-400" />
            )}
          </button>
        ))}
      </div>

      {/* ── Scroll area ── */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">

        {/* ═══ TRACKING ═══ */}
        {activeTab === 'tracking' && (
          <div className="space-y-5 p-5">

            {/* Controls */}
            <div className="flex items-center justify-between">
              <button
                onClick={fetchHistory}
                disabled={loading}
                className="group inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-subtle transition-colors hover:text-muted disabled:opacity-50 dark:text-subtle-dark dark:hover:text-muted-dark"
                title="Sync latest history"
              >
                <RefreshCw className={clsx('h-3.5 w-3.5 transition-transform group-active:-rotate-180', loading && 'animate-spin')} />
                Refresh
              </button>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => changeDate(-1)}
                  className="rounded-md p-1 text-subtle transition-colors hover:bg-surface hover:text-muted active:scale-95 dark:text-subtle-dark dark:hover:bg-white/5 dark:hover:text-muted-dark"
                  title="Previous day"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => dateInputRef.current?.showPicker?.() || dateInputRef.current?.click()}
                  className="group flex items-center gap-1.5 rounded-lg border border-hairline bg-surface px-2.5 py-1.5 text-xs font-semibold text-muted transition-colors hover:border-brand-300 hover:bg-brand-50/60 hover:text-brand-600 dark:border-hairline-dark dark:bg-white/5 dark:text-muted-dark dark:hover:border-brand-400/50 dark:hover:bg-brand-400/10 dark:hover:text-brand-300"
                  title="Pick a date"
                >
                  <CalendarDays className="h-3.5 w-3.5 text-brand-400" />
                  {formatSelectedDate(selectedDate)}
                </button>
                <input
                  ref={dateInputRef}
                  type="date"
                  value={formatInputDate(selectedDate)}
                  onChange={(e) => {
                    if (e.target.value) {
                      onSelectedDateChange(new Date(e.target.value + 'T00:00:00'));
                    }
                  }}
                  className="pointer-events-none absolute h-0 w-0 opacity-0"
                />
                <button
                  onClick={() => changeDate(1)}
                  disabled={isToday}
                  className="rounded-md p-1 text-subtle transition-colors hover:bg-surface hover:text-muted active:scale-95 disabled:opacity-30 dark:text-subtle-dark dark:hover:bg-white/5 dark:hover:text-muted-dark"
                  title="Next day"
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {/* Horizontal activity bar */}
            <div>
              {timelineStart && (
                <div className="flex justify-between px-0.5 font-mono text-[10px] font-medium text-subtle dark:text-subtle-dark">
                  {timelineLabels.map((lbl, idx) => (
                    <span key={idx}>{lbl}</span>
                  ))}
                </div>
              )}
              <div className="relative mt-1.5 h-2.5 w-full overflow-hidden rounded-full bg-card-muted dark:bg-white/[0.06]">
                {timelineStart
                  ? timelineBars.map((bar, idx) => (
                    <div
                      key={idx}
                      className={clsx(
                        'absolute inset-y-0 transition-all duration-300',
                        bar.type === 'driving'
                          ? 'bg-brand-500 dark:bg-brand-400'
                          : 'bg-brand-500/25 dark:bg-brand-400/25'
                      )}
                      style={{ left: bar.left, width: bar.width }}
                    />
                  ))
                  : <div className="h-full w-full" />}
              </div>
              <div className="mt-2 flex items-center gap-4">
                <span className="inline-flex items-center gap-1.5 text-[10px] font-medium text-subtle dark:text-subtle-dark">
                  <span className="h-2 w-2 rounded-full bg-brand-500 dark:bg-brand-400" /> Driving
                </span>
                <span className="inline-flex items-center gap-1.5 text-[10px] font-medium text-subtle dark:text-subtle-dark">
                  <span className="h-2 w-2 rounded-full bg-brand-500/30 dark:bg-brand-400/30" /> Stopped
                </span>
              </div>
            </div>

            {/* Vertical event timeline */}
            {loading ? (
              <div className="space-y-5 pl-8">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="animate-pulse space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="h-3 w-20 rounded bg-card-muted dark:bg-white/10" />
                      <div className="h-3 w-10 rounded bg-card-muted dark:bg-white/5" />
                    </div>
                    <div className="h-3 w-5/6 rounded bg-card-muted dark:bg-white/5" />
                    <div className="h-4 w-24 rounded bg-card-muted dark:bg-white/5" />
                  </div>
                ))}
              </div>
            ) : events.length > 0 ? (
              <ol className="relative">
                {events.map((eventItem, index) => {
                  const key = eventItem.position ? geoKey(eventItem.position[1], eventItem.position[0]) : '';
                  const addr = addresses[key] || 'Resolving location…';
                  const isDriving = eventItem.type === 'driving';
                  const isLast = index === events.length - 1;
                  const isLive = index === 0 && device.status === 'active';

                  return (
                    <li key={index} className={clsx('relative pl-8', !isLast && 'pb-5')}>
                      {/* rail */}
                      {!isLast && (
                        <span className="absolute left-[10px] top-6 bottom-0 w-px bg-hairline dark:bg-hairline-dark" />
                      )}
                      {/* node */}
                      <span
                        className={clsx(
                          'absolute left-0 top-0.5 grid h-[21px] w-[21px] place-items-center rounded-full ring-4 ring-card dark:ring-card-dark',
                          isDriving
                            ? 'bg-brand-500 text-white dark:bg-brand-400 dark:text-[#16161b]'
                            : 'border-2 border-hairline bg-card dark:border-hairline-dark dark:bg-card-dark'
                        )}
                      >
                        {isDriving
                          ? <ChevronsRight className="h-3 w-3" strokeWidth={3} />
                          : <span className="h-1.5 w-1.5 rounded-full bg-subtle dark:bg-subtle-dark" />}
                      </span>

                      <div className="flex items-baseline justify-between gap-2">
                        <span className="flex items-center gap-1.5 text-sm font-bold text-ink dark:text-ink-dark">
                          {EVENT_LABEL[eventItem.type] || 'Update'}
                          {isLive && (
                            <span className="relative flex h-1.5 w-1.5">
                              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-500/70 dark:bg-brand-400/70" />
                              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-brand-500 dark:bg-brand-400" />
                            </span>
                          )}
                        </span>
                        <span className="shrink-0 font-mono text-xs font-medium text-subtle dark:text-subtle-dark">
                          {eventItem.time}
                        </span>
                      </div>

                      <p className="mt-1 flex items-start gap-1.5 text-xs leading-snug text-muted dark:text-muted-dark">
                        <MapPin className="mt-0.5 h-3 w-3 shrink-0 text-subtle dark:text-subtle-dark" />
                        <span className="line-clamp-2">{addr}</span>
                      </p>

                      {(eventItem.speed || eventItem.duration || eventItem.distance) ? (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {eventItem.speed ? (
                            <MetricChip icon={Gauge}>{eventItem.speed}</MetricChip>
                          ) : null}
                          {eventItem.duration ? (
                            <MetricChip icon={Clock} tone="neutral">{eventItem.duration}</MetricChip>
                          ) : null}
                          {eventItem.distance ? (
                            <MetricChip icon={Route}>{eventItem.distance}</MetricChip>
                          ) : null}
                        </div>
                      ) : null}
                    </li>
                  );
                })}
              </ol>
            ) : (
              <div className="rounded-2xl border border-dashed border-hairline dark:border-hairline-dark px-4 py-8 text-center">
                <div className="mx-auto grid h-10 w-10 place-items-center rounded-full bg-surface dark:bg-white/5">
                  <Route className="h-4 w-4 text-subtle dark:text-subtle-dark" />
                </div>
                <p className="mt-3 text-xs font-bold text-muted dark:text-muted-dark">No movement recorded</p>
                <p className="mx-auto mt-1 max-w-[220px] text-xs leading-relaxed text-subtle dark:text-subtle-dark">
                  This vehicle sent no position updates on {formatSelectedDate(selectedDate)}. Try another day.
                </p>
              </div>
            )}
          </div>
        )}

        {/* ═══ ANALYTICS ═══ */}
        {activeTab === 'analytics' && (
          <div className="space-y-4 p-5">
            <div className="flex items-center gap-2">
              <Sparkles className="h-3.5 w-3.5 text-brand-500 dark:text-brand-400" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-subtle dark:text-subtle-dark">
                Summary · {formatSelectedDate(selectedDate)}
              </h3>
            </div>

            {loading ? (
              <div className="animate-pulse space-y-3">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-9 rounded-xl bg-card-muted dark:bg-white/5" />
                ))}
              </div>
            ) : daySummary ? (
              <dl className="divide-y divide-hairline dark:divide-hairline-dark rounded-2xl border border-hairline dark:border-hairline-dark bg-surface/50 px-4 dark:bg-white/[0.02]">
                <InfoRow label="Distance travelled" value={`${daySummary.distanceKm.toFixed(1)} km`} mono />
                <InfoRow label="Time driving" value={`${daySummary.driveMin} min`} mono />
                <InfoRow label="Time stopped" value={`${daySummary.stopMin} min`} mono />
                <InfoRow label="Stops" value={daySummary.stops} mono />
                <InfoRow label="Top speed" value={`${daySummary.topKmh} km/h`} mono />
                <InfoRow label="Position pings" value={daySummary.points} mono />
              </dl>
            ) : (
              <div className="rounded-2xl border border-dashed border-hairline dark:border-hairline-dark px-4 py-8 text-center">
                <div className="mx-auto grid h-10 w-10 place-items-center rounded-full bg-surface dark:bg-white/5">
                  <Gauge className="h-4 w-4 text-subtle dark:text-subtle-dark" />
                </div>
                <p className="mt-3 text-xs font-bold text-muted dark:text-muted-dark">Not enough data</p>
                <p className="mx-auto mt-1 max-w-[220px] text-xs leading-relaxed text-subtle dark:text-subtle-dark">
                  A day with at least two position updates is needed to compute a trip summary.
                </p>
              </div>
            )}
          </div>
        )}

        {/* ═══ DETAILS ═══ */}
        {activeTab === 'details' && (
          <div className="p-5">
            <dl className="divide-y divide-hairline dark:divide-hairline-dark rounded-2xl border border-hairline dark:border-hairline-dark bg-surface/50 px-4 dark:bg-white/[0.02]">
              <InfoRow label="Device ID" value={device.deviceId || '—'} mono />
              <InfoRow label="Registered name" value={device.displayName || '—'} />
              <InfoRow label="Vehicle type" value={device.type ? device.type[0].toUpperCase() + device.type.slice(1) : '—'} />
              {device.licensePlate && <InfoRow label="License plate" value={device.licensePlate} mono />}
              <InfoRow
                label="Coordinates"
                value={device.position ? `${device.position[1].toFixed(6)}, ${device.position[0].toFixed(6)}` : '—'}
                mono
              />
              {device.accuracy?.Horizontal != null && (
                <InfoRow label="Accuracy" value={`±${Math.round(device.accuracy.Horizontal)} m`} mono />
              )}
              <InfoRow
                label="Last sample"
                value={device.sampleTime ? new Date(device.sampleTime).toLocaleString() : '—'}
              />
            </dl>
          </div>
        )}
      </div>
    </div>
  );
}
