"use client";

import { useEffect, useState } from "react";
import { ReportData, AttentionPoint } from "@/types";
import {
  LayoutConfig,
  SectionConfig,
  SummaryVariant,
  MetricsVariant,
  AttentionVariant,
  EmailsVariant,
} from "@/config/report-layouts";
import { GeneralSummary } from "./general-summary";
import { BloodMetricsChart } from "./blood-metrics-chart";
import { AttentionPoints } from "./attention-points";
import { TrendAlerts } from "./trend-alerts";
import { EmailTimeline } from "./email-timeline";
import { HealthScorecard } from "./health-scorecard";
import { ClinicalCorrelations } from "./clinical-correlations";
import { ScrollReveal } from "@/components/ui/scroll-reveal";
import { FileText, Activity, AlertTriangle, Mail } from "lucide-react";
import { cn } from "@/lib/utils";

interface ReportLayoutProps {
  report: ReportData;
  layout: LayoutConfig;
  language?: string;
}

const sectionIcons: Record<string, typeof FileText> = {
  summary: FileText,
  metrics: Activity,
  attention: AlertTriangle,
  emails: Mail,
};

function SectionComponent({
  section,
  report,
  language = "en",
}: {
  section: SectionConfig;
  report: ReportData;
  language?: string;
}) {
  const attentionPoints = (report.attentionPoints || []) as AttentionPoint[];

  switch (section.id) {
    case "summary":
      return report.summary ? (
        <GeneralSummary
          summary={report.summary}
          variant={section.variant as SummaryVariant}
        />
      ) : null;
    case "metrics":
      return report.bloodMetrics.length > 0 ? (
        <BloodMetricsChart
          metrics={report.bloodMetrics}
          variant={section.variant as MetricsVariant}
          comparisonDateA={report.comparisonDateA}
          comparisonDateB={report.comparisonDateB}
          language={language}
        />
      ) : null;
    case "attention":
      return attentionPoints.length > 0 ? (
        <AttentionPoints
          points={attentionPoints}
          variant={section.variant as AttentionVariant}
          language={language}
        />
      ) : null;
    case "emails":
      return report.emails.length > 0 ? (
        <EmailTimeline
          emails={report.emails}
          variant={section.variant as EmailsVariant}
        />
      ) : null;
    default:
      return null;
  }
}

// ── Sidebar Nav ────────────────────────────────────────────

function SidebarNav({
  sections,
  activeSection,
}: {
  sections: SectionConfig[];
  activeSection: string;
}) {
  return (
    <nav className="hidden lg:block w-48 shrink-0">
      <div className="sticky top-20 space-y-1">
        {sections.map(({ id, label }) => {
          const Icon = sectionIcons[id] || FileText;
          return (
            <a
              key={id}
              href={`#${id}`}
              onClick={(e) => {
                e.preventDefault();
                document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
              }}
              className={cn(
                "flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all",
                activeSection === id
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-text-muted hover:text-text-secondary"
              )}
            >
              {activeSection === id && (
                <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
              )}
              <Icon className="w-4 h-4" />
              {label}
            </a>
          );
        })}
      </div>
    </nav>
  );
}

// ── Layout structures ──────────────────────────────────────

const spacingClass = {
  compact: "space-y-6",
  normal: "space-y-8",
  spacious: "space-y-12",
} as const;

export function ReportLayout({ report, layout, language = "en" }: ReportLayoutProps) {
  const [activeSection, setActiveSection] = useState<string>(layout.sections[0]?.id || "summary");

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id);
          }
        }
      },
      { rootMargin: "-20% 0px -70% 0px" }
    );

    layout.sections.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [layout.sections]);

  const sectionTourMap: Record<string, string> = {
    summary: "ai-summary",
    metrics: "blood-chart",
    attention: "attention-points",
  };

  const renderSections = (sections: SectionConfig[]) =>
    sections.map((section, i) => (
      <ScrollReveal key={section.id} delay={i * 0.1}>
        <div data-tour={sectionTourMap[section.id]}>
          <SectionComponent section={section} report={report} language={language} />
        </div>
      </ScrollReveal>
    ));

  const scorecardBlock = report.bloodMetrics.length > 0
    ? <ScrollReveal><HealthScorecard metrics={report.bloodMetrics} language={language} /></ScrollReveal>
    : null;

  const trendAlertsBlock = report.trendAlerts && report.trendAlerts.length > 0
    ? <ScrollReveal><TrendAlerts alerts={report.trendAlerts} /></ScrollReveal>
    : null;

  const correlationsBlock = null;

  // ── two-column layout ──────────────────────────────────
  if (layout.structure === "two-column") {
    const leftSections = layout.sections.slice(0, 1);
    const rightSections = layout.sections.slice(1);

    return (
      <div className={cn(spacingClass[layout.spacing])}>
        {scorecardBlock}
        {trendAlertsBlock}
        {correlationsBlock}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <div className={cn("lg:col-span-3", spacingClass[layout.spacing])}>
            {renderSections(leftSections)}
          </div>
          <div className={cn("lg:col-span-2", spacingClass[layout.spacing])}>
            {renderSections(rightSections)}
          </div>
        </div>
      </div>
    );
  }

  // ── dashboard-grid layout ──────────────────────────────
  if (layout.structure === "dashboard-grid") {
    return (
      <div className={cn(spacingClass[layout.spacing])}>
        {scorecardBlock}
        {trendAlertsBlock}
        {correlationsBlock}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {layout.sections.map((section, i) => (
            <ScrollReveal key={section.id} delay={i * 0.1}>
              <SectionComponent section={section} report={report} language={language} />
            </ScrollReveal>
          ))}
        </div>
      </div>
    );
  }

  // ── single-column-sidebar layout ───────────────────────
  if (layout.structure === "single-column-sidebar" && layout.showSidebarNav) {
    return (
      <div className="flex gap-8">
        <SidebarNav sections={layout.sections} activeSection={activeSection} />
        <div className="flex-1 min-w-0">
          {/* Mobile horizontal tab bar */}
          <nav className="lg:hidden sticky top-14 z-40 -mx-4 sm:-mx-6 px-4 sm:px-6 bg-background/90 backdrop-blur-md border-b border-card-border mb-6 overflow-x-auto">
            <div className="flex gap-1 py-2">
              {layout.sections.map(({ id, label }) => {
                const Icon = sectionIcons[id] || FileText;
                return (
                  <button
                    key={id}
                    onClick={() => document.getElementById(id)?.scrollIntoView({ behavior: "smooth" })}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm whitespace-nowrap transition-all cursor-pointer",
                      activeSection === id
                        ? "bg-primary/10 text-primary font-medium"
                        : "text-text-muted hover:text-text-secondary"
                    )}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {label}
                  </button>
                );
              })}
            </div>
          </nav>
          <div className={cn(spacingClass[layout.spacing])}>
            {scorecardBlock}
            {trendAlertsBlock}
            {correlationsBlock}
            {renderSections(layout.sections)}
          </div>
        </div>
      </div>
    );
  }

  // ── single-column layout (default) ─────────────────────
  return (
    <div className={cn(spacingClass[layout.spacing])}>
      {scorecardBlock}
      {trendAlertsBlock}
      {correlationsBlock}
      {renderSections(layout.sections)}
    </div>
  );
}
