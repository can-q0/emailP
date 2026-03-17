"use client";

import { useState, useEffect } from "react";
import { GlassCard } from "@/components/ui/glass-card";
import { Button } from "@/components/ui/button";
import { Loader2, Calendar } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface TestDate {
  date: string;
  metricCount: number;
}

interface ComparisonDatePickerProps {
  patientId: string;
  onSelect: (dateA: string, dateB: string) => void;
  onBack?: () => void;
}

export function ComparisonDatePicker({
  patientId,
  onSelect,
  onBack,
}: ComparisonDatePickerProps) {
  const [testDates, setTestDates] = useState<TestDate[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateA, setDateA] = useState<string | null>(null);
  const [dateB, setDateB] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/patients/${patientId}/test-dates`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setTestDates(data);
          // Default: earliest and latest
          if (data.length >= 2) {
            setDateA(data[0].date);
            setDateB(data[data.length - 1].date);
          }
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [patientId]);

  if (loading) {
    return (
      <div className="flex flex-col items-center py-12">
        <Loader2 className="w-8 h-8 text-primary animate-spin mb-4" />
        <p className="text-sm text-text-muted">Loading test dates...</p>
      </div>
    );
  }

  if (testDates.length < 2) {
    return (
      <GlassCard className="p-6 text-center">
        <Calendar className="w-8 h-8 text-text-muted mx-auto mb-3" />
        <p className="font-medium mb-1">Not enough test dates</p>
        <p className="text-sm text-text-muted mb-4">
          At least 2 different test dates are needed for comparison.
          This patient has {testDates.length} test date{testDates.length !== 1 ? "s" : ""}.
        </p>
        {onBack && (
          <Button variant="ghost" onClick={onBack}>
            Go Back
          </Button>
        )}
      </GlassCard>
    );
  }

  return (
    <GlassCard className="p-6">
      <div className="flex items-center gap-2 mb-6">
        <Calendar className="w-5 h-5 text-primary" />
        <h3 className="font-semibold">Select Dates to Compare</h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {/* Date A */}
        <div>
          <p className="text-sm font-medium text-text-secondary mb-2">Date A (earlier)</p>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {testDates.map((td) => {
              const dayStr = td.date.split("T")[0];
              const selected = dateA && dateA.split("T")[0] === dayStr;
              return (
                <button
                  key={`a-${td.date}`}
                  onClick={() => setDateA(td.date)}
                  className={cn(
                    "w-full flex items-center justify-between px-3 py-2 rounded-xl text-sm transition-all cursor-pointer",
                    selected
                      ? "bg-primary text-white"
                      : "border border-card-border hover:border-foreground/20"
                  )}
                >
                  <span>{format(new Date(td.date), "MMM d, yyyy")}</span>
                  <span
                    className={cn(
                      "text-xs px-2 py-0.5 rounded-full",
                      selected
                        ? "bg-white/20 text-white"
                        : "bg-secondary text-text-muted"
                    )}
                  >
                    {td.metricCount} metrics
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Date B */}
        <div>
          <p className="text-sm font-medium text-text-secondary mb-2">Date B (later)</p>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {testDates.map((td) => {
              const dayStr = td.date.split("T")[0];
              const selected = dateB && dateB.split("T")[0] === dayStr;
              return (
                <button
                  key={`b-${td.date}`}
                  onClick={() => setDateB(td.date)}
                  className={cn(
                    "w-full flex items-center justify-between px-3 py-2 rounded-xl text-sm transition-all cursor-pointer",
                    selected
                      ? "bg-primary text-white"
                      : "border border-card-border hover:border-foreground/20"
                  )}
                >
                  <span>{format(new Date(td.date), "MMM d, yyyy")}</span>
                  <span
                    className={cn(
                      "text-xs px-2 py-0.5 rounded-full",
                      selected
                        ? "bg-white/20 text-white"
                        : "bg-secondary text-text-muted"
                    )}
                  >
                    {td.metricCount} metrics
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between">
        {onBack && (
          <Button variant="ghost" onClick={onBack}>
            Back
          </Button>
        )}
        <Button
          onClick={() => dateA && dateB && onSelect(dateA, dateB)}
          disabled={!dateA || !dateB}
          className="ml-auto"
        >
          Compare These Dates
        </Button>
      </div>
    </GlassCard>
  );
}
