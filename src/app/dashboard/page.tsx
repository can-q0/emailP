"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState, useEffect, useRef, useCallback } from "react";
import { Navbar } from "@/components/navbar";
import { GlassCard } from "@/components/ui/glass-card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, FileText, Clock, ArrowRight } from "lucide-react";
import { usePatientSuggestions } from "@/hooks/usePatientSuggestions";

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [patientName, setPatientName] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const { suggestions } = usePatientSuggestions(patientName);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/auth/signin");
  }, [status, router]);

  useEffect(() => {
    setShowDropdown(suggestions.length > 0);
    setHighlightedIndex(-1);
  }, [suggestions]);

  const pickSuggestion = useCallback(
    (name: string) => {
      setPatientName(name);
      setShowDropdown(false);
      router.push(`/query?patient=${encodeURIComponent(name)}`);
    },
    [router]
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showDropdown || suggestions.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIndex((prev) =>
        prev < suggestions.length - 1 ? prev + 1 : 0
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex((prev) =>
        prev > 0 ? prev - 1 : suggestions.length - 1
      );
    } else if (e.key === "Enter" && highlightedIndex >= 0) {
      e.preventDefault();
      pickSuggestion(suggestions[highlightedIndex].name);
    } else if (e.key === "Escape") {
      setShowDropdown(false);
    }
  };

  if (status === "loading" || !session) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (patientName.trim()) {
      router.push(`/query?patient=${encodeURIComponent(patientName.trim())}`);
    }
  };

  return (
    <div className="min-h-screen">
      <Navbar />
      <div className="max-w-4xl mx-auto px-6 py-16">
        {/* Welcome */}
        <div className="mb-12">
          <h1 className="text-3xl font-bold mb-2">
            Welcome back, {session.user?.name?.split(" ")[0]}
          </h1>
          <p className="text-text-secondary">
            Search for a patient to generate a new report.
          </p>
        </div>

        {/* Search */}
        <GlassCard className="p-8 mb-12">
          <form onSubmit={handleSearch} className="flex gap-3">
            <div
              className="relative flex-1"
              ref={dropdownRef}
              onBlur={(e) => {
                if (!dropdownRef.current?.contains(e.relatedTarget as Node)) {
                  setShowDropdown(false);
                }
              }}
            >
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
              <Input
                ref={inputRef}
                value={patientName}
                onChange={(e) => setPatientName(e.target.value)}
                onFocus={() => {
                  if (suggestions.length > 0) setShowDropdown(true);
                }}
                onKeyDown={handleKeyDown}
                placeholder="Enter patient name..."
                className="pl-10"
                autoFocus
                autoComplete="off"
              />

              {/* Suggestions dropdown */}
              {showDropdown && suggestions.length > 0 && (
                <div className="absolute z-50 top-full left-0 right-0 mt-1 rounded-lg border border-card-border bg-card-bg/95 backdrop-blur-sm shadow-lg overflow-hidden">
                  {suggestions.map((s, i) => (
                    <button
                      key={s.id}
                      type="button"
                      className={`w-full px-4 py-2.5 flex items-center justify-between text-left text-sm transition-colors ${
                        i === highlightedIndex
                          ? "bg-primary/10 text-primary"
                          : "hover:bg-card-hover"
                      }`}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        pickSuggestion(s.name);
                      }}
                      onMouseEnter={() => setHighlightedIndex(i)}
                    >
                      <span className="font-medium">{s.name}</span>
                      {s.reportCount > 0 && (
                        <span className="text-xs text-text-muted bg-card-hover px-2 py-0.5 rounded-full">
                          {s.reportCount} {s.reportCount === 1 ? "report" : "reports"}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <Button type="submit" disabled={!patientName.trim()}>
              <ArrowRight className="w-4 h-4 mr-1" />
              Search
            </Button>
          </form>
        </GlassCard>

        {/* Quick actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <GlassCard
            className="p-6 cursor-pointer"
            hover
            onClick={() => router.push("/report")}
          >
            <div className="flex items-start gap-4">
              <div className="p-2.5 rounded-xl bg-primary/10">
                <FileText className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold mb-1">View Reports</h3>
                <p className="text-sm text-text-secondary">
                  Browse your previously generated patient reports.
                </p>
              </div>
            </div>
          </GlassCard>
          <GlassCard className="p-6 cursor-pointer" hover>
            <div className="flex items-start gap-4">
              <div className="p-2.5 rounded-xl bg-severity-medium/10">
                <Clock className="w-5 h-5 text-severity-medium" />
              </div>
              <div>
                <h3 className="font-semibold mb-1">Recent Activity</h3>
                <p className="text-sm text-text-secondary">
                  Your recent email syncs and report generation.
                </p>
              </div>
            </div>
          </GlassCard>
        </div>
      </div>
    </div>
  );
}
