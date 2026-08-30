/**
 * Shared live-map diagram, reused across sections so it reads as one
 * signature element rather than decoration. This is an honest illustrative
 * diagram (roads, route, marker), not a fake app-screenshot mockup.
 */
export default function MapBackdrop({ children, className = '', viewBox = '0 0 600 400' }) {
  return (
    <svg viewBox={viewBox} className={className} fill="none">
      {/* Minor streets */}
      <g stroke="currentColor" strokeWidth="1.5" className="text-slate-200 dark:text-zinc-800">
        {[60, 200, 340].map((y) => (
          <line key={`h${y}`} x1="0" y1={y} x2="600" y2={y} />
        ))}
        {[80, 300, 500].map((x) => (
          <line key={`v${x}`} x1={x} y1="0" x2={x} y2="400" />
        ))}
      </g>
      {/* Major streets */}
      <g stroke="currentColor" strokeWidth="2.5" className="text-slate-300 dark:text-zinc-700">
        <line x1="0" y1="120" x2="600" y2="120" />
        <line x1="0" y1="280" x2="600" y2="280" />
        <line x1="180" y1="0" x2="180" y2="400" />
        <line x1="420" y1="0" x2="420" y2="400" />
      </g>

      {children}
    </svg>
  );
}

export function PulseMarker({ x, y, color = '#6366F1' }) {
  return (
    <g>
      <circle cx={x} cy={y} r="16" fill={color} opacity="0.18">
        <animate attributeName="r" values="10;26;10" dur="2.6s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0.35;0;0.35" dur="2.6s" repeatCount="indefinite" />
      </circle>
      <circle cx={x} cy={y} r="7" fill={color} stroke="white" strokeWidth="2.5" className="dark:stroke-zinc-950" />
    </g>
  );
}

/**
 * Draws `path` with a stroke that animates in once (dash-offset reveal), so
 * the route reads as "being tracked" rather than a static line. Pair with
 * VehicleOnPath using the same `path`/`duration` so the vehicle icon leads
 * the reveal.
 */
export function TrackedRoute({ path, color = '#6664d8', duration = 8, strokeWidth = 3.5 }) {
  return (
    <path
      d={path}
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
      pathLength="100"
      strokeDasharray="100"
      strokeDashoffset="100"
    >
      <animate
        attributeName="stroke-dashoffset"
        from="100"
        to="0"
        dur={`${duration}s`}
        repeatCount="indefinite"
        calcMode="linear"
      />
    </path>
  );
}

/**
 * A vehicle glyph (motorbike or car) that travels along an SVG path on a
 * continuous loop via native SMIL animateMotion — no animation library, no
 * fake screenshot, just the same honest route diagram in motion. Emits a
 * short fading trail behind it so the movement reads clearly at a glance.
 */
export function VehicleOnPath({ path, color = '#6664d8', duration = 8, vehicle = 'motorbike', scale = 1 }) {
  const isCar = vehicle === 'car';

  return (
    <g>
      {/* Soft trailing glow, offset slightly behind the vehicle on the same path/timing */}
      <circle r="9" fill={color} opacity="0.16">
        <animateMotion path={path} dur={`${duration}s`} repeatCount="indefinite" begin="-0.15s" rotate="auto" />
      </circle>

      <g transform={`scale(${scale})`} style={{ transformOrigin: 'center' }}>
        <g>
          <animateMotion path={path} dur={`${duration}s`} repeatCount="indefinite" rotate="auto" />
          {/* Vehicle glyph, drawn nose-first along +x so `rotate="auto"` aligns it with travel direction */}
          <g filter="url(#vehicle-shadow)">
            <circle r="11" fill="white" className="dark:fill-[#222229]" />
            {isCar ? (
              <path
                d="M-7,2 L-5,-3 Q-3,-5 2,-5 L6,-2 L7,1 L7,3 L-7,3 Z M-4,-1.5 H5"
                fill={color}
                stroke={color}
                strokeWidth="1"
                strokeLinejoin="round"
              />
            ) : (
              <path
                d="M-6,3 L-2,-1 L1,-1 L2,-4 L5,-4 M-2,-1 L3,2 M-6,3 a2,2 0 1,0 0.1,0 M5,2 a2,2 0 1,0 0.1,0"
                fill="none"
                stroke={color}
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}
          </g>
        </g>
      </g>

      <defs>
        <filter id="vehicle-shadow" x="-150%" y="-150%" width="400%" height="400%">
          <feDropShadow dx="0" dy="1" stdDeviation="1.2" floodColor="#000000" floodOpacity="0.25" />
        </filter>
      </defs>
    </g>
  );
}
