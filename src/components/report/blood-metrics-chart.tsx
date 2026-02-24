"use client";

import { useState, useMemo } from "react";
import { GlassCard } from "@/components/ui/glass-card";
import { LineMetricChart } from "@/components/charts/line-metric-chart";
import { BloodMetricData } from "@/types";
import { Activity } from "lucide-react";
import { cn } from "@/lib/utils";
import { bloodMetricReferences } from "@/config/blood-metrics";

interface BloodMetricsChartProps {
  metrics: BloodMetricData[];
}

export function BloodMetricsChart({ metrics }: BloodMetricsChartProps) {
  const metricNames = useMemo(() => {
    const names = [...new Set(metrics.map((m) => m.metricName))];
    return names.sort();
  }, [metrics]);

  const [selectedMetric, setSelectedMetric] = useState<string>(
    metricNames[0] || ""
  );

  const filteredMetrics = useMemo(() => {
    return metrics
      .filter((m) => m.metricName === selectedMetric)
      .sort(
        (a, b) =>
          new Date(a.measuredAt).getTime() - new Date(b.measuredAt).getTime()
      );
  }, [metrics, selectedMetric]);

  const ref = bloodMetricReferences[selectedMetric];

  if (metricNames.length === 0) {
    return null;
  }

  return (
    <section id="metrics">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 rounded-xl bg-sky-accent/10">
          <Activity className="w-5 h-5 text-sky-accent" />
        </div>
        <h2 className="text-xl font-bold">Blood Metrics</h2>
        <span className="text-sm text-foreground/40">
          {metricNames.length} metrics tracked
        </span>
      </div>

      <GlassCard className="p-6">
        {/* Metric selector pills */}
        <div className="flex flex-wrap gap-2 mb-6">
          {metricNames.map((name) => {
            const hasAbnormal = metrics.some(
              (m) => m.metricName === name && m.isAbnormal
            );
            return (
              <button
                key={name}
                onClick={() => setSelectedMetric(name)}
                className={cn(
                  "px-3 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer",
                  selectedMetric === name
                    ? "bg-sky-accent text-slate-900"
                    : "border border-glass-border text-foreground/60 hover:text-foreground hover:border-foreground/20",
                  hasAbnormal &&
                    selectedMetric !== name &&
                    "border-red-500/30 text-red-400"
                )}
              >
                {ref?.name || name}
                {hasAbnormal && selectedMetric !== name && " ⚠"}
              </button>
            );
          })}
        </div>

        {/* Chart */}
        {filteredMetrics.length > 0 && (
          <LineMetricChart
            data={filteredMetrics}
            metricName={ref?.name || selectedMetric}
            unit={filteredMetrics[0]?.unit || ref?.unit || ""}
            referenceMin={filteredMetrics[0]?.referenceMin ?? ref?.min}
            referenceMax={filteredMetrics[0]?.referenceMax ?? ref?.max}
          />
        )}

        {/* Legend */}
        <div className="flex items-center gap-4 mt-4 text-xs text-foreground/40">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-sky-accent" />
            Normal
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-red-500" />
            Abnormal
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-8 h-3 rounded bg-green-500/10 border border-green-500/20" />
            Reference Range
          </span>
        </div>
      </GlassCard>
    </section>
  );
}
