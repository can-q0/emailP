"use client";

import { useState } from "react";
import { HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { getMetricDescription } from "@/config/blood-metrics";

interface MetricTooltipProps {
  metricKey: string;
  language?: string;
  className?: string;
}

export function MetricTooltip({ metricKey, language = "en", className }: MetricTooltipProps) {
  const [isOpen, setIsOpen] = useState(false);
  const description = getMetricDescription(metricKey, language);

  if (!description) return null;

  return (
    <span className={cn("relative inline-flex", className)}>
      <button
        type="button"
        onMouseEnter={() => setIsOpen(true)}
        onMouseLeave={() => setIsOpen(false)}
        onFocus={() => setIsOpen(true)}
        onBlur={() => setIsOpen(false)}
        className="text-text-muted hover:text-text-secondary transition-colors cursor-help"
        aria-label={`Info about ${metricKey}`}
      >
        <HelpCircle className="w-3.5 h-3.5" />
      </button>
      {isOpen && (
        <span
          role="tooltip"
          className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 rounded-lg bg-foreground text-background text-xs leading-relaxed max-w-[220px] w-max shadow-lg pointer-events-none"
        >
          {description}
          <span className="absolute top-full left-1/2 -translate-x-1/2 -mt-px w-0 h-0 border-x-4 border-x-transparent border-t-4 border-t-foreground" />
        </span>
      )}
    </span>
  );
}
