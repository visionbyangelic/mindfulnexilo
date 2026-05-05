import { memo, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export type TriageState = "Steady" | "Elevated" | "Crisis";

export interface PulseDatum {
  day: string;
  score: number;
  state: TriageState;
  date?: string;
}

interface HistoricalPulseProps {
  data: PulseDatum[];
  /** Fired when a node (or chart point) is tapped. Used to broadcast
   *  the selected day's state to the header for "Last Tuesday: Elevated". */
  onSelect?: (datum: PulseDatum, index: number) => void;
  /** Currently selected index — drives the persistent ripple/scale on a node. */
  selectedIndex?: number | null;
}

const STATE_COLORS: Record<TriageState, string> = {
  Steady: "#10B981",
  Elevated: "#F59E0B",
  Crisis: "#EF4444",
};

const scoreToState = (score: number): TriageState => {
  if (score >= 0.8) return "Steady";
  if (score >= 0.5) return "Elevated";
  return "Crisis";
};

interface TooltipPayload {
  active?: boolean;
  payload?: Array<{ payload: PulseDatum }>;
}

const GlassTooltip = ({ active, payload }: TooltipPayload) => {
  if (!active || !payload || !payload.length) return null;
  const datum = payload[0].payload;
  const color = STATE_COLORS[datum.state];
  return (
    <div
      className="rounded-xl px-4 py-3 transition-all duration-200"
      style={{
        background: "rgba(10, 17, 40, 0.72)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        border: "1px solid rgba(255, 255, 255, 0.1)",
        boxShadow: `0 8px 32px rgba(0,0,0,0.35), 0 0 24px ${color}22`,
        minWidth: 120,
      }}
    >
      <div
        className="text-sm font-semibold tracking-wide"
        style={{ color, textShadow: `0 0 12px ${color}55` }}
      >
        {datum.state}
      </div>
      <div
        className="text-[11px] mt-1 tracking-wider uppercase"
        style={{ color: "rgba(255,255,255,0.45)" }}
      >
        {datum.date ?? datum.day}
      </div>
      <div
        className="text-[11px] mt-1 tabular-nums"
        style={{ color: "rgba(255,255,255,0.6)" }}
      >
        Score · {datum.score.toFixed(2)}
      </div>
    </div>
  );
};

const HistoricalPulse = memo(({ data, onSelect, selectedIndex = null }: HistoricalPulseProps) => {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  // Local "tap pulse" — keyed by index+timestamp for one-shot ripple animation.
  const [tapKey, setTapKey] = useState(0);

  const overallState = useMemo<TriageState>(() => {
    if (!data.length) return "Steady";
    const avg = data.reduce((sum, d) => sum + d.score, 0) / data.length;
    return scoreToState(avg);
  }, [data]);

  const lineColor = STATE_COLORS[overallState];

  return (
    <div
      className="w-full mx-auto"
      style={{ maxWidth: 480, willChange: "transform" }}
    >
      <ResponsiveContainer width="100%" height={180}>
        <AreaChart
          data={data}
          margin={{ top: 16, right: 12, left: 12, bottom: 4 }}
          onClick={(s) => {
            const idx = s?.activeTooltipIndex;
            if (typeof idx === "number" && data[idx]) {
              setTapKey((k) => k + 1);
              onSelect?.(data[idx], idx);
            }
          }}
          onMouseMove={(s) => {
            if (typeof s?.activeTooltipIndex === "number") {
              setHoverIndex(s.activeTooltipIndex);
            }
          }}
          onMouseLeave={() => setHoverIndex(null)}
        >
          <defs>
            <linearGradient id="colorPulse" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={lineColor} stopOpacity={0.25} />
              <stop offset="100%" stopColor={lineColor} stopOpacity={0} />
            </linearGradient>
            <filter id="pulseGlow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="3.5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          <XAxis
            dataKey="day"
            axisLine={false}
            tickLine={false}
            tick={{
              fill: "rgba(255,255,255,0.4)",
              fontSize: 10,
              letterSpacing: 1.2,
            }}
            dy={6}
          />
          <YAxis hide domain={[0, 1]} />

          <Tooltip
            content={<GlassTooltip />}
            cursor={{
              stroke: lineColor,
              strokeOpacity: 0.25,
              strokeWidth: 1,
              strokeDasharray: "3 3",
            }}
            animationDuration={200}
          />

          <Area
            type="monotone"
            dataKey="score"
            stroke={lineColor}
            strokeWidth={2.5}
            fill="url(#colorPulse)"
            filter="url(#pulseGlow)"
            isAnimationActive
            animationDuration={1500}
            animationEasing="ease-out"
            dot={(props: { cx?: number; cy?: number; index?: number; payload?: PulseDatum }) => {
              const { cx, cy, index, payload } = props;
              if (cx == null || cy == null || payload == null) {
                return <g />;
              }
              const isHover = hoverIndex === index;
              const isSelected = selectedIndex === index;
              const isActive = isHover || isSelected;
              const dotColor = STATE_COLORS[payload.state];
              return (
                <g key={`dot-${index}`}>
                  {/* Liquid Light ripple on tap — ephemeral, ~600ms */}
                  {isSelected && (
                    <circle
                      key={`ripple-${tapKey}`}
                      cx={cx}
                      cy={cy}
                      r={4}
                      fill="none"
                      stroke={dotColor}
                      strokeWidth={1.5}
                      style={{
                        transformOrigin: `${cx}px ${cy}px`,
                        animation: "pulse-node-ripple 0.65s cubic-bezier(0.4, 0, 0.2, 1) forwards",
                      }}
                    />
                  )}
                  <circle
                    cx={cx}
                    cy={cy}
                    r={isSelected ? 6 : isActive ? 5 : 3}
                    fill="#0A1128"
                    stroke={dotColor}
                    strokeWidth={isSelected ? 2.5 : 2}
                    style={{
                      filter: `drop-shadow(0 0 ${isSelected ? 12 : isActive ? 8 : 4}px ${dotColor})`,
                      transition: "r 200ms ease, filter 200ms ease",
                      cursor: "pointer",
                    }}
                  />
                </g>
              );
            }}
            activeDot={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
});

HistoricalPulse.displayName = "HistoricalPulse";

export default HistoricalPulse;