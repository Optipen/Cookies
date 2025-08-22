import React, { useEffect, useMemo, useRef, useState } from "react";

// ViewBox constants
const VIEWBOX_SIZE = 100, CENTER_X = 50, CENTER_Y = 50, COOKIE_R = 46;
// crocs plus visibles + progressifs
const BITE_R_BASE_MIN = 7;
const BITE_R_BASE_MAX = 18;
const BITE_SEGMENTS = 18;
const GOLDEN_ANGLE = 2.3999632297; // radians

function mulberry32(seed) {
  let t = seed >>> 0;
  return function () {
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function randRange(rng, min, max) {
  return min + (max - min) * rng();
}

function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}

// Build irregular polygon path for a single bite using a deterministic RNG per bite
function buildBitePath({ x, y, r, seed }) {
  const rng = mulberry32(seed);
  const pts = [];
  for (let i = 0; i < BITE_SEGMENTS; i++) {
    const a = (i / BITE_SEGMENTS) * Math.PI * 2;
    const radiusJitter = 0.6 + rng() * 0.4; // 0.6–1.0
    const rr = r * radiusJitter;
    const px = x + Math.cos(a) * rr;
    const py = y + Math.sin(a) * rr;
    pts.push(`${px.toFixed(3)},${py.toFixed(3)}`);
  }
  if (!pts.length) return "";
  return `M ${pts[0]} L ${pts.slice(1).join(" ")} Z`;
}

export default function CookieBiteMask({ skinSrc, clicks, bitesTotal = 80, onFinished, enabled = true, ...rest }) {
  const [bites, setBites] = useState([]);
  const prevClicksRef = useRef(clicks || 0);

  // sessionSeed for deterministic per-session RNG; increment per new bite
  const sessionSeedRef = useRef((Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0);
  const nextSeedRef = useRef(sessionSeedRef.current);

  // Derived RNG for global placement jitter
  const placementRng = useRef(mulberry32(sessionSeedRef.current));

  const addBite = () => {
    setBites((arr) => {
      if (arr.length >= bitesTotal) return arr;
      const k = arr.length;
      const thetaBase = (k * GOLDEN_ANGLE) % (Math.PI * 2);
      const theta = thetaBase + randRange(placementRng.current, -0.22, 0.22);
      // progression 0..1
      const p = Math.min(1, k / Math.max(1, bitesTotal - 1));
      // rayon du croc augmente avec la progression
      const rMin = BITE_R_BASE_MIN;
      const rMax = BITE_R_BASE_MAX;
      const r = rMin + (rMax - rMin) * p * 0.9; // plus grand vers la fin

      // on mord de plus en plus vers l'intérieur
      const inset = 0.35 + 0.75 * p; // ~0.35 -> ~1.1
      const rho = Math.max(0, COOKIE_R - r * inset);
      const x = CENTER_X + rho * Math.cos(theta);
      const y = CENTER_Y + rho * Math.sin(theta);
      const seed = (nextSeedRef.current = (nextSeedRef.current + 1) >>> 0);
      const bite = { x, y, r, seed };
      const next = [...arr, bite];
      if (next.length >= bitesTotal) {
        // ① micro-crocs irréguliers au centre pour éviter les filaments (toujours des paths)
        const extra = [];
        for (let i = 0; i < 8; i++) {
          const rr = 2.5 + Math.random() * 3.0;
          const theta2 = Math.random() * Math.PI * 2;
          const rad = (COOKIE_R * 0.25) * Math.random();
          const x2 = CENTER_X + Math.cos(theta2) * rad;
          const y2 = CENTER_Y + Math.sin(theta2) * rad;
          extra.push({ x: x2, y: y2, r: rr, seed: (nextSeedRef.current = (nextSeedRef.current + 1) >>> 0) });
        }
        const done = [...next, ...extra];
        // ② on termine après un léger délai
        setTimeout(() => {
          try { onFinished && onFinished(); } catch {}
          setBites([]);
          prevClicksRef.current = clicks || 0;
        }, 80);
        return done;
      }
      return next;
    });
  };

  // Map click increments → add a bite every 2 clicks
  useEffect(() => {
    if (!enabled) {
      prevClicksRef.current = clicks || 0;
      return;
    }
    const prev = prevClicksRef.current || 0;
    const curr = clicks || 0;
    if (curr > prev) {
      // Add bites for each even click crossed (supports large deltas safely)
      for (let c = prev + 1; c <= curr; c++) {
        if (c % 2 === 0) addBite();
      }
      prevClicksRef.current = curr;
    }
  }, [clicks, enabled]);

  const bitePaths = useMemo(() => bites.map((b) => buildBitePath(b)), [bites]);

  return (
    <div role="img" aria-label="Cookie" {...rest}>
      <svg viewBox={`0 0 ${VIEWBOX_SIZE} ${VIEWBOX_SIZE}`} width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" style={{ display: "block" }}>
        <defs>
          <mask id="cookieMask">
            <rect x="0" y="0" width={VIEWBOX_SIZE} height={VIEWBOX_SIZE} fill="black" />
            <circle cx={CENTER_X} cy={CENTER_Y} r={COOKIE_R} fill="white" />
            {bitePaths.map((d, i) => (
              <path key={i} d={d} fill="black" />
            ))}
          </mask>
        </defs>
        <image href={skinSrc} x="0" y="0" width={VIEWBOX_SIZE} height={VIEWBOX_SIZE} preserveAspectRatio="xMidYMid meet" mask="url(#cookieMask)" draggable="false" />
      </svg>
    </div>
  );
}


