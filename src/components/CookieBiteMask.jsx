import React, { memo, useEffect, useId, useRef, useState } from "react";

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
 * Le contour SVG est calculé une seule fois, au moment où la morsure apparaît,
 * puis stocké avec elle. Avant, les 80 contours (18 segments chacun) étaient
 * reconstruits à chaque rendu, soit ~1 400 points recalculés en continu.
 */
function CookieBiteMask({ skinSrc, clicks, bitesTotal = 80, onFinished, enabled = true, className }) {
  const [bites, setBites] = useState([]);
  const prevClicksRef = useRef(clicks || 0);
  // Graine tirée à la première morsure et non au rendu: un rendu est censé
  // être pur, et React peut en abandonner un.
  const seedRef = useRef(0);
  const rngRef = useRef(null);
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
    // Le compteur de clics de la PARTIE retombe à zéro à chaque renaissance.
    // Le repère restait alors bloqué sur l'ancien total et `curr <= prev` était
    // vrai à chaque clic: le cookie ne se faisait plus jamais croquer pour le
    // reste de la session. On repart du compteur neuf, cookie entier.
    if (curr < prev) {
      prevClicksRef.current = curr;
      finishedRef.current = false;
      setBites([]);
      return;
    }
    if (curr === prev) return;
    prevClicksRef.current = curr;

    const newBites = Math.floor(curr / CLICKS_PER_BITE) - Math.floor(prev / CLICKS_PER_BITE);
    if (newBites <= 0) return;

    if (!rngRef.current) {
      seedRef.current = (Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0;
      rngRef.current = mulberry32(seedRef.current);
    }

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
        const bite = { x: CENTER + rho * Math.cos(theta), y: CENTER + rho * Math.sin(theta), r, seed: seedRef.current };
        next.push({ seed: bite.seed, d: buildBitePath(bite) });
      }

      if (next.length >= bitesTotal) {
        // Quelques micro-morsures au centre pour ne pas laisser de filaments
        for (let i = 0; i < 8; i++) {
          const angle = rng() * Math.PI * 2;
          const rad = COOKIE_R * 0.25 * rng();
          seedRef.current = (seedRef.current + 1) >>> 0;
          const micro = {
            x: CENTER + Math.cos(angle) * rad,
            y: CENTER + Math.sin(angle) * rad,
            r: 2.5 + rng() * 3,
            seed: seedRef.current,
          };
          next.push({ seed: micro.seed, d: buildBitePath(micro) });
        }
        finishedRef.current = true;
        setTimeout(() => {
          try {
            onFinished?.();
          } finally {
            finishedRef.current = false;
            setBites([]);
          }
        }, 90);
      }
      return next;
    });
  }, [clicks, enabled, bitesTotal, onFinished]);

  return (
    <div className={className} aria-hidden="true">
      <svg viewBox={`0 0 ${VIEWBOX} ${VIEWBOX}`} width="100%" height="100%" style={{ display: "block" }}>
        <defs>
          <mask id={maskId}>
            <rect x="0" y="0" width={VIEWBOX} height={VIEWBOX} fill="black" />
            <circle cx={CENTER} cy={CENTER} r={COOKIE_R} fill="white" />
            {bites.map((p) => (
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
