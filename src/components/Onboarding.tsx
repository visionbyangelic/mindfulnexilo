import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";
import { ShieldCheck, ArrowRight } from "lucide-react";
import ResilienceWave from "./ResilienceWave";

/**
 * Onboarding — 3-screen Trust & Calibration ritual.
 *
 *   1. The Promise        →  "A sanctuary for your narrative."
 *   2. The Privacy        →  "Localized Sovereignty." (NDPR · Lagos)
 *   3. The Calibration    →  5-second Haptic Hold; ResilienceWave forms
 *
 * On completion calls onComplete() which mounts the main SafeHavenChat.
 *
 * NOTE: This screen reuses the existing ResilienceWave component for
 * the calibration visual — no duplicate wave engine is introduced.
 */

const HOLD_MS = 5000;
const EASE: [number, number, number, number] = [0.4, 0, 0.2, 1];

interface OnboardingProps {
  onComplete: () => void;
}

const PAGE_VARIANTS = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -16 },
};

const Onboarding = ({ onComplete }: OnboardingProps) => {
  const [step, setStep] = useState<0 | 1 | 2>(0);

  return (
    <div className="fixed inset-0 z-40 nexilo-shell-bg flex flex-col items-center justify-center overflow-hidden select-none">
      {/* Subtle progress dots */}
      <div className="absolute top-[max(env(safe-area-inset-top),1.25rem)] left-0 right-0 flex justify-center gap-2">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="block h-[3px] rounded-full transition-all duration-500"
            style={{
              width: step === i ? 28 : 14,
              background:
                step === i ? "rgba(16,185,129,0.85)" : "rgba(255,255,255,0.18)",
            }}
          />
        ))}
      </div>

      <AnimatePresence mode="wait">
        {step === 0 && (
          <PromiseScreen key="promise" onNext={() => setStep(1)} />
        )}
        {step === 1 && (
          <PrivacyScreen key="privacy" onNext={() => setStep(2)} />
        )}
        {step === 2 && (
          <CalibrationScreen key="calibration" onComplete={onComplete} />
        )}
      </AnimatePresence>
    </div>
  );
};

/* ────────────────────────  SCREEN 1 — THE PROMISE  ──────────────────────── */
const PromiseScreen = ({ onNext }: { onNext: () => void }) => (
  <motion.div
    variants={PAGE_VARIANTS}
    initial="initial"
    animate="animate"
    exit="exit"
    transition={{ duration: 0.7, ease: EASE }}
    className="flex flex-col items-center justify-center text-center px-8 max-w-[480px] w-full"
  >
    <div className="flex flex-col items-center gap-3 mb-12">
      <span className="font-light tracking-[0.42em] text-[11px] text-foreground/60">
        NEXILO
      </span>
      <span className="text-[9px] tracking-[0.32em] uppercase text-muted-foreground/70">
        A Safe Haven
      </span>
    </div>

    <h1
      className="font-serif text-[34px] leading-[1.18] text-foreground/95 mb-3"
      style={{ fontFamily: '"Playfair Display", Georgia, serif', fontWeight: 400 }}
    >
      A sanctuary for
      <br />
      your narrative.
    </h1>
    <p className="text-[12px] tracking-[0.04em] text-muted-foreground/85 max-w-[280px] mb-14 leading-relaxed">
      A breath-led space, designed for the moments words feel too heavy to carry alone.
    </p>

    <motion.button
      type="button"
      onClick={onNext}
      whileTap={{ scale: 0.97 }}
      className="relative inline-flex items-center gap-2 px-7 h-12 rounded-full text-[11px] tracking-[0.28em] uppercase text-primary-foreground"
      style={{
        background: "#10B981",
        boxShadow:
          "0 0 24px rgba(16,185,129,0.45), 0 8px 24px -6px rgba(16,185,129,0.55), inset 0 1px 1px rgba(255,255,255,0.18)",
        animation: "send-glow-calm 4s ease-in-out infinite",
      }}
    >
      Begin
      <ArrowRight className="w-3.5 h-3.5" strokeWidth={1.75} />
    </motion.button>
  </motion.div>
);

/* ────────────────────────  SCREEN 2 — THE PRIVACY  ──────────────────────── */
const PrivacyScreen = ({ onNext }: { onNext: () => void }) => (
  <motion.div
    variants={PAGE_VARIANTS}
    initial="initial"
    animate="animate"
    exit="exit"
    transition={{ duration: 0.7, ease: EASE }}
    className="flex flex-col items-center justify-center text-center px-8 max-w-[480px] w-full"
  >
    {/* Safe Box icon — softly pulsing */}
    <motion.div
      className="relative w-20 h-20 mb-10 flex items-center justify-center rounded-2xl"
      style={{
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(255,255,255,0.08)",
        backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
      }}
      animate={{
        boxShadow: [
          "0 0 0 rgba(16,185,129,0)",
          "0 0 28px rgba(16,185,129,0.35)",
          "0 0 0 rgba(16,185,129,0)",
        ],
      }}
      transition={{ duration: 3.4, repeat: Infinity, ease: "easeInOut" }}
    >
      <ShieldCheck className="w-8 h-8 text-emerald-400/85" strokeWidth={1.4} />
    </motion.div>

    <h2
      className="font-serif text-[28px] leading-tight text-foreground/95 mb-3"
      style={{ fontFamily: '"Playfair Display", Georgia, serif', fontWeight: 400 }}
    >
      Localized Sovereignty.
    </h2>
    <p className="text-[12px] text-muted-foreground/85 max-w-[300px] leading-relaxed mb-3">
      <span className="text-foreground/80">NDPR Encrypted.</span> Your data is
      pinned to Lagos Residency servers.
    </p>
    <p className="text-[11px] tracking-[0.18em] uppercase text-foreground/55 mb-14">
      It never leaves home.
    </p>

    <motion.button
      type="button"
      onClick={onNext}
      whileTap={{ scale: 0.97 }}
      className="inline-flex items-center gap-2 px-7 h-11 rounded-full text-[10px] tracking-[0.28em] uppercase text-foreground/85"
      style={{
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.1)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
      }}
    >
      Continue
      <ArrowRight className="w-3 h-3" strokeWidth={1.75} />
    </motion.button>
  </motion.div>
);

