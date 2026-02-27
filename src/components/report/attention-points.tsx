"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { GlassCard } from "@/components/ui/glass-card";
import { AttentionPoint } from "@/types";
import { AlertTriangle, AlertCircle, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AttentionVariant } from "@/config/report-layouts";

interface AttentionPointsProps {
  points: AttentionPoint[];
  variant?: AttentionVariant;
}

const severityConfig = {
  high: {
    icon: AlertTriangle,
    color: "text-severity-high",
    bg: "bg-severity-high/10",
    border: "border-severity-high/20",
    badge: "bg-severity-high/10 text-severity-high",
    chipBorder: "border-severity-high/40",
  },
  medium: {
    icon: AlertCircle,
    color: "text-severity-medium",
    bg: "bg-severity-medium/10",
    border: "border-severity-medium/20",
    badge: "bg-severity-medium/10 text-severity-medium",
    chipBorder: "border-severity-medium/40",
  },
  low: {
    icon: Info,
    color: "text-severity-low",
    bg: "bg-severity-low/10",
    border: "border-severity-low/20",
    badge: "bg-severity-low/10 text-severity-low",
    chipBorder: "border-severity-low/40",
  },
};

export function AttentionPoints({ points, variant = "default" }: AttentionPointsProps) {
  if (variant === "compact") return <CompactAttention points={points} />;
  if (variant === "list") return <ListAttention points={points} />;
  if (variant === "badges") return <BadgesAttention points={points} />;
  if (variant === "grid") return <GridAttention points={points} />;
  return <DefaultAttention points={points} />;
}

// ── Section header ────────────────────────────────────────

function AttentionHeader() {
  return (
    <div className="flex items-center gap-3 mb-4">
      <div className="p-2 rounded-xl bg-severity-medium/10">
        <AlertTriangle className="w-5 h-5 text-severity-medium" />
      </div>
      <h2 className="text-xl font-bold">Key Attention Points</h2>
    </div>
  );
}

// ── default ───────────────────────────────────────────────

