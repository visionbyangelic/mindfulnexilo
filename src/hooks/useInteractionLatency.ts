import { useCallback, useEffect, useRef } from "react";

export interface LatencyMeasurement {
  latency_ms: number;
  session_id: string;
  message_context_id: string;
  timestamp: string;
  is_outlier: boolean;
}

interface UseInteractionLatencyOptions {
  /** True while the AI message is still streaming/typing. Timer starts when this flips to false. */
  isStreaming: boolean;
  /** Stable id for the current AI message. Re-arms the timer when it changes. */
  messageContextId: string | null;
  /** Stable session id (uuid) for the current chat session. */
  sessionId: string;
  /** Ref to the input element being watched for the first keydown. */
  inputRef: React.RefObject<HTMLElement>;
  /** Optional callback fired with each valid measurement. */
  onMeasurement?: (m: LatencyMeasurement) => void;
  /** Discard threshold in ms. Defaults to 60_000 (60s). */
  inactivityThresholdMs?: number;
}

/**
 * Passive behavioral sensor capturing Time-to-First-Keystroke (TTFK)
 * between an AI message render-complete and the user's first keydown.
 *
 * Silent by design: no UI changes, no logs, no re-renders of the host component.
 */
export function useInteractionLatency({
  isStreaming,
  messageContextId,
  sessionId,
  inputRef,
  onMeasurement,
  inactivityThresholdMs = 60_000,
}: UseInteractionLatencyOptions) {
  const startTsRef = useRef<number | null>(null);
  const armedMessageIdRef = useRef<string | null>(null);
  const voidedRef = useRef<boolean>(false);
  const capturedRef = useRef<boolean>(false);
  const onMeasurementRef = useRef(onMeasurement);

  useEffect(() => {
    onMeasurementRef.current = onMeasurement;
  }, [onMeasurement]);

  // Arm / disarm the timer based on streaming completion.
  useEffect(() => {
    if (isStreaming || !messageContextId) {
      // Streaming in-progress or no active message: keep timer disarmed.
      startTsRef.current = null;
      armedMessageIdRef.current = null;
      voidedRef.current = false;
      capturedRef.current = false;
      return;
    }

    // Stream just completed → start the timer with high-resolution clock.
    startTsRef.current = performance.now();
    armedMessageIdRef.current = messageContextId;
    voidedRef.current = false;
    capturedRef.current = false;
  }, [isStreaming, messageContextId]);

  // Void measurement on tab hide.
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === "hidden") {
        voidedRef.current = true;
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, []);

  // Keydown listener on the input element.
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;

    const handleKeyDown = () => {
      if (capturedRef.current) return;
      if (startTsRef.current == null) return;
      if (armedMessageIdRef.current == null) return;
      if (voidedRef.current) return;

      // Focus check: input must be focused (it is, by virtue of receiving keydown,
      // but guard anyway for synthetic dispatches).
      const active = document.activeElement;
      if (active !== el && !el.contains(active)) return;

      const delta = performance.now() - startTsRef.current;
      capturedRef.current = true;

      // Discard absurd values (user walked away).
      if (delta > inactivityThresholdMs) {
        startTsRef.current = null;
        return;
      }

      const measurement: LatencyMeasurement = {
        latency_ms: Math.round(delta),
        session_id: sessionId,
        message_context_id: armedMessageIdRef.current,
        timestamp: new Date().toISOString(),
        is_outlier: delta > 15_000, // soft outlier flag for downstream baselining
      };

      startTsRef.current = null;
      onMeasurementRef.current?.(measurement);
    };

    el.addEventListener("keydown", handleKeyDown);
    return () => el.removeEventListener("keydown", handleKeyDown);
  }, [inputRef, sessionId, inactivityThresholdMs]);

  // Manual void (exposed for callers that need to invalidate, e.g. on send).
  const voidMeasurement = useCallback(() => {
    voidedRef.current = true;
    startTsRef.current = null;
  }, []);

  return { voidMeasurement };
}
