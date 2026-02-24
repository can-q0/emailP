"use client";

import { motion } from "framer-motion";
import { GlassCard } from "@/components/ui/glass-card";
import { AttentionPoint } from "@/types";
import { AlertTriangle, AlertCircle, Info } from "lucide-react";
import { cn } from "@/lib/utils";

interface AttentionPointsProps {
  points: AttentionPoint[];
}

const severityConfig = {
  high: {
    icon: AlertTriangle,
    color: "text-severity-high",
    bg: "bg-severity-high/10",
    border: "border-severity-high/20",
    badge: "bg-severity-high/10 text-severity-high",
  },
  medium: {
    icon: AlertCircle,
    color: "text-severity-medium",
    bg: "bg-severity-medium/10",
    border: "border-severity-medium/20",
    badge: "bg-severity-medium/10 text-severity-medium",
  },
  low: {
    icon: Info,
    color: "text-severity-low",
    bg: "bg-severity-low/10",
    border: "border-severity-low/20",
    badge: "bg-severity-low/10 text-severity-low",
  },
};

export function AttentionPoints({ points }: AttentionPointsProps) {
  return (
    <section id="attention">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 rounded-xl bg-severity-medium/10">
          <AlertTriangle className="w-5 h-5 text-severity-medium" />
        </div>
        <h2 className="text-xl font-bold">Key Attention Points</h2>
      </div>

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

                    {/* Related metrics */}
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

                    {/* Recommendations */}
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