function DefaultAttention({ points }: { points: AttentionPoint[] }) {
  return (
    <section id="attention">
      <AttentionHeader />
      <div className="space-y-3">
        {points.map((point, i) => {
          const config = severityConfig[point.severity];
          const Icon = config.icon;

          return (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
            >
              <GlassCard className={cn("p-5", config.border)}>
                <div className="flex items-start gap-3">
                  <div className={cn("p-1.5 rounded-lg", config.bg)}>
                    <Icon className={cn("w-4 h-4", config.color)} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold">{point.title}</h3>
                      <span
                        className={cn(
                          "px-2 py-0.5 rounded-full text-xs font-medium",
                          config.badge
                        )}
                      >
                        {point.severity}
                      </span>
                    </div>
                    <p className="text-sm text-text-secondary mb-3">
                      {point.description}
                    </p>

                    {point.relatedMetrics.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mb-3">
                        {point.relatedMetrics.map((metric) => (
                          <span
                            key={metric}
                            className="px-2 py-0.5 rounded-full text-xs bg-primary/10 text-primary border border-primary/20"
                          >
                            {metric}
                          </span>
                        ))}
                      </div>
                    )}

                    {point.recommendations.length > 0 && (
                      <ul className="space-y-1">
                        {point.recommendations.map((rec, j) => (
                          <li
                            key={j}
                            className="text-sm text-text-secondary flex items-start gap-2"
                          >
                            <span className="text-primary mt-1">•</span>
                            {rec}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </GlassCard>
            </motion.div>
          );
        })}
      </div>
    </section>
  );
}

// ── compact ───────────────────────────────────────────────

function CompactAttention({ points }: { points: AttentionPoint[] }) {
  const filtered = points.filter(
    (p) => p.severity === "high" || p.severity === "medium"
  );
  if (filtered.length === 0) return null;

  return (
    <section id="attention">
      <AttentionHeader />
      <div className="space-y-2">
        {filtered.map((point, i) => {
          const config = severityConfig[point.severity];
          const Icon = config.icon;

          return (
            <div
              key={i}
              className={cn(
                "flex items-center gap-3 px-4 py-2.5 rounded-xl border",
                config.border,
                "bg-card"
              )}
            >
              <Icon className={cn("w-4 h-4 shrink-0", config.color)} />
              <span className="font-medium text-sm truncate flex-1">
                {point.title}
              </span>
              <span
                className={cn(
                  "px-2 py-0.5 rounded-full text-xs font-medium shrink-0",
                  config.badge
                )}
              >
                {point.severity}
              </span>
              {point.recommendations[0] && (
                <span className="text-xs text-text-muted truncate max-w-[200px] hidden md:inline">
                  {point.recommendations[0]}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ── list ──────────────────────────────────────────────────

function ListAttention({ points }: { points: AttentionPoint[] }) {
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);

  return (
    <section id="attention">
      <AttentionHeader />
      <GlassCard className="p-5">
        <ul className="space-y-3">
          {points.map((point, i) => {
            const config = severityConfig[point.severity];
            const Icon = config.icon;
            const isExpanded = expandedIdx === i;

            return (
              <li key={i}>
                <div className="flex items-start gap-2">
                  <Icon className={cn("w-4 h-4 mt-0.5 shrink-0", config.color)} />
                  <div className="flex-1">
                    <span className="font-medium text-sm">{point.title}</span>
                    <p className="text-xs text-text-muted mt-0.5">
                      {point.description.length > 100 && !isExpanded
                        ? point.description.slice(0, 100) + "..."
                        : point.description}
                    </p>
                    {point.recommendations.length > 0 && (
                      <>
                        {isExpanded && (
                          <ul className="mt-2 space-y-1 text-xs text-text-secondary">
                            {point.recommendations.map((rec, j) => (
                              <li key={j} className="flex items-start gap-1.5">
                                <span className="text-primary">•</span>
                                {rec}
                              </li>
                            ))}
                          </ul>
                        )}
                        <button
                          onClick={() => setExpandedIdx(isExpanded ? null : i)}
                          className="text-xs text-primary font-medium mt-1 hover:underline cursor-pointer"
                        >
                          {isExpanded ? "Show less" : "Show more"}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </GlassCard>
    </section>
  );
}

// ── badges ────────────────────────────────────────────────

function BadgesAttention({ points }: { points: AttentionPoint[] }) {
  const highOnly = points.filter((p) => p.severity === "high");
  if (highOnly.length === 0) return null;

  return (
    <section id="attention">
      <AttentionHeader />
      <div className="flex flex-wrap gap-2">
        {highOnly.map((point, i) => {
          const config = severityConfig[point.severity];
          return (
            <span
              key={i}
              className={cn(
                "px-3 py-1 rounded-full text-xs font-medium border",
                config.badge,
                config.chipBorder
              )}
            >
              {point.title}
            </span>
          );
        })}
      </div>
    </section>
  );
}

// ── grid ──────────────────────────────────────────────────

function GridAttention({ points }: { points: AttentionPoint[] }) {
  return (
    <section id="attention">
      <AttentionHeader />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {points.map((point, i) => {
          const config = severityConfig[point.severity];
          const Icon = config.icon;

          return (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
            >
              <GlassCard className={cn("p-5", config.border)}>
                <div className="flex items-start gap-3">
                  <div className={cn("p-1.5 rounded-lg", config.bg)}>
                    <Icon className={cn("w-4 h-4", config.color)} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-sm">{point.title}</h3>
                      <span
                        className={cn(
                          "px-2 py-0.5 rounded-full text-xs font-medium",
                          config.badge
                        )}
                      >
                        {point.severity}
                      </span>
                    </div>
                    <p className="text-xs text-text-secondary mb-2">
                      {point.description}
                    </p>
                    {point.recommendations.length > 0 && (
                      <ul className="space-y-1">
                        {point.recommendations.map((rec, j) => (
                          <li
                            key={j}
                            className="text-xs text-text-secondary flex items-start gap-1.5"
                          >
                            <span className="text-primary mt-0.5">•</span>
                            {rec}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </GlassCard>
            </motion.div>
          );
        })}
      </div>
    </section>
  );
}