/* ────────────────────────  SCREEN 3 — CALIBRATION  ──────────────────────── */
const CalibrationScreen = ({ onComplete }: { onComplete: () => void }) => {
  const [progress, setProgress] = useState(0);
  const [holding, setHolding] = useState(false);
  const [done, setDone] = useState(false);
  const startRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);

  const stop = () => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    startRef.current = null;
  };

  const tick = useCallback(() => {
    if (startRef.current === null) return;
    const elapsed = performance.now() - startRef.current;
    const pct = Math.min(elapsed / HOLD_MS, 1);
    setProgress(pct);
    if (pct >= 1) {
      stop();
      setHolding(false);
      setDone(true);
      try { navigator.vibrate?.(40); } catch { /* no-op */ }
      window.setTimeout(onComplete, 1100);
      return;
    }
    rafRef.current = requestAnimationFrame(tick);
  }, [onComplete]);

  const handleDown = (e: React.PointerEvent) => {
    if (done) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    setHolding(true);
    startRef.current = performance.now();
    rafRef.current = requestAnimationFrame(tick);
  };
  const handleUp = () => {
    if (done) return;
    if (holding && progress < 1) {
      stop();
      setHolding(false);
      setProgress(0);
    }
  };

  useEffect(() => () => stop(), []);

  // Ring math
  const size = 76;
  const stroke = 2.5;
  const r = (size - stroke) / 2;
  const C = 2 * Math.PI * r;

  return (
    <motion.div
      variants={PAGE_VARIANTS}
      initial="initial"
      animate="animate"
      exit={{ opacity: 0, scale: 1.05 }}
      transition={{ duration: 0.7, ease: EASE }}
      className="flex flex-col items-center justify-between text-center w-full max-w-[480px] h-full py-[14vh]"
    >
      <div className="flex flex-col items-center gap-3 px-8">
        <h3
          className="font-serif text-[26px] text-foreground/95"
          style={{ fontFamily: '"Playfair Display", Georgia, serif', fontWeight: 400 }}
        >
          Setting the Baseline.
        </h3>
        <p className="text-[12px] text-muted-foreground/85 max-w-[280px] leading-relaxed">
          Hold the anchor for five seconds. The wave will form as you do.
        </p>
      </div>

      {/* Holding Anchor */}
      <div
        role="button"
        aria-label="Hold for five seconds to calibrate"
        tabIndex={0}
        onPointerDown={handleDown}
        onPointerUp={handleUp}
        onPointerCancel={handleUp}
        onPointerLeave={handleUp}
        className="relative cursor-pointer touch-none"
        style={{ width: size, height: size }}
      >
        <svg
          width={size}
          height={size}
          className="-rotate-90"
          style={{
            filter: done
              ? "drop-shadow(0 0 14px rgba(16,185,129,0.85))"
              : holding
                ? "drop-shadow(0 0 8px rgba(16,185,129,0.45))"
                : "none",
            transition: "filter 400ms cubic-bezier(0.4,0,0.2,1)",
          }}
          aria-hidden
        >
          <circle
            cx={size / 2} cy={size / 2} r={r} fill="none"
            stroke="rgba(255,255,255,0.18)" strokeWidth={stroke}
          />
          <circle
            cx={size / 2} cy={size / 2} r={r} fill="none"
            stroke="#10B981" strokeWidth={stroke} strokeLinecap="round"
            strokeDasharray={C} strokeDashoffset={C * (1 - progress)}
            style={{ transition: holding ? "none" : "stroke-dashoffset 400ms cubic-bezier(0.4,0,0.2,1)" }}
          />
        </svg>
        <span
          className="absolute inset-0 flex items-center justify-center text-[9px] tracking-[0.28em] uppercase text-foreground/65"
        >
          {done ? "Set" : holding ? "Hold" : "Press"}
        </span>
      </div>

      {/* Wave forms in as the user holds — opacity tracks hold progress */}
      <div
        className="relative w-full h-[28vh] pointer-events-none"
        style={{
          opacity: done ? 1 : 0.15 + progress * 0.85,
          transition: "opacity 0.4s cubic-bezier(0.4,0,0.2,1)",
        }}
      >
        <ResilienceWave triageState="calm" />
      </div>
    </motion.div>
  );
};

export default Onboarding;
