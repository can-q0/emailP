"use client";

import { useState, useMemo } from "react";
import { GlassCard } from "@/components/ui/glass-card";
import { LineMetricChart } from "@/components/charts/line-metric-chart";
import { BloodMetricData } from "@/types";
import { Activity, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import { bloodMetricReferences } from "@/config/blood-metrics";
import { getMetricReference } from "@/lib/blood-metrics";
import {
  LineChart,
  Line,
  ResponsiveContainer,
  ReferenceArea,
} from "recharts";
import { format } from "date-fns";
import type { MetricsVariant } from "@/config/report-layouts";

interface BloodMetricsChartProps {
  metrics: BloodMetricData[];
  variant?: MetricsVariant;
}

export function BloodMetricsChart({
  metrics,
  variant = "default",
}: BloodMetricsChartProps) {
  if (variant === "mini") return <MiniMetrics metrics={metrics} />;
  if (variant === "sparklines") return <SparklinesMetrics metrics={metrics} />;
  if (variant === "grid") return <GridMetrics metrics={metrics} />;
  if (variant === "delta") return <DeltaMetrics metrics={metrics} />;
  if (variant === "comparison") return <ComparisonMetrics metrics={metrics} />;
  if (variant === "comparison-grid") return <ComparisonGridMetrics metrics={metrics} />;
  return <DefaultMetrics metrics={metrics} />;
}

// ── Shared helpers ────────────────────────────────────────

function useMetricNames(metrics: BloodMetricData[]) {
  return useMemo(() => {
    const names = [...new Set(metrics.map((m) => m.metricName))];
    return names.sort();
  }, [metrics]);
}

function getRef(name: string) {
  return bloodMetricReferences[name] || getMetricReference(name);
}

function getSorted(metrics: BloodMetricData[], name: string) {
  return metrics
    .filter((m) => m.metricName === name)
    .sort((a, b) => new Date(a.measuredAt).getTime() - new Date(b.measuredAt).getTime());
}

function getLastTwo(metrics: BloodMetricData[], name: string) {
  const sorted = getSorted(metrics, name);
  if (sorted.length < 2) return { prev: null, curr: sorted[sorted.length - 1] ?? null };
  return { prev: sorted[sorted.length - 2], curr: sorted[sorted.length - 1] };
}

function deltaPercent(prev: number, curr: number) {
  if (prev === 0) return curr === 0 ? 0 : 100;
  return ((curr - prev) / Math.abs(prev)) * 100;
}

function DeltaChip({ prev, curr }: { prev: number; curr: number }) {
  const pct = deltaPercent(prev, curr);
  const isUp = pct > 0;
  const isDown = pct < 0;
  const Icon = isUp ? TrendingUp : isDown ? TrendingDown : Minus;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium",
        isUp && "bg-severity-high/10 text-severity-high",
        isDown && "bg-severity-low/10 text-severity-low",
        !isUp && !isDown && "bg-secondary/50 text-text-muted"
      )}
    >
      <Icon className="w-3 h-3" />
      {pct > 0 ? "+" : ""}
      {pct.toFixed(1)}%
    </span>
  );
}

// ── Section header (reused across variants) ────────────────

function MetricsHeader({ extra }: { extra?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <div className="p-2 rounded-xl bg-primary/10">
        <Activity className="w-5 h-5 text-primary" />
      </div>
      <h2 className="text-xl font-bold">Blood Metrics</h2>
      {extra}
    </div>
  );
}

// ── default ───────────────────────────────────────────────

