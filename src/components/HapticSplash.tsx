import { useCallback, useEffect, useRef, useState } from "react";
import {
  AnimatePresence,
  motion,
  useMotionValue,
  useTransform,
  animate,
} from "framer-motion";

const HOLD_DURATION = 3000;
const EASE: [number, number, number, number] = [0.4, 0, 0.2, 1];
const IDLE_STROKE = "rgba(255, 255, 255, 0.2)";
const ACTIVE_STROKE = "#10B981";

interface HapticSplashProps {
  onComplete: () => void;
}

const HapticSplash = ({ onComplete }: HapticSplashProps) => {
  const [progress, setProgress] = useState(0);
  const [holding, setHolding] = useState(false);
  const [interrupted, setInterrupted] = useState(false);
  const [completed, setCompleted] = useState(false);

  const startRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);

  // Motion values for color interpolation (separate from React state to avoid re-renders).
  const colorProgress = useMotionValue(0);
  const strokeColor = useTransform(
    colorProgress,
    [0, 1],
    [IDLE_STROKE, ACTIVE_STROKE],
  );

  const stopLoop = () => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    startRef.current = null;
  };

  const tick = useCallback(() => {
    if (startRef.current === null) return;
    const elapsed = performance.now() - startRef.current;
    const pct = Math.min(elapsed / HOLD_DURATION, 1);
    setProgress(pct);
    if (pct >= 1) {
      stopLoop();
      setHolding(false);
      setCompleted(true);
      try {
        navigator.vibrate?.(200);
      } catch {
        /* haptics unsupported */
      }
      window.setTimeout(onComplete, 900);
      return;
    }
    rafRef.current = requestAnimationFrame(tick);
  }, [onComplete]);

  const handleDown = (e: React.PointerEvent) => {
    if (completed) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    setInterrupted(false);
    setHolding(true);
    startRef.current = performance.now();
    rafRef.current = requestAnimationFrame(tick);
    // Cubic-bezier interpolation of stroke color across the full 3s hold.
    animate(colorProgress, 1, { duration: HOLD_DURATION / 1000, ease: EASE });
  };

  const handleRelease = () => {
    if (completed) return;
    if (holding && progress < 1) {
      stopLoop();
      setHolding(false);
      setProgress(0);
      setInterrupted(true);
      // Quick 300ms fade back to muted grey-white — "connection lost".
      animate(colorProgress, 0, { duration: 0.3, ease: EASE });
    }
  };

  useEffect(() => () => stopLoop(), []);

  // SVG ring math — 64px Holding Anchor per spec.
  const size = 64;
  const stroke = 3;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - progress);

  return (
    <AnimatePresence>
      {!completed || progress < 1 ? (
        <motion.div
          key="splash"
          className="fixed inset-0 z-50 nexilo-bg flex items-center justify-center overflow-hidden select-none"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        />
      ) : null}

      <motion.div
        key="splash-content"
        className="fixed inset-0 z-50 nexilo-bg flex flex-col items-center justify-center overflow-hidden select-none touch-none"
        initial={{ opacity: 1 }}
        animate={completed ? { opacity: 0, scale: 1.4 } : { opacity: 1, scale: 1 }}
        transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
        onAnimationComplete={() => {
          /* parent handles unmount via onComplete */
        }}
      >
        {/* The Lungs — large blurred radial gradient breathing in 3s loop. */}
        <motion.div
          aria-hidden
          className="absolute pointer-events-none rounded-full"
          style={{
            width: 480,
            height: 480,
            background:
              "radial-gradient(circle, rgba(16,185,129,0.22) 0%, rgba(16,185,129,0.06) 40%, rgba(16,185,129,0) 70%)",
            filter: "blur(40px)",
          }}
          animate={{ scale: [0.9, 1.1, 0.9], opacity: [0.55, 0.9, 0.55] }}
          transition={{ duration: 3, ease: "easeInOut", repeat: Infinity }}
        />

        {/* Holding Anchor — 64px circle */}
        <motion.div
          role="button"
          aria-label="Hold for three seconds"
          tabIndex={0}
          onPointerDown={handleDown}
          onPointerUp={handleRelease}
          onPointerCancel={handleRelease}
          onPointerLeave={handleRelease}
          className="relative rounded-full cursor-pointer touch-none"
          style={{ width: size, height: size }}
          animate={{ scale: completed ? 1.35 : 1 }}
          transition={{ duration: 0.6, ease: EASE }}
        >
          {/* Progress ring — interpolated stroke color, glow on completion */}
          <motion.svg
            width={size}
            height={size}
            className="absolute inset-0 -rotate-90"
            style={{
              filter: completed
                ? "drop-shadow(0 0 10px #10B981)"
                : "drop-shadow(0 0 0px rgba(16,185,129,0))",
              transition: "filter 400ms cubic-bezier(0.4,0,0.2,1)",
            }}
            aria-hidden
          >
            {/* Idle track — full circle in muted grey-white */}
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={IDLE_STROKE}
              strokeWidth={stroke}
            />
            {/* Active progress — fills clockwise, color interpolates grey→emerald */}
            <motion.circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={strokeColor}
              strokeWidth={stroke}
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={dashOffset}
              style={{
                transition: holding
                  ? "none"
                  : "stroke-dashoffset 300ms cubic-bezier(0.4,0,0.2,1)",
              }}
            />
          </motion.svg>
        </motion.div>

        {/* Brand + instruction */}
        <div className="absolute top-[14%] flex flex-col items-center gap-2">
          <h1 className="text-foreground text-3xl font-light tracking-[0.4em]">
            NEXILO
          </h1>
          <p className="text-muted-foreground text-xs tracking-[0.25em] uppercase">
            A Safe Haven
          </p>
        </div>

        {/* Bottom message */}
        <div className="absolute bottom-[14%] h-12 flex items-center justify-center px-8 text-center">
          <AnimatePresence mode="wait">
            {interrupted ? (
              <motion.p
                key="interrupt"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.5 }}
                className="text-muted-foreground text-sm"
              >
                Take a breath. Hold for three seconds.
              </motion.p>
            ) : (
              <motion.p
                key="default"
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.7 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.6 }}
                className="text-muted-foreground text-xs tracking-[0.2em] uppercase"
              >
                {holding ? "Breathe in" : "Press and hold the ring"}
              </motion.p>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default HapticSplash;