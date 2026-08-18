import { cn } from "../../utils/cn.js";

/**
 * Map-themed animated background: a stylised dark map with a street grid,
 * two pins (A → B) and an animated route path between them. Purely
 * decorative (aria-hidden) and disabled under prefers-reduced-motion.
 */
export function MapBackground({
  className = "",
  opacity = "opacity-60",
}: {
  className?: string;
  opacity?: string;
}) {
  return (
    <div
      aria-hidden="true"
      className={cn("pointer-events-none absolute inset-0 select-none overflow-hidden", className)}
    >
      <svg
        className={cn("absolute inset-0 h-full w-full", opacity)}
        viewBox="0 0 1440 900"
        preserveAspectRatio="xMidYMid slice"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <pattern id="ax-map-grid" width="60" height="60" patternUnits="userSpaceOnUse">
            <path
              d="M 60 0 L 0 0 0 60"
              fill="none"
              stroke="rgba(255,255,255,0.045)"
              strokeWidth="1"
            />
          </pattern>
          <pattern id="ax-map-minor-grid" width="15" height="15" patternUnits="userSpaceOnUse">
            <path
              d="M 15 0 L 0 0 0 15"
              fill="none"
              stroke="rgba(255,255,255,0.018)"
              strokeWidth="1"
            />
          </pattern>
          <radialGradient id="ax-map-glow" cx="50%" cy="42%" r="55%">
            <stop offset="0%" stopColor="rgba(0,113,227,0.10)" />
            <stop offset="60%" stopColor="rgba(0,113,227,0.03)" />
            <stop offset="100%" stopColor="transparent" />
          </radialGradient>
          <linearGradient id="ax-route-fade" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#2997ff" stopOpacity="0" />
            <stop offset="18%" stopColor="#2997ff" stopOpacity="0.9" />
            <stop offset="82%" stopColor="#0071e3" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#0071e3" stopOpacity="0" />
          </linearGradient>
          <filter id="ax-route-blur" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="3" />
          </filter>
        </defs>

        <rect width="1440" height="900" fill="#000000" />
        <rect width="1440" height="900" fill="url(#ax-map-minor-grid)" />
        <rect width="1440" height="900" fill="url(#ax-map-grid)" />
        <rect width="1440" height="900" fill="url(#ax-map-glow)" />

        {/* Streets / blocks */}
        <g stroke="#1f2124" strokeWidth="2" fill="none">
          <path d="M 80 0 L 60 240 L 150 420 L 120 900" />
          <path d="M 0 180 L 320 160 L 640 220 L 900 130 L 1440 200" />
          <path d="M 0 520 L 220 480 L 560 560 L 1440 500" />
          <path d="M 700 0 L 660 200 L 720 420 L 680 900" />
          <path d="M 1100 0 L 1050 260 L 1120 520 L 1080 900" />
          <path d="M 0 760 L 340 700 L 820 780 L 1440 720" />
        </g>
        <g stroke="#26282c" strokeWidth="1.2" fill="none">
          <path d="M 240 160 L 320 320 L 300 420" />
          <path d="M 400 380 L 560 430 L 700 400" />
          <path d="M 860 260 L 980 360 L 1120 330" />
          <path d="M 120 560 L 260 620 L 400 580" />
          <path d="M 520 620 L 640 680 L 760 640" />
          <path d="M 980 560 L 1140 600 L 1320 560" />
        </g>

        {/* Route path: A → B, self-drawing dashes */}
        <path
          d="M 300 660 C 360 620, 400 560, 500 540 C 620 515, 640 430, 760 400 C 900 365, 1010 300, 1120 250"
          fill="none"
          stroke="url(#ax-route-fade)"
          strokeWidth="2.5"
          strokeLinecap="round"
          className="ax-map-route"
        />
        <path
          d="M 300 660 C 360 620, 400 560, 500 540 C 620 515, 640 430, 760 400 C 900 365, 1010 300, 1120 250"
          fill="none"
          stroke="rgba(41,151,255,0.35)"
          strokeWidth="10"
          strokeLinecap="round"
          filter="url(#ax-route-blur)"
          className="ax-map-route"
        />

        {/* Destination pin (B) */}
        <g transform="translate(1120,250)">
          <circle r="26" fill="none" stroke="rgba(0,113,227,0.5)" strokeWidth="1.5" className="ax-map-ping" />
          <circle r="13" fill="#0071e3" stroke="rgba(255,255,255,0.85)" strokeWidth="2" />
          <text y="4.5" textAnchor="middle" fontSize="13" fontWeight="700" fill="#ffffff" fontFamily="inherit">
            B
          </text>
        </g>

        {/* Start pin (A) */}
        <g transform="translate(300,660)">
          <circle r="26" fill="none" stroke="rgba(41,151,255,0.5)" strokeWidth="1.5" className="ax-map-ping" />
          <circle r="13" fill="#2997ff" stroke="rgba(255,255,255,0.85)" strokeWidth="2" />
          <text y="4.5" textAnchor="middle" fontSize="13" fontWeight="700" fill="#ffffff" fontFamily="inherit">
            A
          </text>
        </g>

        {/* Faint building blocks */}
        <g fill="#141416">
          <rect x="170" y="230" width="70" height="46" rx="6" />
          <rect x="270" y="210" width="90" height="60" rx="6" />
          <rect x="470" y="470" width="80" height="52" rx="6" />
          <rect x="760" y="330" width="86" height="48" rx="6" />
          <rect x="920" y="200" width="64" height="44" rx="6" />
          <rect x="1030" y="470" width="90" height="56" rx="6" />
          <rect x="1210" y="280" width="70" height="42" rx="6" />
        </g>

        {/* Vignette: darken edges so content stays readable */}
        <rect width="1440" height="900" fill="url(#ax-map-vignette)" />
        <defs>
          <radialGradient id="ax-map-vignette" cx="50%" cy="45%" r="75%">
            <stop offset="55%" stopColor="transparent" />
            <stop offset="100%" stopColor="rgba(0,0,0,0.65)" />
          </radialGradient>
        </defs>
      </svg>
    </div>
  );
}