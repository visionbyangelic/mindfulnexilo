import { useCallback, useEffect, useRef, useState } from "react";
import type { TriageState } from "@/components/ResilienceWave";

/**
 * useMockSimulation — Investor-demo "State Awareness" without a backend.
 *
 *  • Keyword Listener   → CRISIS triggers (overwhelmed, drowning, help…)
 *  • Behavioral Biomarker → averageKeystrokeLatency > 800ms → ALERT (hesitation)
 *  • Reset Phrases      → "i'm okay" / "thank you" → smooth 5s return to CALM
 *
 * The hook owns triage state internally and exposes a controlled
 * (value, onChange) input pair so the consuming component can wire it to
 * the existing chat composer with a single line.
 */

const CRISIS_KEYWORDS = [
  "overwhelmed",
  "drowning",
  "help",
  "scared",
  "alone",
  "panic",
  "panicking",
  "can't breathe",
  "cant breathe",
  "hopeless",
  "suicidal",
];

const RESET_PHRASES = ["i'm okay", "im okay", "i am okay", "thank you", "thanks"];

const LATENCY_WINDOW = 6;          // sliding window of keystroke intervals
const HESITATION_THRESHOLD_MS = 800;
const RESET_FADE_MS = 5000;        // smooth reset duration
const RESET_TICK_STEPS = 3;        // crisis → alert → calm staircase

interface Options {
  initialState?: TriageState;
}

export interface MockSimulation {
  triage: TriageState;
  setTriage: (s: TriageState) => void;
  draft: string;
  setDraft: (v: string) => void;
  /** Wire to <input onChange={onInputChange}> if you don't want controlled draft. */
  onInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  /** Reset latency tracker — call after the user sends a message. */
  resetSignals: () => void;
  /** Average over the recent keystroke window (ms). For dev/debug. */
  averageKeystrokeLatency: number;
}

export const useMockSimulation = ({ initialState = "calm" }: Options = {}): MockSimulation => {
  const [triage, setTriageState] = useState<TriageState>(initialState);
  const [draft, setDraft] = useState("");
  const [averageKeystrokeLatency, setAvgLatency] = useState(0);

  // Refs avoid re-renders on every keystroke.
  const lastKeyTsRef = useRef<number | null>(null);
  const intervalsRef = useRef<number[]>([]);
  const resetTimerRef = useRef<number | null>(null);

  const clearResetTimer = () => {
    if (resetTimerRef.current !== null) {
      window.clearTimeout(resetTimerRef.current);
      resetTimerRef.current = null;
    }
  };

  const setTriage = useCallback((next: TriageState) => {
    clearResetTimer();
    setTriageState(next);
  }, []);

  /** Smooth staircase back to calm over 5s — never abrupt. */
  const beginResetToCalm = useCallback(() => {
    clearResetTimer();
    const stepMs = RESET_FADE_MS / RESET_TICK_STEPS;
    let stepsLeft = RESET_TICK_STEPS;

    const step = () => {
      stepsLeft -= 1;
      setTriageState((curr) => {
        if (curr === "crisis") return "alert";
        if (curr === "alert") return "calm";
        return curr;
      });
      if (stepsLeft > 0) {
        resetTimerRef.current = window.setTimeout(step, stepMs);
      } else {
        // Final settle — guarantee calm even if state was already calm mid-flight.
        setTriageState("calm");
        resetTimerRef.current = null;
      }
    };

    resetTimerRef.current = window.setTimeout(step, stepMs);
  }, []);

  const evaluateText = useCallback(
    (raw: string) => {
      const text = raw.toLowerCase().trim();
      if (!text) return;

      // 1) Reset phrases take precedence — even if "help" is also typed.
      if (RESET_PHRASES.some((p) => text.includes(p))) {
        beginResetToCalm();
        return;
      }

      // 2) Crisis keywords — instant escalation.
      if (CRISIS_KEYWORDS.some((k) => text.includes(k))) {
        clearResetTimer();
        setTriageState("crisis");
        return;
      }
    },
    [beginResetToCalm],
  );

  const recordKeystroke = useCallback(() => {
    const now = performance.now();
    if (lastKeyTsRef.current !== null) {
      const dt = now - lastKeyTsRef.current;
      // Discard idle pauses > 8s — those are thinking, not hesitation.
      if (dt < 8000) {
        const arr = intervalsRef.current;
        arr.push(dt);
        if (arr.length > LATENCY_WINDOW) arr.shift();

        if (arr.length >= 3) {
          const avg = arr.reduce((s, v) => s + v, 0) / arr.length;
          setAvgLatency(avg);
          if (avg > HESITATION_THRESHOLD_MS) {
            // Only escalate to alert if not already in crisis.
            setTriageState((curr) => (curr === "crisis" ? curr : "alert"));
          }
        }
      }
    }
    lastKeyTsRef.current = now;
  }, []);

  const onInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setDraft(value);
      recordKeystroke();
      evaluateText(value);
    },
    [recordKeystroke, evaluateText],
  );

  const resetSignals = useCallback(() => {
    intervalsRef.current = [];
    lastKeyTsRef.current = null;
    setAvgLatency(0);
    setDraft("");
  }, []);

  // Cleanup on unmount.
  useEffect(() => () => clearResetTimer(), []);

  return {
    triage,
    setTriage,
    draft,
    setDraft,
    onInputChange,
    resetSignals,
    averageKeystrokeLatency,
  };
};
