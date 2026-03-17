"use client";

import { motion } from "framer-motion";
import { GlassCard } from "@/components/ui/glass-card";
import { TrendAlert } from "@/types";
import { TrendingUp, TrendingDown, Activity } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

interface TrendAlertsProps {
  alerts: TrendAlert[];
}

const severityColors = {
  high: {
    bg: "bg-severity-high/10",
    border: "border-severity-high/20",
    text: "text-severity-high",
    badge: "bg-severity-high/10 text-severity-high",
  },
  medium: {
    bg: "bg-severity-medium/10",
    border: "border-severity-medium/20",
    text: "text-severity-medium",
    badge: "bg-severity-medium/10 text-severity-medium",
  },
  low: {
    bg: "bg-severity-low/10",
    border: "border-severity-low/20",
    text: "text-severity-low",
    badge: "bg-severity-low/10 text-severity-low",
  },
};

const typeLabels: Record<TrendAlert["type"], string> = {
  consecutive_worsening: "Consecutive Worsening",
  rapid_change: "Rapid Change",
  persistent_abnormal: "Persistent Abnormal",
};

export function TrendAlerts({ alerts }: TrendAlertsProps) {
  if (alerts.length === 0) return null;

  return (
    <section id="trends">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 rounded-xl bg-severity-high/10">
          <Activity className="w-5 h-5 text-severity-high" />
        </div>
        <h2 className="text-xl font-bold">Trend Alerts</h2>
        <span className="text-sm text-text-muted">
          {alerts.length} detected
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {alerts.map((alert, i) => {
          const colors = severityColors[alert.severity];
          const DirectionIcon =
            alert.direction === "worsening" ? TrendingUp : TrendingDown;

          return (
            <motion.div
              key={`${alert.metricName}-${alert.type}-${i}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
            >
              <GlassCard className={cn("p-4", colors.border)}>
                <div className="flex items-start gap-3">
                  <div className={cn("p-1.5 rounded-lg", colors.bg)}>
                    <DirectionIcon className={cn("w-4 h-4", colors.text)} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <h3 className="font-semibold text-sm">
                        {alert.displayName}
                      </h3>
                      <span
                        className={cn(
                          "px-2 py-0.5 rounded-full text-xs font-medium",
                          colors.badge
                        )}
                      >
                        {alert.severity}
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-secondary/50 text-text-muted">
                        {typeLabels[alert.type]}
                      </span>
                    </div>

                    <p className="text-xs text-text-secondary mb-2">
                      {alert.description}
                    </p>

                    {/* Mini reading timeline */}
                    {alert.readings.length > 0 && (
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {alert.readings.map((reading, j) => (
                          <span
                            key={j}
                            className={cn(
                              "px-2 py-0.5 rounded text-xs font-mono",
                              reading.isAbnormal
                                ? "bg-severity-high/10 text-severity-high"
                                : "bg-secondary/50 text-text-secondary"
                            )}
                            title={format(
                              new Date(reading.measuredAt),
                              "MMM d, yyyy"
                            )}
                          >
                            {reading.value}
                            {j < alert.readings.length - 1 && (
                              <span className="text-text-muted ml-1">&rarr;</span>
                            )}
                          </span>
                        ))}
                        <span className="text-xs text-text-muted ml-1">
                          {alert.readings[0]?.unit}
                        </span>
                      </div>
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
