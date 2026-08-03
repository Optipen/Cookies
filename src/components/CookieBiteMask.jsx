import React, { memo, useEffect, useId, useMemo, useRef, useState } from "react";

// Repère du SVG
const VIEWBOX = 100;
const CENTER = 50;
const COOKIE_R = 46;

// Morsures: de plus en plus grandes et de plus en plus vers le centre
const BITE_R_MIN = 7;
const BITE_R_MAX = 18;
const BITE_SEGMENTS = 18;
const GOLDEN_ANGLE = 2.3999632297; // rad — répartit les morsures sans les aligner
const CLICKS_PER_BITE = 2;

function mulberry32(seed) {
  let t = seed >>> 0;
  return function () {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

const randRange = (rng, min, max) => min + (max - min) * rng();

/** Contour irrégulier d'une morsure, déterministe pour un `seed` donné. */
function buildBitePath({ x, y, r, seed }) {
  const rng = mulberry32(seed);
  const pts = [];
  for (let i = 0; i < BITE_SEGMENTS; i++) {
    const a = (i / BITE_SEGMENTS) * Math.PI * 2;
    const rr = r * (0.6 + rng() * 0.4);
    pts.push(`${(x + Math.cos(a) * rr).toFixed(2)},${(y + Math.sin(a) * rr).toFixed(2)}`);
  }
  return `M ${pts[0]} L ${pts.slice(1).join(" ")} Z`;
}

/**
 * Le grand cookie qui se fait grignoter.
 *
 * Le chemin SVG de chaque morsure est mis en cache par `seed`: sans ça, les
 * 80 contours (18 segments chacun) étaient reconstruits à chaque nouvelle
 * bouchée, soit ~1 400 points recalculés tous les 2 clics.
 */
function CookieBiteMask({ skinSrc, clicks, bitesTotal = 80, onFinished, enabled = true, className }) {
  const [bites, setBites] = useState([]);
  const prevClicksRef = useRef(clicks || 0);
  const seedRef = useRef((Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0);
  const rngRef = useRef(mulberry32(seedRef.current));
  const pathCacheRef = useRef(new Map());
  const finishedRef = useRef(false);
  // `id` unique: plusieurs cookies à l'écran partageraient sinon le même masque
  const maskId = `cookie-mask-${useId().replace(/:/g, "")}`;

  useEffect(() => {
    if (!enabled) {
      prevClicksRef.current = clicks || 0;
      return;
    }
    const prev = prevClicksRef.current || 0;
    const curr = clicks || 0;
    if (curr <= prev) return;
    prevClicksRef.current = curr;

    const newBites = Math.floor(curr / CLICKS_PER_BITE) - Math.floor(prev / CLICKS_PER_BITE);
    if (newBites <= 0) return;

    setBites((arr) => {
      if (finishedRef.current || arr.length >= bitesTotal) return arr;
      const next = [...arr];
      const rng = rngRef.current;

      for (let n = 0; n < newBites && next.length < bitesTotal; n++) {
        const k = next.length;
        const theta = ((k * GOLDEN_ANGLE) % (Math.PI * 2)) + randRange(rng, -0.22, 0.22);
        const p = Math.min(1, k / Math.max(1, bitesTotal - 1));
        const r = BITE_R_MIN + (BITE_R_MAX - BITE_R_MIN) * p * 0.9;
        const rho = Math.max(0, COOKIE_R - r * (0.35 + 0.75 * p));
        seedRef.current = (seedRef.current + 1) >>> 0;
        next.push({ x: CENTER + rho * Math.cos(theta), y: CENTER + rho * Math.sin(theta), r, seed: seedRef.current });
      }

      if (next.length >= bitesTotal) {
        // Quelques micro-morsures au centre pour ne pas laisser de filaments
        for (let i = 0; i < 8; i++) {
          const angle = rng() * Math.PI * 2;
          const rad = COOKIE_R * 0.25 * rng();
          seedRef.current = (seedRef.current + 1) >>> 0;
          next.push({
            x: CENTER + Math.cos(angle) * rad,
            y: CENTER + Math.sin(angle) * rad,
            r: 2.5 + rng() * 3,
            seed: seedRef.current,
          });
        }
        finishedRef.current = true;
        setTimeout(() => {
          try {
            onFinished?.();
          } finally {
            pathCacheRef.current.clear();
            finishedRef.current = false;
            setBites([]);
          }
        }, 90);
      }
      return next;
    });
  }, [clicks, enabled, bitesTotal, onFinished]);

  const paths = useMemo(() => {
    const cache = pathCacheRef.current;
    return bites.map((b) => {
      let d = cache.get(b.seed);
      if (!d) {
        d = buildBitePath(b);
        cache.set(b.seed, d);
      }
      return { seed: b.seed, d };
    });
  }, [bites]);

  return (
    <div className={className} aria-hidden="true">
      <svg viewBox={`0 0 ${VIEWBOX} ${VIEWBOX}`} width="100%" height="100%" style={{ display: "block" }}>
        <defs>
          <mask id={maskId}>
            <rect x="0" y="0" width={VIEWBOX} height={VIEWBOX} fill="black" />
            <circle cx={CENTER} cy={CENTER} r={COOKIE_R} fill="white" />
            {paths.map((p) => (
              <path key={p.seed} d={p.d} fill="black" />
            ))}
          </mask>
        </defs>
        <image
          href={skinSrc}
          x="0"
          y="0"
          width={VIEWBOX}
          height={VIEWBOX}
          preserveAspectRatio="xMidYMid meet"
          mask={`url(#${maskId})`}
        />
      </svg>
    </div>
  );
}

export default memo(CookieBiteMask);
