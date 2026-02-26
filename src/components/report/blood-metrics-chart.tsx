"use client";

import { useState, useMemo } from "react";
import { GlassCard } from "@/components/ui/glass-card";
import { LineMetricChart } from "@/components/charts/line-metric-chart";
import { BloodMetricData } from "@/types";
import { Activity } from "lucide-react";
import { cn } from "@/lib/utils";
import { bloodMetricReferences } from "@/config/blood-metrics";
import { getMetricReference } from "@/lib/blood-metrics";

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

  const ref = bloodMetricReferences[selectedMetric] || getMetricReference(selectedMetric);

  if (metricNames.length === 0) {
    return null;
  }

  return (
    <section id="metrics">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 rounded-xl bg-primary/10">
          <Activity className="w-5 h-5 text-primary" />
        </div>
        <h2 className="text-xl font-bold">Blood Metrics</h2>
        <span className="text-sm text-text-muted">
          {metricNames.length} metrics tracked
        </span>
      </div>

      <GlassCard className="p-6">
        {/* Metric selector pills */}
        <div className="flex flex-wrap gap-2 mb-6 max-h-24 overflow-y-auto">
          {metricNames.map((name) => {
            const pillRef = bloodMetricReferences[name] || getMetricReference(name);
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
                    ? "bg-primary text-white"
                    : "border border-card-border text-text-secondary hover:text-foreground hover:border-foreground/20",
                  hasAbnormal &&
                    selectedMetric !== name &&
                    "border-severity-high/30 text-severity-high"
                )}
              >
                {pillRef?.name || name}
                {hasAbnormal && selectedMetric !== name && " ⚠"}
              </button>
            );
          })}
        </div>

        {/* Separator */}
        <div className="border-t border-card-border mb-6" />

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

        {/* Info row */}
        {filteredMetrics.length > 0 && (
          <div className="flex items-center justify-between mt-4 px-1 text-xs text-text-muted">
            <span>
              {filteredMetrics.length} measurement{filteredMetrics.length !== 1 && "s"}
            </span>
            {(filteredMetrics[0]?.referenceMin != null || ref?.min != null) && (
              <span>
                Reference: {filteredMetrics[0]?.referenceMin ?? ref?.min}–{filteredMetrics[0]?.referenceMax ?? ref?.max} {filteredMetrics[0]?.unit || ref?.unit || ""}
              </span>
            )}
          </div>
        )}

        {/* Legend */}
        <div className="flex items-center gap-4 mt-3 text-xs text-text-muted">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-primary" />
            Normal
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-severity-high" />
            Abnormal
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-8 h-3 rounded bg-severity-low/10 border border-severity-low/20" />
            Reference Range
          </span>
        </div>
      </GlassCard>
    </section>
  );
}
