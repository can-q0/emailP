"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import { GlassCard } from "@/components/ui/glass-card";
import { BloodMetricData } from "@/types";
import { bloodMetricReferences, getCategoryDisplayName } from "@/config/blood-metrics";
import { getMetricReference } from "@/lib/blood-metrics";
import { getMetricStatus } from "@/lib/metric-status";
import { MetricTooltip } from "./metric-tooltip";
import { cn } from "@/lib/utils";
import { Heart, ChevronRight, TrendingUp, TrendingDown, Minus } from "lucide-react";

interface HealthScorecardProps {
  metrics: BloodMetricData[];
  language?: string;
  onCategoryClick?: (category: string) => void;
}

interface CategoryScore {
  category: string;
  displayName: string;
  totalMetrics: number;
  normalCount: number;
  abnormalCount: number;
  status: "normal" | "borderline" | "abnormal";
  trend: "improving" | "stable" | "worsening";
  topMetrics: Array<{
    key: string;
    displayName: string;
    latestValue: number;
    unit: string;
    statusLabel: string;
    statusColor: string;
    refMin?: number;
    refMax?: number;
  }>;
}

function getRef(name: string) {
  return bloodMetricReferences[name] || getMetricReference(name);
}

export function HealthScorecard({ metrics, language = "en", onCategoryClick }: HealthScorecardProps) {
  const categories = useMemo(() => {
    // Group metrics by category
    const grouped = new Map<string, BloodMetricData[]>();
    for (const m of metrics) {
      const ref = getRef(m.metricName);
      const cat = ref?.category || "Other";
      if (!grouped.has(cat)) grouped.set(cat, []);
      grouped.get(cat)!.push(m);
    }

    const scores: CategoryScore[] = [];

    for (const [category, catMetrics] of grouped) {
      // Get unique metric names and their latest readings
      const latestByMetric = new Map<string, BloodMetricData>();
      for (const m of catMetrics) {
        const existing = latestByMetric.get(m.metricName);
        if (!existing || new Date(m.measuredAt) > new Date(existing.measuredAt)) {
          latestByMetric.set(m.metricName, m);
        }
      }

      const uniqueMetrics = [...latestByMetric.entries()];
      const totalMetrics = uniqueMetrics.length;
      let abnormalCount = 0;

      const topMetrics: CategoryScore["topMetrics"] = [];

      for (const [key, latest] of uniqueMetrics) {
        if (latest.isAbnormal) abnormalCount++;

        const ref = getRef(key);
        const refMin = latest.referenceMin ?? ref?.min;
        const refMax = latest.referenceMax ?? ref?.max;
        const status = refMin != null && refMax != null
          ? getMetricStatus(latest.value, refMin, refMax, language)
          : { label: "", color: "text-text-muted" };

        topMetrics.push({
          key,
          displayName: ref ? (language === "tr" ? ref.trName : ref.name) : key,
          latestValue: latest.value,
          unit: latest.unit,
          statusLabel: status.label,
          statusColor: status.color,
          refMin,
          refMax,
        });
      }

      // Sort: abnormal first
      topMetrics.sort((a, b) => {
        const aAbn = a.statusColor.includes("high") ? 0 : a.statusColor.includes("medium") ? 1 : 2;
        const bAbn = b.statusColor.includes("high") ? 0 : b.statusColor.includes("medium") ? 1 : 2;
        return aAbn - bAbn;
      });

      // Determine overall trend (simplified: compare first and last readings of abnormal metrics)
      let trend: "improving" | "stable" | "worsening" = "stable";
      for (const [key, latest] of uniqueMetrics) {
        const sorted = catMetrics
          .filter((m) => m.metricName === key)
          .sort((a, b) => new Date(a.measuredAt).getTime() - new Date(b.measuredAt).getTime());

        if (sorted.length >= 2) {
          const first = sorted[0];
          const last = sorted[sorted.length - 1];
          const ref = getRef(key);
          if (ref) {
            const midpoint = (ref.min + ref.max) / 2;
            const firstDist = Math.abs(first.value - midpoint);
            const lastDist = Math.abs(last.value - midpoint);
            if (lastDist > firstDist * 1.1) trend = "worsening";
            else if (lastDist < firstDist * 0.9 && trend !== "worsening") trend = "improving";
          }
        }
      }

      const normalCount = totalMetrics - abnormalCount;
      scores.push({
        category,
        displayName: getCategoryDisplayName(category, language),
        totalMetrics,
        normalCount,
        abnormalCount,
        status: abnormalCount === 0 ? "normal" : abnormalCount / totalMetrics > 0.5 ? "abnormal" : "borderline",
        trend,
        topMetrics,
      });
    }

    // Sort: abnormal categories first
    scores.sort((a, b) => {
      const order = { abnormal: 0, borderline: 1, normal: 2 };
      return order[a.status] - order[b.status];
    });

    return scores;
  }, [metrics, language]);

  if (categories.length === 0) return null;

  const totalAbnormal = categories.reduce((sum, c) => sum + c.abnormalCount, 0);
  const totalMetrics = categories.reduce((sum, c) => sum + c.totalMetrics, 0);

  const TrendIcon = (trend: string) => {
    if (trend === "improving") return <TrendingDown className="w-3.5 h-3.5 text-severity-low" />;
    if (trend === "worsening") return <TrendingUp className="w-3.5 h-3.5 text-severity-high" />;
    return <Minus className="w-3.5 h-3.5 text-text-muted" />;
  };

  return (
    <section id="scorecard" aria-label="Health Scorecard">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 rounded-xl bg-primary/10">
          <Heart className="w-5 h-5 text-primary" />
        </div>
        <h2 className="text-xl font-bold">
          {language === "tr" ? "Saglik Ozeti" : "Health Scorecard"}
        </h2>
        <span className="text-sm text-text-muted">
          {totalMetrics - totalAbnormal}/{totalMetrics} {language === "tr" ? "normal" : "normal"}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {categories.map((cat, i) => (
          <motion.div
            key={cat.category}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06 }}
          >
            <GlassCard
              hover
              className={cn(
                "p-4 cursor-pointer h-full flex flex-col",
                cat.status === "abnormal" && "border-severity-high/20",
                cat.status === "borderline" && "border-severity-medium/20"
              )}
              onClick={() => {
                // Scroll to metrics section
                onCategoryClick?.(cat.category);
                document.getElementById("metrics")?.scrollIntoView({ behavior: "smooth" });
              }}
            >
              {/* Category header */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "w-2.5 h-2.5 rounded-full",
                      cat.status === "normal" && "bg-severity-low",
                      cat.status === "borderline" && "bg-severity-medium",
                      cat.status === "abnormal" && "bg-severity-high"
                    )}
                  />
                  <h3 className="text-sm font-semibold">{cat.displayName}</h3>
                </div>
                <div className="flex items-center gap-1.5">
                  {TrendIcon(cat.trend)}
                  <ChevronRight className="w-3.5 h-3.5 text-text-muted" />
                </div>
              </div>

              {/* Ratio bar */}
              <div className="h-1.5 rounded-full bg-secondary/50 mb-3 overflow-hidden">
                <div
                  className={cn(
                    "h-full rounded-full transition-all",
                    cat.status === "normal" && "bg-severity-low",
                    cat.status === "borderline" && "bg-severity-medium",
                    cat.status === "abnormal" && "bg-severity-high"
                  )}
                  style={{ width: `${(cat.normalCount / cat.totalMetrics) * 100}%` }}
                />
              </div>

              {/* Top metrics (max 3) */}
              <div className="space-y-1.5 flex-1">
                {cat.topMetrics.slice(0, 3).map((m) => (
                  <div key={m.key} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1 min-w-0">
                      <span className="truncate text-text-secondary">{m.displayName}</span>
                      <MetricTooltip metricKey={m.key} language={language} />
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="font-mono font-medium">
                        {m.latestValue} <span className="text-text-muted">{m.unit}</span>
                      </span>
                      <span className={cn("text-[10px] font-medium", m.statusColor)}>
                        {m.statusLabel}
                      </span>
                    </div>
                  </div>
                ))}
                {cat.topMetrics.length > 3 && (
                  <p className="text-[10px] text-text-muted">
                    +{cat.topMetrics.length - 3} {language === "tr" ? "daha" : "more"}
                  </p>
                )}
              </div>
            </GlassCard>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
