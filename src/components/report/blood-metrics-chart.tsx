"use client";

import { useState, useMemo } from "react";
import { GlassCard } from "@/components/ui/glass-card";
import { LineMetricChart } from "@/components/charts/line-metric-chart";
import { RangeBar } from "@/components/charts/range-bar";
import { BloodMetricData } from "@/types";
import { Activity, TrendingUp, TrendingDown, Minus, ChevronDown, ChevronRight, HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { bloodMetricReferences, getCategoryDisplayName, getMetricDescription } from "@/config/blood-metrics";
import { getMetricReference } from "@/lib/blood-metrics";
import {
  LineChart,
  Line,
  ResponsiveContainer,
  ReferenceArea,
} from "recharts";
import { format, isSameDay } from "date-fns";
import { getMetricStatus } from "@/lib/metric-status";
import { MetricTooltip } from "./metric-tooltip";
import type { MetricsVariant } from "@/config/report-layouts";

interface BloodMetricsChartProps {
  metrics: BloodMetricData[];
  variant?: MetricsVariant;
  comparisonDateA?: string;
  comparisonDateB?: string;
  language?: string;
}

export function BloodMetricsChart({
  metrics,
  variant = "default",
  comparisonDateA,
  comparisonDateB,
  language = "en",
}: BloodMetricsChartProps) {
  if (variant === "mini") return <MiniMetrics metrics={metrics} language={language} />;
  if (variant === "sparklines") return <SparklinesMetrics metrics={metrics} language={language} />;
  if (variant === "grid") return <GridMetrics metrics={metrics} language={language} />;
  if (variant === "delta") return <DeltaMetrics metrics={metrics} comparisonDateA={comparisonDateA} comparisonDateB={comparisonDateB} language={language} />;
  if (variant === "comparison") return <ComparisonMetrics metrics={metrics} comparisonDateA={comparisonDateA} comparisonDateB={comparisonDateB} language={language} />;
  if (variant === "comparison-grid") return <ComparisonGridMetrics metrics={metrics} comparisonDateA={comparisonDateA} comparisonDateB={comparisonDateB} language={language} />;
  return <DefaultMetrics metrics={metrics} language={language} />;
}

// ── Shared helpers ────────────────────────────────────────

function useMetricNames(metrics: BloodMetricData[]) {
  return useMemo(() => {
    const names = [...new Set(metrics.map((m) => m.metricName))];
    // Sort: abnormal metrics first (by abnormal count desc), then alphabetical
    return names.sort((a, b) => {
      const aAbn = metrics.filter((m) => m.metricName === a && m.isAbnormal).length;
      const bAbn = metrics.filter((m) => m.metricName === b && m.isAbnormal).length;
      if (bAbn !== aAbn) return bAbn - aAbn;
      return a.localeCompare(b);
    });
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

function getComparisonPair(
  metrics: BloodMetricData[],
  name: string,
  dateA?: string,
  dateB?: string
): { prev: BloodMetricData | null; curr: BloodMetricData | null } {
  if (!dateA || !dateB) return getLastTwo(metrics, name);
  const sorted = getSorted(metrics, name);
  const dA = new Date(dateA);
  const dB = new Date(dateB);
  const prev = sorted.find((m) => isSameDay(new Date(m.measuredAt), dA)) ?? null;
  const curr = sorted.find((m) => isSameDay(new Date(m.measuredAt), dB)) ?? null;
  if (!prev || !curr) return getLastTwo(metrics, name);
  return { prev, curr };
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

// ── Localized display name helper ────────────────────────

function capitalize(s: string): string {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

function getDisplayName(name: string, language: string) {
  const ref = bloodMetricReferences[name];
  if (ref) return language === "tr" ? ref.trName : ref.name;
  const ref2 = getMetricReference(name);
  if (ref2) return language === "tr" ? ref2.trName : ref2.name;
  // Fallback: capitalize each word
  return capitalize(name);
}

// ── Section header (reused across variants) ────────────────

function MetricsHeader({ extra, language = "en" }: { extra?: React.ReactNode; language?: string }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <div className="p-2 rounded-xl bg-primary/10">
        <Activity className="w-5 h-5 text-primary" />
      </div>
      <h2 className="text-xl font-bold">{language === "tr" ? "Kan Degerleri" : "Blood Metrics"}</h2>
      {extra}
    </div>
  );
}

// ── Body-system grouping helpers ─────────────────────────

interface CategoryGroup {
  category: string;
  displayName: string;
  metricNames: string[];
  totalCount: number;
  abnormalCount: number;
  status: "normal" | "borderline" | "abnormal";
}

function useCategoryGroups(metrics: BloodMetricData[], metricNames: string[], language: string): CategoryGroup[] {
  return useMemo(() => {
    const groups = new Map<string, { names: string[]; total: number; abnormal: number }>();

    for (const name of metricNames) {
      const ref = getRef(name);
      const category = ref?.category || "Other";
      if (!groups.has(category)) {
        groups.set(category, { names: [], total: 0, abnormal: 0 });
      }
      const g = groups.get(category)!;
      g.names.push(name);
      g.total++;

      const latestMetric = getSorted(metrics, name).at(-1);
      if (latestMetric?.isAbnormal) g.abnormal++;
    }

    return [...groups.entries()].map(([category, g]) => ({
      category,
      displayName: getCategoryDisplayName(category, language),
      metricNames: g.names,
      totalCount: g.total,
      abnormalCount: g.abnormal,
      status: g.abnormal === 0 ? "normal" : g.abnormal / g.total > 0.5 ? "abnormal" : "borderline",
    }));
  }, [metrics, metricNames, language]);
}

function TrafficLight({ status }: { status: "normal" | "borderline" | "abnormal" }) {
  return (
    <span
      className={cn(
        "inline-block w-2.5 h-2.5 rounded-full",
        status === "normal" && "bg-severity-low",
        status === "borderline" && "bg-severity-medium",
        status === "abnormal" && "bg-severity-high",
      )}
    />
  );
}

// ── Confidence badge ─────────────────────────────────────

function ConfidenceBadge({ confidence }: { confidence?: string }) {
  if (!confidence || confidence === "high") return null;
  return (
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
  );
}

// ── Smart chart: RangeBar for single point, LineChart for multiple ──

function SmartChart({
  data,
  metricName,
  unit,
  referenceMin,
  referenceMax,
  height,
}: {
  data: BloodMetricData[];
  metricName: string;
  unit: string;
  referenceMin?: number;
  referenceMax?: number;
  height?: string;
}) {
  if (data.length === 1 && referenceMin !== undefined && referenceMax !== undefined) {
    return (
      <RangeBar
        data={data[0]}
        metricName={metricName}
        unit={unit}
        referenceMin={referenceMin}
        referenceMax={referenceMax}
      />
    );
  }
  return (
    <div className={height || "h-80"}>
      <LineMetricChart
        data={data}
        metricName={metricName}
        unit={unit}
        referenceMin={referenceMin}
        referenceMax={referenceMax}
      />
    </div>
  );
}

// ── default ───────────────────────────────────────────────

function DefaultMetrics({ metrics, language = "en" }: { metrics: BloodMetricData[]; language?: string }) {
  const metricNames = useMetricNames(metrics);
  const categoryGroups = useCategoryGroups(metrics, metricNames, language);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedMetric, setSelectedMetric] = useState<string>(metricNames[0] || "");

  // Abnormal metric names
  const abnormalNames = useMemo(() =>
    metricNames.filter((name) => metrics.some((m) => m.metricName === name && m.isAbnormal)),
    [metrics, metricNames]
  );

  // Filter metric names by selected category
  const visibleMetrics = useMemo(() => {
    if (selectedCategory === "all") return metricNames;
    if (selectedCategory === "abnormal") return abnormalNames;
    const group = categoryGroups.find((g) => g.category === selectedCategory);
    return group ? group.metricNames : metricNames;
  }, [selectedCategory, metricNames, abnormalNames, categoryGroups]);

  // Auto-select first metric when category changes
  const effectiveSelectedMetric = visibleMetrics.includes(selectedMetric)
    ? selectedMetric
    : visibleMetrics[0] || "";

  const filteredMetrics = useMemo(
    () => getSorted(metrics, effectiveSelectedMetric),
    [metrics, effectiveSelectedMetric]
  );

  const ref = getRef(effectiveSelectedMetric);
  const latestConfidence = filteredMetrics.at(-1)?.confidence;

  if (metricNames.length === 0) return null;

  return (
    <section id="metrics">
      <MetricsHeader
        language={language}
        extra={
          <span className="text-sm text-text-muted">
            {metricNames.length} {language === "tr" ? "metrik izleniyor" : "metrics tracked"}
          </span>
        }
      />

      <GlassCard className="p-6">
        {/* Category tabs */}
        <div className="flex flex-wrap gap-2 mb-4" role="tablist">
          {/* All tab */}
          <button
            role="tab"
            aria-pressed={selectedCategory === "all"}
            onClick={() => setSelectedCategory("all")}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer",
              selectedCategory === "all"
                ? "bg-primary text-white"
                : "bg-card border border-card-border text-text-secondary hover:border-foreground/20"
            )}
          >
            All
            <span className={cn("text-[10px]", selectedCategory === "all" ? "text-white/70" : "text-text-muted")}>
              {metricNames.length}
            </span>
          </button>

          {/* Abnormals tab */}
          {abnormalNames.length > 0 && (
            <button
              role="tab"
              aria-pressed={selectedCategory === "abnormal"}
              onClick={() => setSelectedCategory("abnormal")}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer",
                selectedCategory === "abnormal"
                  ? "bg-severity-high text-white"
                  : "bg-card border border-severity-high/30 text-severity-high hover:border-severity-high/50"
              )}
            >
              Abnormal
              <span className={cn("text-[10px]", selectedCategory === "abnormal" ? "text-white/70" : "text-severity-high/70")}>
                {abnormalNames.length}
              </span>
            </button>
          )}

          {/* Category tabs */}
          {categoryGroups.map((g) => (
            <button
              key={g.category}
              role="tab"
              aria-pressed={selectedCategory === g.category}
              onClick={() => setSelectedCategory(g.category)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer",
                selectedCategory === g.category
                  ? "bg-primary text-white"
                  : "bg-card border border-card-border text-text-secondary hover:border-foreground/20"
              )}
            >
              <TrafficLight status={g.status} />
              {g.displayName}
              <span className={cn("text-[10px]", selectedCategory === g.category ? "text-white/70" : "text-text-muted")}>
                {g.abnormalCount}/{g.totalCount}
              </span>
            </button>
          ))}
        </div>

        {/* Metric pills within category */}
        <div className="flex flex-wrap gap-1.5 mb-5" role="tablist">
          {visibleMetrics.map((name) => {
            const hasAbnormal = metrics.some(
              (m) => m.metricName === name && m.isAbnormal
            );
            return (
              <button
                key={name}
                role="tab"
                aria-pressed={effectiveSelectedMetric === name}
                onClick={() => setSelectedMetric(name)}
                className={cn(
                  "px-2.5 py-1 rounded-full text-[11px] font-medium transition-all cursor-pointer",
                  effectiveSelectedMetric === name
                    ? "bg-primary text-white"
                    : "border border-card-border text-text-secondary hover:text-foreground hover:border-foreground/20",
                  hasAbnormal &&
                    effectiveSelectedMetric !== name &&
                    "border-severity-high/30 text-severity-high"
                )}
              >
                {getDisplayName(name, language)}
                {hasAbnormal && effectiveSelectedMetric !== name && " !"}
              </button>
            );
          })}
        </div>

        <div className="border-t border-card-border mb-6" />

        {filteredMetrics.length > 0 && (
          <>
            {latestConfidence && latestConfidence !== "high" && (
              <div className="flex items-center gap-2 mb-3">
                <ConfidenceBadge confidence={latestConfidence} />
                <span className="text-xs text-text-muted">
                  {language === "tr" ? "Bu deger dogrulanmali" : "This value should be verified"}
                </span>
              </div>
            )}
            <SmartChart
              data={filteredMetrics}
              metricName={getDisplayName(effectiveSelectedMetric, language)}
              unit={filteredMetrics[0]?.unit || ref?.unit || ""}
              referenceMin={filteredMetrics[0]?.referenceMin ?? ref?.min}
              referenceMax={filteredMetrics[0]?.referenceMax ?? ref?.max}
            />
          </>
        )}

        {filteredMetrics.length > 0 && (
          <div className="flex items-center justify-between mt-4 px-1 text-xs text-text-muted">
            <div className="flex items-center gap-2">
              <span>
                {filteredMetrics.length} {language === "tr" ? "olcum" : "measurement"}
                {filteredMetrics.length !== 1 && language !== "tr" && "s"}
              </span>
              <MetricTooltip metricKey={effectiveSelectedMetric} language={language} />
            </div>
            <div className="flex items-center gap-3">
              {/* Plain-language status */}
              {(() => {
                const latest = filteredMetrics.at(-1);
                const refMin = latest?.referenceMin ?? ref?.min;
                const refMax = latest?.referenceMax ?? ref?.max;
                if (latest && refMin != null && refMax != null) {
                  const status = getMetricStatus(latest.value, refMin, refMax, language);
                  return <span className={cn("font-medium", status.color)}>{status.label}</span>;
                }
                return null;
              })()}
              {(filteredMetrics[0]?.referenceMin != null || ref?.min != null) && (
                <span>
                  Ref: {filteredMetrics[0]?.referenceMin ?? ref?.min}–
                  {filteredMetrics[0]?.referenceMax ?? ref?.max}{" "}
                  {filteredMetrics[0]?.unit || ref?.unit || ""}
                </span>
              )}
            </div>
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

function MiniMetrics({ metrics, language = "en" }: { metrics: BloodMetricData[]; language?: string }) {
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
      <MetricsHeader language={language} />
      <GlassCard className="p-4">
        <p className="text-xs text-text-muted mb-2 font-medium">
          {getDisplayName(autoMetric, language)}
        </p>
        {data.length > 0 && (
          <SmartChart
            data={data}
            metricName={getDisplayName(autoMetric, language)}
            unit={data[0]?.unit || ref?.unit || ""}
            referenceMin={data[0]?.referenceMin ?? ref?.min}
            referenceMax={data[0]?.referenceMax ?? ref?.max}
            height="h-40"
          />
        )}
        {metricNames.length > 1 && (
          <p className="text-xs text-primary mt-2 font-medium">
            + {metricNames.length - 1} {language === "tr" ? "metrik daha" : `more metric${metricNames.length > 2 ? "s" : ""}`}
          </p>
        )}
      </GlassCard>
    </section>
  );
}

// ── sparklines ────────────────────────────────────────────

function SparklinesMetrics({ metrics, language = "en" }: { metrics: BloodMetricData[]; language?: string }) {
  const metricNames = useMetricNames(metrics);
  if (metricNames.length === 0) return null;

  return (
    <section id="metrics">
      <MetricsHeader language={language} />
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {metricNames.map((name) => {
          const data = getSorted(metrics, name);
          const ref = getRef(name);
          const latest = data[data.length - 1];
          const latestAbnormal = latest?.isAbnormal;
          const chartData = data.map((d) => ({
            date: format(new Date(d.measuredAt), "MMM d"),
            value: d.value,
          }));

          // Determine sparkline stroke color based on latest value status
          const strokeColor = latestAbnormal ? "#C93B3B" : (ref && latest && (latest.value < ref.min * 1.1 || latest.value > ref.max * 0.9) && latest.value >= ref.min && latest.value <= ref.max) ? "#C47D1A" : "#3A8F5C";

          return (
            <GlassCard key={name} className="p-3">
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs font-medium truncate">{getDisplayName(name, language)}</p>
                {latest && (
                  <p className={cn(
                    "text-sm font-semibold tabular-nums",
                    latestAbnormal ? "text-severity-high" : "text-foreground"
                  )}>
                    {latest.value}
                    <span className="text-[10px] text-text-muted ml-0.5">{latest.unit}</span>
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
                        fill="rgba(58,143,92,0.15)"
                      />
                    )}
                    <Line
                      type="monotone"
                      dataKey="value"
                      stroke={strokeColor}
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

// ── grid (with body-system grouping) ─────────────────────

function GridMetrics({ metrics, language = "en" }: { metrics: BloodMetricData[]; language?: string }) {
  const metricNames = useMetricNames(metrics);
  const categoryGroups = useCategoryGroups(metrics, metricNames, language);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  if (metricNames.length === 0) return null;

  const toggleGroup = (cat: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

  return (
    <section id="metrics">
      <MetricsHeader
        language={language}
        extra={
          <span className="text-sm text-text-muted">
            {metricNames.length} {language === "tr" ? "metrik izleniyor" : "metrics tracked"}
          </span>
        }
      />

      <div className="space-y-4 max-h-[700px] overflow-y-auto pr-1">
        {categoryGroups.map((group) => {
          const isCollapsed = collapsedGroups.has(group.category);
          return (
            <div key={group.category}>
              {/* Category header */}
              <button
                onClick={() => toggleGroup(group.category)}
                className="flex items-center gap-2 w-full text-left mb-3 group cursor-pointer"
              >
                {isCollapsed ? (
                  <ChevronRight className="w-4 h-4 text-text-muted" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-text-muted" />
                )}
                <TrafficLight status={group.status} />
                <span className="text-sm font-semibold group-hover:text-primary transition-colors">
                  {group.displayName}
                </span>
                <span className="text-xs text-text-muted">
                  {group.totalCount - group.abnormalCount}/{group.totalCount} {language === "tr" ? "normal" : "normal"}
                </span>
              </button>

              {/* Metric cards within this category */}
              {!isCollapsed && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 ml-6">
                  {group.metricNames.map((name) => {
                    const data = getSorted(metrics, name);
                    const ref = getRef(name);

                    return (
                      <GlassCard key={name} className="p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <p className="text-sm font-medium">{getDisplayName(name, language)}</p>
                          <ConfidenceBadge confidence={data.at(-1)?.confidence} />
                        </div>
                        <SmartChart
                          data={data}
                          metricName={getDisplayName(name, language)}
                          unit={data[0]?.unit || ref?.unit || ""}
                          referenceMin={data[0]?.referenceMin ?? ref?.min}
                          referenceMax={data[0]?.referenceMax ?? ref?.max}
                          height="h-48"
                        />
                      </GlassCard>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ── delta (table view) ────────────────────────────────────

function DeltaMetrics({ metrics, comparisonDateA, comparisonDateB, language = "en" }: { metrics: BloodMetricData[]; comparisonDateA?: string; comparisonDateB?: string; language?: string }) {
  const metricNames = useMetricNames(metrics);
  if (metricNames.length === 0) return null;

  const rows = metricNames.map((name) => {
    const { prev, curr } = getComparisonPair(metrics, name, comparisonDateA, comparisonDateB);
    const ref = getRef(name);
    const pct = prev && curr ? deltaPercent(prev.value, curr.value) : null;
    return { name, ref, prev, curr, pct };
  });

  return (
    <section id="metrics">
      <MetricsHeader language={language} />
      <GlassCard className="overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-card-border bg-secondary/30">
              <th className="text-left p-3 font-medium text-text-muted">{language === "tr" ? "Metrik" : "Metric"}</th>
              <th className="text-right p-3 font-medium text-text-muted">{language === "tr" ? "Onceki" : "Previous"}</th>
              <th className="text-right p-3 font-medium text-text-muted">{language === "tr" ? "Guncel" : "Current"}</th>
              <th className="text-right p-3 font-medium text-text-muted">{language === "tr" ? "Degisim" : "Change"}</th>
              <th className="text-center p-3 font-medium text-text-muted">{language === "tr" ? "Durum" : "Status"}</th>
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
                  <td className="p-3 font-medium">{getDisplayName(name, language)}</td>
                  <td className="p-3 text-right text-text-muted">
                    {prev ? `${prev.value} ${prev.unit}` : "\u2013"}
                  </td>
                  <td className="p-3 text-right">
                    {curr ? `${curr.value} ${curr.unit}` : "\u2013"}
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
                      "\u2013"
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

function ComparisonMetrics({ metrics, comparisonDateA, comparisonDateB, language = "en" }: { metrics: BloodMetricData[]; comparisonDateA?: string; comparisonDateB?: string; language?: string }) {
  const metricNames = useMetricNames(metrics);
  const [selectedMetric, setSelectedMetric] = useState<string>(metricNames[0] || "");

  const filteredMetrics = useMemo(
    () => getSorted(metrics, selectedMetric),
    [metrics, selectedMetric]
  );

  const ref = getRef(selectedMetric);
  const { prev, curr } = getComparisonPair(metrics, selectedMetric, comparisonDateA, comparisonDateB);

  if (metricNames.length === 0) return null;

  return (
    <section id="metrics">
      <MetricsHeader language={language} />
      <GlassCard className="p-6">
        {/* Delta header */}
        {prev && curr && (
          <div className="flex items-center gap-4 mb-4 p-3 rounded-xl bg-secondary/30">
            <span className="text-sm font-medium">{getDisplayName(selectedMetric, language)}</span>
            <span className="text-sm text-text-muted">
              {prev.value} {prev.unit}
            </span>
            <span className="text-text-muted">{"\u2192"}</span>
            <span className="text-sm font-medium">
              {curr.value} {curr.unit}
            </span>
            <DeltaChip prev={prev.value} curr={curr.value} />
          </div>
        )}

        <div className="flex flex-wrap gap-2 mb-6 max-h-24 overflow-y-auto" role="tablist">
          {metricNames.map((name) => {
            const hasAbnormal = metrics.some(
              (m) => m.metricName === name && m.isAbnormal
            );
            return (
              <button
                key={name}
                role="tab"
                aria-pressed={selectedMetric === name}
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
                {getDisplayName(name, language)}
                {hasAbnormal && selectedMetric !== name && " !"}
              </button>
            );
          })}
        </div>

        <div className="border-t border-card-border mb-6" />

        {filteredMetrics.length > 0 && (
          <SmartChart
            data={filteredMetrics}
            metricName={getDisplayName(selectedMetric, language)}
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

function ComparisonGridMetrics({ metrics, comparisonDateA, comparisonDateB, language = "en" }: { metrics: BloodMetricData[]; comparisonDateA?: string; comparisonDateB?: string; language?: string }) {
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
      <MetricsHeader language={language} />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 max-h-[600px] overflow-y-auto pr-1">
        {sorted.map((name) => {
          const data = getSorted(metrics, name);
          const ref = getRef(name);
          const { prev, curr } = getComparisonPair(metrics, name, comparisonDateA, comparisonDateB);

          return (
            <GlassCard key={name} className="p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium">{getDisplayName(name, language)}</p>
                {prev && curr && <DeltaChip prev={prev.value} curr={curr.value} />}
              </div>
              <SmartChart
                data={data}
                metricName={getDisplayName(name, language)}
                unit={data[0]?.unit || ref?.unit || ""}
                referenceMin={data[0]?.referenceMin ?? ref?.min}
                referenceMax={data[0]?.referenceMax ?? ref?.max}
                height="h-48"
              />
            </GlassCard>
          );
        })}
      </div>
    </section>
  );
}
