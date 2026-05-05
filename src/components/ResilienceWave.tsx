import { memo, useEffect, useRef } from "react";
import { motion } from "framer-motion";

/**
 * ResilienceWave — Non-Iatrogenic affective feedback.
 *
 *   y = A · sin(2π f t + φ)
 *
 * Two stacked paths (primary + ghost) form the "Liquid Light" depth.
 * Triage state morphs amplitude / frequency / color / blur over 3s using
 * a [0.4, 0, 0.2, 1] cubic-bezier — never abrupt, never alarming.
 */

export type TriageState = "calm" | "alert" | "crisis";

interface ResilienceWaveProps {
  triageState?: TriageState;
  /** Optional override; otherwise derived from triageState. */
  color?: string;
}

const SAMPLE_COUNT = 140;
const VIEW_W = 480;
const VIEW_H = 200;
const BASELINE = VIEW_H * 0.6;

/**
 * Per-state physical parameters. Values are interpolated over 3s on change.
 * Frequency stored in Hz (cycles/sec); amplitude in SVG px.
 */
const STATE_PRESETS: Record<
  TriageState,
  {
    amplitude: number;
    frequency: number; // Hz, drives both spatial waveform & temporal advance
    color: string;
    blur: number; // SVG stdDeviation on the path itself
    glow: number; // Drop-shadow blur radius
  }
> = {
  calm:   { amplitude: 15, frequency: 0.5,  color: "#10B981", blur: 0,  glow: 6  }, // Emerald — sharp, steady breath
  alert:  { amplitude: 25, frequency: 1.2,  color: "#FFB84D", blur: 0,  glow: 10 }, // Topaz — energetic warning glow
  crisis: { amplitude: 45, frequency: 0.15, color: "#701A75", blur: 15, glow: 24 }, // Muted Plum — heavy oceanic swell
};

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const easeInOut = (t: number) =>
  t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

// Hex (#RRGGBB) → {r,g,b} for color interpolation.
const hexToRgb = (hex: string) => {
  const h = hex.replace("#", "");
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
};
const lerpColor = (a: string, b: string, t: number) => {
  const ca = hexToRgb(a);
  const cb = hexToRgb(b);
  const r = Math.round(lerp(ca.r, cb.r, t));
  const g = Math.round(lerp(ca.g, cb.g, t));
  const bl = Math.round(lerp(ca.b, cb.b, t));
  return `rgb(${r}, ${g}, ${bl})`;
};

const buildWavePath = (
  amplitude: number,
  spatialFrequency: number, // cycles across the viewbox
  phase: number,
  yOffset = 0,
) => {
  const k = (spatialFrequency * Math.PI * 2) / VIEW_W;
  let d = "";
  for (let i = 0; i <= SAMPLE_COUNT; i++) {
    const x = (i / SAMPLE_COUNT) * VIEW_W;
    const y = BASELINE + yOffset + amplitude * Math.sin(k * x + phase);
    d += i === 0
      ? `M ${x.toFixed(2)} ${y.toFixed(2)}`
      : ` L ${x.toFixed(2)} ${y.toFixed(2)}`;
  }
  return d;
};

const buildFillPath = (linePath: string) =>
  `${linePath} L ${VIEW_W} ${VIEW_H} L 0 ${VIEW_H} Z`;

