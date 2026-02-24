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
    color: "text-red-400",
    bg: "bg-red-500/10",
    border: "border-red-500/20",
    badge: "bg-red-500/20 text-red-400",
  },
  medium: {
    icon: AlertCircle,
    color: "text-amber-400",
    bg: "bg-amber-500/10",
    border: "border-amber-500/20",
    badge: "bg-amber-500/20 text-amber-400",
  },
  low: {
    icon: Info,
    color: "text-green-400",
    bg: "bg-green-500/10",
    border: "border-green-500/20",
    badge: "bg-green-500/20 text-green-400",
  },
};

export function AttentionPoints({ points }: AttentionPointsProps) {
  return (
    <section id="attention">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 rounded-xl bg-amber-500/10">
          <AlertTriangle className="w-5 h-5 text-amber-400" />
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
                    <p className="text-sm text-foreground/60 mb-3">
                      {point.description}
                    </p>

                    {/* Related metrics */}
                    {point.relatedMetrics.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mb-3">
                        {point.relatedMetrics.map((metric) => (
                          <span
                            key={metric}
                            className="px-2 py-0.5 rounded-full text-xs bg-sky-accent/10 text-sky-accent border border-sky-accent/20"
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
                            className="text-sm text-foreground/50 flex items-start gap-2"
                          >
                            <span className="text-sky-accent mt-1">•</span>
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
