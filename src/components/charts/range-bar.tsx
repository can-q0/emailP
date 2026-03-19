"use client";

import { cn } from "@/lib/utils";
import { BloodMetricData } from "@/types";

interface RangeBarProps {
  data: BloodMetricData;
  metricName: string;
  unit: string;
  referenceMin?: number;
  referenceMax?: number;
}

export function RangeBar({
  data,
  metricName,
  unit,
  referenceMin,
  referenceMax,
}: RangeBarProps) {
  const { value, isAbnormal, confidence } = data;
  const refMin = referenceMin ?? 0;
  const refMax = referenceMax ?? value * 2;
  const range = refMax - refMin;

  // Display range: 0.5x refMin to 1.5x refMax (with padding)
  const displayMin = Math.max(0, refMin - range * 0.5);
  const displayMax = refMax + range * 0.5;
  const displayRange = displayMax - displayMin;

  // Position calculations as percentages
  const normalStart = ((refMin - displayMin) / displayRange) * 100;
  const normalEnd = ((refMax - displayMin) / displayRange) * 100;
  const valuePos = Math.max(0, Math.min(100, ((value - displayMin) / displayRange) * 100));

  // Determine status
  const isLow = value < refMin;
  const isHigh = value > refMax;
  const isNormal = !isLow && !isHigh;

  // Deviation description
  let statusLabel: string;
  let statusColor: string;
  if (isNormal) {
    statusLabel = "Normal";
    statusColor = "text-severity-low";
  } else if (isLow) {
    const deviation = ((refMin - value) / range * 100).toFixed(0);
    statusLabel = `${deviation}% below range`;
    statusColor = value < refMin - range * 0.25 ? "text-severity-high" : "text-severity-medium";
  } else {
    const deviation = ((value - refMax) / range * 100).toFixed(0);
    statusLabel = `${deviation}% above range`;
    statusColor = value > refMax + range * 0.25 ? "text-severity-high" : "text-severity-medium";
  }

  return (
    <div className="space-y-2">
      {/* Header: metric name, value, status */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{metricName}</span>
          {confidence && confidence !== "high" && (
            <span
              className={cn(
                "text-[10px] px-1.5 py-0.5 rounded-full font-medium",
                confidence === "medium"
                  ? "bg-severity-medium/10 text-severity-medium"
                  : "bg-severity-high/10 text-severity-high"
              )}
            >
              {confidence === "medium" ? "~" : "?"} {confidence}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className={cn("text-sm font-semibold", isAbnormal ? "text-severity-high" : "text-foreground")}>
            {value} {unit}
          </span>
          <span className={cn("text-xs font-medium", statusColor)}>
            {statusLabel}
          </span>
        </div>
      </div>

      {/* Range bar */}
      <div className="relative h-8 rounded-lg overflow-hidden bg-secondary/30 border border-card-border">
        {/* Low zone (left of reference) */}
        <div
          className="absolute top-0 bottom-0 bg-severity-high/8"
          style={{ left: 0, width: `${normalStart}%` }}
        />

        {/* Normal zone */}
        <div
          className="absolute top-0 bottom-0 bg-severity-low/12"
          style={{ left: `${normalStart}%`, width: `${normalEnd - normalStart}%` }}
        />

        {/* High zone (right of reference) */}
        <div
          className="absolute top-0 bottom-0 bg-severity-high/8"
          style={{ left: `${normalEnd}%`, right: 0 }}
        />

        {/* Reference boundary lines */}
        <div
          className="absolute top-0 bottom-0 w-px bg-severity-low/40"
          style={{ left: `${normalStart}%` }}
        />
        <div
          className="absolute top-0 bottom-0 w-px bg-severity-low/40"
          style={{ left: `${normalEnd}%` }}
        />

        {/* Value marker */}
        <div
          className="absolute top-0 bottom-0 flex items-center"
          style={{ left: `${valuePos}%`, transform: "translateX(-50%)" }}
        >
          <div
            className={cn(
              "w-3 h-6 rounded-sm shadow-sm border",
              isNormal
                ? "bg-severity-low border-severity-low/50"
                : "bg-severity-high border-severity-high/50"
            )}
          />
        </div>
      </div>

      {/* Reference labels */}
      <div className="flex items-center justify-between text-[10px] text-text-muted">
        <span>{displayMin.toFixed(refMin < 1 ? 2 : 0)} {unit}</span>
        <span className="text-severity-low/70">
          Ref: {refMin}–{refMax} {unit}
        </span>
        <span>{displayMax.toFixed(refMax < 1 ? 2 : 0)} {unit}</span>
      </div>
    </div>
  );
}