function DefaultMetrics({ metrics }: { metrics: BloodMetricData[] }) {
  const metricNames = useMetricNames(metrics);
  const [selectedMetric, setSelectedMetric] = useState<string>(metricNames[0] || "");

  const filteredMetrics = useMemo(
    () => getSorted(metrics, selectedMetric),
    [metrics, selectedMetric]
  );

  const ref = getRef(selectedMetric);

  if (metricNames.length === 0) return null;

  return (
    <section id="metrics">
      <MetricsHeader
        extra={
          <span className="text-sm text-text-muted">
            {metricNames.length} metrics tracked
          </span>
        }
      />

      <GlassCard className="p-6">
        <div className="flex flex-wrap gap-2 mb-6 max-h-24 overflow-y-auto">
          {metricNames.map((name) => {
            const pillRef = getRef(name);
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

        <div className="border-t border-card-border mb-6" />

        {filteredMetrics.length > 0 && (
          <LineMetricChart
            data={filteredMetrics}
            metricName={ref?.name || selectedMetric}
            unit={filteredMetrics[0]?.unit || ref?.unit || ""}
            referenceMin={filteredMetrics[0]?.referenceMin ?? ref?.min}
            referenceMax={filteredMetrics[0]?.referenceMax ?? ref?.max}
          />
        )}

        {filteredMetrics.length > 0 && (
          <div className="flex items-center justify-between mt-4 px-1 text-xs text-text-muted">
            <span>
              {filteredMetrics.length} measurement
              {filteredMetrics.length !== 1 && "s"}
            </span>
            {(filteredMetrics[0]?.referenceMin != null || ref?.min != null) && (
              <span>
                Reference: {filteredMetrics[0]?.referenceMin ?? ref?.min}–
                {filteredMetrics[0]?.referenceMax ?? ref?.max}{" "}
                {filteredMetrics[0]?.unit || ref?.unit || ""}
              </span>
            )}
          </div>
        )}

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

// ── mini ──────────────────────────────────────────────────

function MiniMetrics({ metrics }: { metrics: BloodMetricData[] }) {
  const metricNames = useMetricNames(metrics);
  if (metricNames.length === 0) return null;

  // Pick the most abnormal metric
  const abnormalCounts = metricNames.map((name) => ({
    name,
    count: metrics.filter((m) => m.metricName === name && m.isAbnormal).length,
  }));
  abnormalCounts.sort((a, b) => b.count - a.count);
  const autoMetric = abnormalCounts[0]?.name || metricNames[0];

  const data = getSorted(metrics, autoMetric);
  const ref = getRef(autoMetric);

  return (
    <section id="metrics">
      <MetricsHeader />
      <GlassCard className="p-4">
        <p className="text-xs text-text-muted mb-2 font-medium">
          {ref?.name || autoMetric}
        </p>
        {data.length > 0 && (
          <div className="h-40">
            <LineMetricChart
              data={data}
              metricName={ref?.name || autoMetric}
              unit={data[0]?.unit || ref?.unit || ""}
              referenceMin={data[0]?.referenceMin ?? ref?.min}
              referenceMax={data[0]?.referenceMax ?? ref?.max}
            />
          </div>
        )}
        {metricNames.length > 1 && (
          <p className="text-xs text-primary mt-2 font-medium">
            + {metricNames.length - 1} more metric{metricNames.length > 2 ? "s" : ""}
          </p>
        )}
      </GlassCard>
    </section>
  );
}

// ── sparklines ────────────────────────────────────────────

function SparklinesMetrics({ metrics }: { metrics: BloodMetricData[] }) {
  const metricNames = useMetricNames(metrics);
  if (metricNames.length === 0) return null;

  return (
    <section id="metrics">
      <MetricsHeader />
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {metricNames.map((name) => {
          const data = getSorted(metrics, name);
          const ref = getRef(name);
          const latest = data[data.length - 1];
          const chartData = data.map((d) => ({
            date: format(new Date(d.measuredAt), "MMM d"),
            value: d.value,
          }));

          const values = data.map((d) => d.value);
          const min = Math.min(...values, ref?.min ?? Infinity) * 0.9;
          const max = Math.max(...values, ref?.max ?? -Infinity) * 1.1;

          return (
            <GlassCard key={name} className="p-3">
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs font-medium truncate">{ref?.name || name}</p>
                {latest && (
                  <p className="text-xs text-text-muted">
                    {latest.value} {latest.unit}
                  </p>
                )}
              </div>
              <div className="h-24">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    {ref?.min !== undefined && ref?.max !== undefined && (
                      <ReferenceArea
                        y1={ref.min}
                        y2={ref.max}
                        fill="rgba(58,143,92,0.08)"
                      />
                    )}
                    <Line
                      type="monotone"
                      dataKey="value"
                      stroke="#D97757"
                      strokeWidth={1.5}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </GlassCard>
          );
        })}
      </div>
    </section>
  );
}

// ── grid ──────────────────────────────────────────────────

function GridMetrics({ metrics }: { metrics: BloodMetricData[] }) {
  const metricNames = useMetricNames(metrics);
  if (metricNames.length === 0) return null;

  // Sort abnormal first
  const sorted = [...metricNames].sort((a, b) => {
    const aAbn = metrics.filter((m) => m.metricName === a && m.isAbnormal).length;
    const bAbn = metrics.filter((m) => m.metricName === b && m.isAbnormal).length;
    return bAbn - aAbn;
  });

  return (
    <section id="metrics">
      <MetricsHeader
        extra={
          <span className="text-sm text-text-muted">
            {metricNames.length} metrics tracked
          </span>
        }
      />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 max-h-[600px] overflow-y-auto pr-1">
        {sorted.map((name) => {
          const data = getSorted(metrics, name);
          const ref = getRef(name);

          return (
            <GlassCard key={name} className="p-4">
              <p className="text-sm font-medium mb-2">{ref?.name || name}</p>
              <div className="h-48">
                <LineMetricChart
                  data={data}
                  metricName={ref?.name || name}
                  unit={data[0]?.unit || ref?.unit || ""}
                  referenceMin={data[0]?.referenceMin ?? ref?.min}
                  referenceMax={data[0]?.referenceMax ?? ref?.max}
                />
              </div>
            </GlassCard>
          );
        })}
      </div>
    </section>
  );
}

// ── delta (table view) ────────────────────────────────────

function DeltaMetrics({ metrics }: { metrics: BloodMetricData[] }) {
  const metricNames = useMetricNames(metrics);
  if (metricNames.length === 0) return null;

  const rows = metricNames.map((name) => {
    const { prev, curr } = getLastTwo(metrics, name);
    const ref = getRef(name);
    const pct = prev && curr ? deltaPercent(prev.value, curr.value) : null;
    return { name, ref, prev, curr, pct };
  });

  return (
    <section id="metrics">
      <MetricsHeader />
      <GlassCard className="overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-card-border bg-secondary/30">
              <th className="text-left p-3 font-medium text-text-muted">Metric</th>
              <th className="text-right p-3 font-medium text-text-muted">Previous</th>
              <th className="text-right p-3 font-medium text-text-muted">Current</th>
              <th className="text-right p-3 font-medium text-text-muted">Change</th>
              <th className="text-center p-3 font-medium text-text-muted">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ name, ref, prev, curr, pct }) => {
              const isUp = pct !== null && pct > 0;
              const isDown = pct !== null && pct < 0;
              return (
                <tr
                  key={name}
                  className={cn(
                    "border-b border-card-border last:border-b-0",
                    curr?.isAbnormal && "bg-severity-high/5"
                  )}
                >
                  <td className="p-3 font-medium">{ref?.name || name}</td>
                  <td className="p-3 text-right text-text-muted">
                    {prev ? `${prev.value} ${prev.unit}` : "–"}
                  </td>
                  <td className="p-3 text-right">
                    {curr ? `${curr.value} ${curr.unit}` : "–"}
                  </td>
                  <td className="p-3 text-right">
                    {pct !== null ? (
                      <span
                        className={cn(
                          isUp && "text-severity-high",
                          isDown && "text-severity-low"
                        )}
                      >
                        {pct > 0 ? "+" : ""}
                        {pct.toFixed(1)}%
                      </span>
                    ) : (
                      "–"
                    )}
                  </td>
                  <td className="p-3 text-center">
                    {pct !== null && (
                      <>
                        {isUp && <TrendingUp className="w-4 h-4 text-severity-high mx-auto" />}
                        {isDown && <TrendingDown className="w-4 h-4 text-severity-low mx-auto" />}
                        {!isUp && !isDown && (
                          <Minus className="w-4 h-4 text-text-muted mx-auto" />
                        )}
                      </>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </GlassCard>
    </section>
  );
}

// ── comparison (default chart + delta header) ─────────────

function ComparisonMetrics({ metrics }: { metrics: BloodMetricData[] }) {
  const metricNames = useMetricNames(metrics);
  const [selectedMetric, setSelectedMetric] = useState<string>(metricNames[0] || "");

  const filteredMetrics = useMemo(
    () => getSorted(metrics, selectedMetric),
    [metrics, selectedMetric]
  );

  const ref = getRef(selectedMetric);
  const { prev, curr } = getLastTwo(metrics, selectedMetric);

  if (metricNames.length === 0) return null;

  return (
    <section id="metrics">
      <MetricsHeader />
      <GlassCard className="p-6">
        {/* Delta header */}
        {prev && curr && (
          <div className="flex items-center gap-4 mb-4 p-3 rounded-xl bg-secondary/30">
            <span className="text-sm font-medium">{ref?.name || selectedMetric}</span>
            <span className="text-sm text-text-muted">
              {prev.value} {prev.unit}
            </span>
            <span className="text-text-muted">→</span>
            <span className="text-sm font-medium">
              {curr.value} {curr.unit}
            </span>
            <DeltaChip prev={prev.value} curr={curr.value} />
          </div>
        )}

        <div className="flex flex-wrap gap-2 mb-6 max-h-24 overflow-y-auto">
          {metricNames.map((name) => {
            const pillRef = getRef(name);
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

        <div className="border-t border-card-border mb-6" />

        {filteredMetrics.length > 0 && (
          <LineMetricChart
            data={filteredMetrics}
            metricName={ref?.name || selectedMetric}
            unit={filteredMetrics[0]?.unit || ref?.unit || ""}
            referenceMin={filteredMetrics[0]?.referenceMin ?? ref?.min}
            referenceMax={filteredMetrics[0]?.referenceMax ?? ref?.max}
          />
        )}
      </GlassCard>
    </section>
  );
}

// ── comparison-grid (multi-chart grid with delta badges) ──

function ComparisonGridMetrics({ metrics }: { metrics: BloodMetricData[] }) {
  const metricNames = useMetricNames(metrics);
  if (metricNames.length === 0) return null;

  // Sort abnormal first
  const sorted = [...metricNames].sort((a, b) => {
    const aAbn = metrics.filter((m) => m.metricName === a && m.isAbnormal).length;
    const bAbn = metrics.filter((m) => m.metricName === b && m.isAbnormal).length;
    return bAbn - aAbn;
  });

  return (
    <section id="metrics">
      <MetricsHeader />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 max-h-[600px] overflow-y-auto pr-1">
        {sorted.map((name) => {
          const data = getSorted(metrics, name);
          const ref = getRef(name);
          const { prev, curr } = getLastTwo(metrics, name);

          return (
            <GlassCard key={name} className="p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium">{ref?.name || name}</p>
                {prev && curr && <DeltaChip prev={prev.value} curr={curr.value} />}
              </div>
              <div className="h-48">
                <LineMetricChart
                  data={data}
                  metricName={ref?.name || name}
                  unit={data[0]?.unit || ref?.unit || ""}
                  referenceMin={data[0]?.referenceMin ?? ref?.min}
                  referenceMax={data[0]?.referenceMax ?? ref?.max}
                />
              </div>
            </GlassCard>
          );
        })}
      </div>
    </section>
  );
}
