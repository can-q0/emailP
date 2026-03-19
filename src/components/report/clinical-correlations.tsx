"use client";

import { motion } from "framer-motion";
import { GlassCard } from "@/components/ui/glass-card";
import { ClinicalCorrelation } from "@/types";
import { Link2, AlertTriangle, AlertCircle, Info, Lightbulb } from "lucide-react";
import { cn } from "@/lib/utils";

interface ClinicalCorrelationsProps {
  correlations: ClinicalCorrelation[];
  language?: string;
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

export function ClinicalCorrelations({ correlations, language = "en" }: ClinicalCorrelationsProps) {
  if (correlations.length === 0) return null;

  return (
    <section id="correlations" aria-label="Clinical Correlations">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 rounded-xl bg-primary/10">
          <Link2 className="w-5 h-5 text-primary" />
        </div>
        <h2 className="text-xl font-bold">
          {language === "tr" ? "Klinik Korelasyonlar" : "Clinical Correlations"}
        </h2>
        <span className="text-sm text-text-muted">
          {correlations.length} {language === "tr" ? "patern tespit edildi" : "patterns detected"}
        </span>
      </div>

      <div className="space-y-3">
        {correlations.map((corr, i) => {
          const config = severityConfig[corr.severity];
          const Icon = config.icon;

          return (
            <motion.div
              key={`${corr.pattern}-${i}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
            >
              <GlassCard className={cn("p-5", config.border)}>
                <div className="flex items-start gap-3">
                  <div className={cn("p-1.5 rounded-lg", config.bg)}>
                    <Icon className={cn("w-4 h-4", config.color)} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <h3 className="font-semibold text-sm">{corr.pattern}</h3>
                      <span
                        className={cn(
                          "px-2 py-0.5 rounded-full text-xs font-medium",
                          config.badge
                        )}
                      >
                        {corr.severity}
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">
                        {language === "tr" ? "Algoritmik" : "Algorithmic"}
                      </span>
                    </div>

                    <p className="text-sm text-text-secondary mb-3">{corr.description}</p>

                    {/* Involved metrics */}
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {corr.involvedMetrics.map((metric) => (
                        <span
                          key={metric}
                          className="px-2 py-0.5 rounded-full text-xs bg-secondary/50 text-text-secondary border border-card-border"
                        >
                          {metric}
                        </span>
                      ))}
                    </div>

                    {/* Recommendation */}
                    <div className="flex items-start gap-2 p-2.5 rounded-lg bg-secondary/30">
                      <Lightbulb className="w-3.5 h-3.5 text-severity-medium mt-0.5 shrink-0" />
                      <p className="text-xs text-text-secondary leading-relaxed">
                        {corr.recommendation}
                      </p>
                    </div>
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