const ResilienceWaveBase = ({ triageState = "calm", color }: ResilienceWaveProps) => {
  const filterId = "resilience-glow";
  const blurFilterId = "resilience-viscosity";
  const gradientId = "resilience-fill";

  const primaryRef = useRef<SVGPathElement | null>(null);
  const ghostRef = useRef<SVGPathElement | null>(null);
  const fillRef = useRef<SVGPathElement | null>(null);
  const blurNodeRef = useRef<SVGFEGaussianBlurElement | null>(null);
  const glowNodeRef = useRef<SVGFEGaussianBlurElement | null>(null);
  const haloRef = useRef<HTMLDivElement | null>(null);

  // Morph state — interpolates between two presets over 3s.
  const fromRef = useRef<TriageState>(triageState);
  const toRef = useRef<TriageState>(triageState);
  const morphStartRef = useRef(performance.now());
  // Snapshot of current interpolated values, so mid-flight changes blend smoothly.
  const liveRef = useRef({ ...STATE_PRESETS[triageState] });

  useEffect(() => {
    // Freeze current live values as the new "from" so transitions are seamless
    // even if the user toggles state mid-morph.
    fromRef.current = "calm"; // sentinel; real values come from liveRef snapshot
    toRef.current = triageState;
    morphStartRef.current = performance.now();
    // snapshot current live values into a synthetic preset
    fromSnapshot.current = { ...liveRef.current };
  }, [triageState]);

  // Snapshot of values at the moment of state change (continuous morphing).
  const fromSnapshot = useRef({ ...STATE_PRESETS[triageState] });

  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const MORPH_MS = 3000;

    const tick = (now: number) => {
      const t = (now - start) / 1000; // seconds since mount

      // Morph progress 0..1 (eased)
      const morphP = Math.min(1, (now - morphStartRef.current) / MORPH_MS);
      const m = easeInOut(morphP);
      const target = STATE_PRESETS[toRef.current];
      const fromV = fromSnapshot.current;

      const A = lerp(fromV.amplitude, target.amplitude, m);
      const f = lerp(fromV.frequency, target.frequency, m);
      const blur = lerp(fromV.blur, target.blur, m);
      const glow = lerp(fromV.glow, target.glow, m);
      const stroke = color ?? lerpColor(fromV.color, target.color, m);

      liveRef.current = {
        amplitude: A,
        frequency: f,
        color: stroke,
        blur,
        glow,
      };

      // Spatial cycles across the viewbox derived from Hz and a base "speed".
      // Keeps the visible waveform tied to f while temporal motion uses 2πft.
      const spatialCycles = Math.max(0.6, f * 1.6);

      // φ = 2π f t — temporal phase advance.
      const phase = 2 * Math.PI * f * t;

      const primaryPath = buildWavePath(A, spatialCycles, phase, 0);
      const ghostPath = buildWavePath(A * 0.85, spatialCycles, phase + 0.6, -6);
      const fillPath = buildFillPath(primaryPath);

      const p = primaryRef.current;
      const g = ghostRef.current;
      const fl = fillRef.current;
      if (p) {
        p.setAttribute("d", primaryPath);
        p.setAttribute("stroke", stroke);
      }
      if (g) {
        g.setAttribute("d", ghostPath);
        g.setAttribute("stroke", stroke);
      }
      if (fl) {
        fl.setAttribute("d", fillPath);
      }
      if (blurNodeRef.current) {
        blurNodeRef.current.setAttribute("stdDeviation", blur.toFixed(2));
      }
      if (glowNodeRef.current) {
        glowNodeRef.current.setAttribute("stdDeviation", glow.toFixed(2));
      }
      if (haloRef.current) {
        haloRef.current.style.background = `radial-gradient(ellipse at center, ${stroke} 0%, transparent 65%)`;
      }

      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [color]);

  const initial = STATE_PRESETS[triageState];

  return (
    <motion.div
      className="absolute inset-0 overflow-hidden pointer-events-none"
      aria-hidden
      style={{ willChange: "transform", zIndex: 0 }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 1.2, ease: [0.4, 0, 0.2, 1] }}
    >
      {/* Soft halo behind the wave */}
      <div
        ref={haloRef}
        className="absolute -bottom-24 left-1/2 -translate-x-1/2 w-[140%] h-64 rounded-[50%] blur-3xl"
        style={{
          background: `radial-gradient(ellipse at center, ${initial.color} 0%, transparent 65%)`,
          opacity: 0.18,
        }}
      />

      <svg
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        preserveAspectRatio="none"
        className="absolute inset-0 w-full h-full"
        style={{ willChange: "transform" }}
      >
        <defs>
          {/* "Visual Viscosity" — Gaussian blur applied to the path itself.
              In Crisis mode this hits stdDeviation=15 for the cloud-like swell. */}
          <filter id={blurFilterId} x="-20%" y="-50%" width="140%" height="200%">
            <feGaussianBlur ref={blurNodeRef} stdDeviation={initial.blur} />
          </filter>

          {/* Drop-shadow style halo (separate from path-blur). */}
          <filter id={filterId} x="-20%" y="-50%" width="140%" height="200%">
            <feGaussianBlur ref={glowNodeRef} stdDeviation={initial.glow} result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={initial.color} stopOpacity="0.2" />
            <stop offset="100%" stopColor={initial.color} stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Area fill */}
        <path
          ref={fillRef}
          fill={`url(#${gradientId})`}
        />

        {/* Wave B — ghost (30% opacity, phase-offset for liquid depth) */}
        <path
          ref={ghostRef}
          fill="none"
          stroke={initial.color}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={0.3}
          filter={`url(#${blurFilterId})`}
        />

        {/* Wave A — primary (100% opacity), composited through both filters */}
        <path
          ref={primaryRef}
          fill="none"
          stroke={initial.color}
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={1}
          filter={`url(#${blurFilterId}) url(#${filterId})`}
        />
      </svg>
    </motion.div>
  );
};

const ResilienceWave = memo(ResilienceWaveBase);
export default ResilienceWave;
