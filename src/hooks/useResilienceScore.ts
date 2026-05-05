import { useCallback, useRef, useState } from "react";
import type { TriageState } from "@/components/ResilienceWave";

/**
 * useResilienceScore — POST the user's chat text to a backend and await a
 * Resilience Score (0–100) that drives the wave's triage state / color.
 *
 * Contract (request):
 *   POST  <endpoint>
 *   Content-Type: application/json
 *   Body:  { text: string, sessionId?: string }
 *
 * Contract (response — any of these shapes is accepted):
 *   { score: 0–100 }                          // preferred
 *   { resilience_score: 0–100 }
 *   { resilienceScore: 0–100, state?: "calm"|"alert"|"crisis" }
 *
 * Mapping (when no explicit `state` is returned):
 *   score >= 70  → "calm"
 *   score >= 40  → "alert"
 *   score <  40  → "crisis"
 *
 * The hook is fully transport-agnostic; pass any URL (Supabase Edge Function,
 * REST API, mock server, etc.). Concurrent requests are de-duplicated via an
 * AbortController so only the latest in-flight call updates state.
 */

export interface ResilienceResponse {
  score: number;
  state: TriageState;
  raw: unknown;
}

interface Options {
  /** Backend URL. Defaults to VITE_RESILIENCE_ENDPOINT, then "/api/resilience-score". */
  endpoint?: string;
  /** Stable session id forwarded in the request body. */
  sessionId?: string;
  /** Optional callback fired after each successful score. */
  onScore?: (r: ResilienceResponse) => void;
}

const scoreToState = (score: number): TriageState => {
  if (score >= 70) return "calm";
  if (score >= 40) return "alert";
  return "crisis";
};

const extractScore = (json: unknown): number | null => {
  if (!json || typeof json !== "object") return null;
  const o = json as Record<string, unknown>;
  const candidates = [o.score, o.resilience_score, o.resilienceScore];
  for (const c of candidates) {
    if (typeof c === "number" && Number.isFinite(c)) {
      // Normalize 0–1 floats to 0–100 just in case.
      return c <= 1 ? Math.round(c * 100) : Math.round(c);
    }
  }
  return null;
};

const extractState = (json: unknown): TriageState | null => {
  if (!json || typeof json !== "object") return null;
  const s = (json as Record<string, unknown>).state;
  return s === "calm" || s === "alert" || s === "crisis" ? s : null;
};

export const useResilienceScore = ({
  endpoint,
  sessionId,
  onScore,
}: Options = {}) => {
  const [loading, setLoading] = useState(false);
  const [score, setScore] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const url =
    endpoint ??
    (import.meta.env.VITE_RESILIENCE_ENDPOINT as string | undefined) ??
    "/api/resilience-score";

  const submit = useCallback(
    async (text: string): Promise<ResilienceResponse | null> => {
      const trimmed = text.trim();
      if (!trimmed) return null;

      // Cancel any in-flight request so only the latest one wins.
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;

      setLoading(true);
      setError(null);

      try {
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: trimmed, sessionId }),
          signal: ctrl.signal,
        });
        if (!res.ok) {
          throw new Error(`Resilience endpoint failed [${res.status}]`);
        }
        const json = await res.json();
        const parsedScore = extractScore(json);
        if (parsedScore == null) {
          throw new Error("Resilience response missing numeric `score`");
        }
        const state = extractState(json) ?? scoreToState(parsedScore);
        const result: ResilienceResponse = { score: parsedScore, state, raw: json };
        setScore(parsedScore);
        onScore?.(result);
        return result;
      } catch (e) {
        if ((e as Error).name === "AbortError") return null;
        const msg = e instanceof Error ? e.message : "Unknown error";
        setError(msg);
        return null;
      } finally {
        if (abortRef.current === ctrl) {
          setLoading(false);
          abortRef.current = null;
        }
      }
    },
    [url, sessionId, onScore],
  );

  return { submit, loading, score, error };
};
