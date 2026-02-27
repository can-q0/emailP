"use client";

import { useState } from "react";
import { useTypewriter } from "@/hooks/useTypewriter";
import { GlassCard } from "@/components/ui/glass-card";
import { FileText } from "lucide-react";
import type { SummaryVariant } from "@/config/report-layouts";

interface GeneralSummaryProps {
  summary: string;
  variant?: SummaryVariant;
}

export function GeneralSummary({ summary, variant = "default" }: GeneralSummaryProps) {
  if (variant === "compact") return <CompactSummary summary={summary} />;
  if (variant === "comparison") return <ComparisonSummary summary={summary} />;
  return <DefaultSummary summary={summary} />;
}

function DefaultSummary({ summary }: { summary: string }) {
  const { displayedText, isComplete } = useTypewriter({
    text: summary,
    speed: 15,
  });

  return (
    <section id="summary">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 rounded-xl bg-primary/10">
          <FileText className="w-5 h-5 text-primary" />
        </div>
        <h2 className="text-xl font-bold">General Summary</h2>
      </div>

      <GlassCard className="p-6">
        <div className="prose prose-sm max-w-none">
          <p className="whitespace-pre-wrap leading-relaxed text-foreground/80">
            {displayedText}
            {!isComplete && (
              <span className="inline-block w-0.5 h-4 bg-primary ml-0.5 animate-pulse" />
            )}
          </p>
        </div>
      </GlassCard>
    </section>
  );
}

function CompactSummary({ summary }: { summary: string }) {
  const [expanded, setExpanded] = useState(false);
  const truncated = summary.length > 200 && !expanded;
  const displayText = truncated ? summary.slice(0, 200) + "..." : summary;

  return (
    <section id="summary">
      <GlassCard className="p-4">
        <p className="text-sm text-foreground/80 whitespace-pre-wrap leading-relaxed">
          {displayText}
        </p>
        {summary.length > 200 && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="mt-2 text-xs text-primary font-medium hover:underline cursor-pointer"
          >
            {expanded ? "Show less" : "Show more"}
          </button>
        )}
      </GlassCard>
    </section>
  );
}

function ComparisonSummary({ summary }: { summary: string }) {
  const paragraphs = summary.split(/\n\n+/);
  const midpoint = Math.ceil(paragraphs.length / 2);
  const leftText = paragraphs.slice(0, midpoint).join("\n\n");
  const rightText = paragraphs.slice(midpoint).join("\n\n") || leftText;

  return (
    <section id="summary">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 rounded-xl bg-primary/10">
          <FileText className="w-5 h-5 text-primary" />
        </div>
        <h2 className="text-xl font-bold">General Summary</h2>
      </div>

      <GlassCard className="p-0 overflow-hidden">
        <div className="grid grid-cols-1 md:grid-cols-2 md:divide-x divide-card-border">
          <div className="p-5">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-3">
              Overview
            </h3>
            <p className="text-sm text-foreground/80 whitespace-pre-wrap leading-relaxed">
              {leftText}
            </p>
          </div>
          <div className="p-5 border-t md:border-t-0 border-card-border">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-3">
              Key Changes
            </h3>
            <p className="text-sm text-foreground/80 whitespace-pre-wrap leading-relaxed">
              {rightText}
            </p>
          </div>
        </div>
      </GlassCard>
    </section>
  );
}
