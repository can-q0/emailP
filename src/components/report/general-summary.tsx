"use client";

import { useTypewriter } from "@/hooks/useTypewriter";
import { GlassCard } from "@/components/ui/glass-card";
import { FileText } from "lucide-react";

interface GeneralSummaryProps {
  summary: string;
}

export function GeneralSummary({ summary }: GeneralSummaryProps) {
  const { displayedText, isComplete } = useTypewriter({
    text: summary,
    speed: 15,
  });

  return (
    <section id="summary">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 rounded-xl bg-sky-accent/10">
          <FileText className="w-5 h-5 text-sky-accent" />
        </div>
        <h2 className="text-xl font-bold">General Summary</h2>
      </div>

      <GlassCard className="p-6">
        <div className="prose prose-invert prose-sm max-w-none">
          <p className="whitespace-pre-wrap leading-relaxed text-foreground/80">
            {displayedText}
            {!isComplete && (
              <span className="inline-block w-0.5 h-4 bg-sky-accent ml-0.5 animate-pulse" />
            )}
          </p>
        </div>
      </GlassCard>
    </section>
  );
}
