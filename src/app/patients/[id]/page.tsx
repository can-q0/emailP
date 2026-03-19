"use client";

import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { Navbar } from "@/components/navbar";
import { GlassCard } from "@/components/ui/glass-card";
import { Button } from "@/components/ui/button";
import { PageTransition } from "@/components/ui/page-transition";
import { SkeletonCard } from "@/components/ui/skeleton";
import { BloodMetricsChart } from "@/components/report/blood-metrics-chart";
import { cn } from "@/lib/utils";
import {
  ArrowLeft,
  Pencil,
  Check,
  X,
  Mail,
  FileText,
  Activity,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Minus,
  FlaskConical,
  BarChart3,
  Loader2,
  ExternalLink,
  ChevronDown,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import type { BloodMetricData } from "@/types";

// ── Types ────────────────────────────────────────────────

interface LatestMetric {
  metricName: string;
  value: number;
  unit: string;
  referenceMin: number | null;
  referenceMax: number | null;
  isAbnormal: boolean;
  measuredAt: string;
  previousValue: number | null;
}

interface PatientEmail {
  id: string;
  gmailMessageId: string;
  subject: string | null;
  from: string | null;
  date: string | null;
  snippet: string | null;
  isLabReport: boolean;
}

interface PatientReport {
  id: string;
  title: string;
  status: string;
  reportType: string;
  format: string;
  createdAt: string;
}

interface PatientDetail {
  id: string;
  name: string;
  governmentId: string | null;
  email: string | null;
  birthYear: number | null;
  gender: string | null;
  emailCount: number;
  reportCount: number;
  metricCount: number;
  emails: PatientEmail[];
  reports: PatientReport[];
  latestMetrics: LatestMetric[];
  allMetrics: BloodMetricData[];
}

// ── Helpers ──────────────────────────────────────────────

function InitialsAvatar({ name, className }: { name: string; className?: string }) {
  const initials = name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toLocaleUpperCase("tr-TR"))
    .join("");
  return (
    <div
      className={cn(
        "w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center text-lg font-bold text-primary shrink-0",
        className
      )}
    >
      {initials}
    </div>
  );
}

function maskGovernmentId(govId: string | null): string | null {
  if (!govId) return null;
  if (govId.startsWith("pending_")) return null;
  return govId;
}

function MetricBar({ metric }: { metric: LatestMetric }) {
  const { value, referenceMin, referenceMax, unit, isAbnormal, previousValue } = metric;

  // Calculate position percentage within extended range
  const min = referenceMin ?? 0;
  const max = referenceMax ?? value * 1.5;
  const rangeSpan = max - min;
  const extMin = min - rangeSpan * 0.3;
  const extMax = max + rangeSpan * 0.3;
  const extSpan = extMax - extMin;

  const refLeftPct = ((min - extMin) / extSpan) * 100;
  const refWidthPct = ((max - min) / extSpan) * 100;
  const valuePct = Math.min(Math.max(((value - extMin) / extSpan) * 100, 2), 98);

  const delta = previousValue !== null ? ((value - previousValue) / Math.abs(previousValue || 1)) * 100 : null;

  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm font-medium truncate">{metric.metricName}</span>
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "text-sm font-mono",
                isAbnormal ? "text-severity-high font-semibold" : "text-foreground"
              )}
            >
              {value} <span className="text-text-muted text-xs">{unit}</span>
            </span>
            {delta !== null && (
              <span
                className={cn(
                  "inline-flex items-center gap-0.5 text-xs font-medium",
                  delta > 0 ? "text-severity-high" : delta < 0 ? "text-severity-low" : "text-text-muted"
                )}
              >
                {delta > 0 ? <TrendingUp className="w-3 h-3" /> : delta < 0 ? <TrendingDown className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
                {delta > 0 ? "+" : ""}
                {delta.toFixed(1)}%
              </span>
            )}
          </div>
        </div>
        {/* Reference range bar */}
        {referenceMin != null && referenceMax != null && (
          <div className="relative h-2 rounded-full bg-secondary/50 overflow-hidden">
            {/* Reference range zone */}
            <div
              className="absolute top-0 bottom-0 bg-severity-low/20 rounded-full"
              style={{ left: `${refLeftPct}%`, width: `${refWidthPct}%` }}
            />
            {/* Value dot */}
            <div
              className={cn(
                "absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full border-2 border-white shadow-sm",
                isAbnormal ? "bg-severity-high" : "bg-primary"
              )}
              style={{ left: `${valuePct}%`, marginLeft: "-6px" }}
            />
          </div>
        )}
        {referenceMin != null && referenceMax != null && (
          <div className="flex justify-between text-[10px] text-text-muted mt-0.5">
            <span>{referenceMin}</span>
            <span>{referenceMax}</span>
          </div>
        )}
      </div>
    </div>
  );
}

const REPORT_TYPE_LABELS: Record<string, { label: string; icon: typeof FileText }> = {
  "detailed report": { label: "Full Analysis", icon: BarChart3 },
  "all emails": { label: "Email Focus", icon: Mail },
  "comparison": { label: "Date Compare", icon: Activity },
  "plain PDF": { label: "PDF Merge", icon: FileText },
};

// ── Main Component ───────────────────────────────────────

export default function PatientDetailPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const patientId = params.id as string;

  const [patient, setPatient] = useState<PatientDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Edit state
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editGovId, setEditGovId] = useState("");
  const [saving, setSaving] = useState(false);

  // Section expand states
  const [showAllEmails, setShowAllEmails] = useState(false);
  const [activeTab, setActiveTab] = useState<"overview" | "metrics" | "emails" | "reports">("overview");

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/auth/signin");
  }, [status, router]);

  const fetchPatient = useCallback(async () => {
    try {
      const res = await fetch(`/api/patients/${patientId}`);
      if (!res.ok) {
        setError("Patient not found");
        return;
      }
      const data = await res.json();
      setPatient(data);
    } catch {
      setError("Failed to load patient");
    } finally {
      setLoading(false);
    }
  }, [patientId]);

  useEffect(() => {
    if (!session) return;
    fetchPatient();
  }, [session, fetchPatient]);

  const startEdit = () => {
    if (!patient) return;
    setEditing(true);
    setEditName(patient.name);
    setEditGovId(
      patient.governmentId?.startsWith("pending_") ? "" : patient.governmentId || ""
    );
  };

  const saveEdit = async () => {
    if (!patient) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/patients?id=${patient.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editName, governmentId: editGovId || undefined }),
      });
      if (res.ok) {
        setPatient((prev) =>
          prev ? { ...prev, name: editName, governmentId: editGovId || null } : prev
        );
        toast.success("Patient updated.");
      }
    } finally {
      setSaving(false);
      setEditing(false);
    }
  };

  if (status === "loading" || !session) {
    return (
      <div className="min-h-screen">
        <Navbar />
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12 space-y-4">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      </div>
    );
  }

  if (error || (!loading && !patient)) {
    return (
      <div className="min-h-screen">
        <Navbar />
        <PageTransition className="max-w-4xl mx-auto px-4 sm:px-6 py-12">
          <GlassCard className="p-12 text-center">
            <AlertTriangle className="w-12 h-12 text-text-faint mx-auto mb-4" />
            <h3 className="font-semibold mb-2">Patient not found</h3>
            <p className="text-sm text-text-secondary mb-4">
              {error || "This patient does not exist or you don't have access."}
            </p>
            <Button onClick={() => router.push("/patients")}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Patients
            </Button>
          </GlassCard>
        </PageTransition>
      </div>
    );
  }

  if (loading || !patient) {
    return (
      <div className="min-h-screen">
        <Navbar />
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12 space-y-4">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      </div>
    );
  }

  const labEmails = patient.emails.filter((e) => e.isLabReport);
  const displayedEmails = showAllEmails ? patient.emails : patient.emails.slice(0, 5);
  const abnormalCount = patient.latestMetrics.filter((m) => m.isAbnormal).length;
  const normalCount = patient.latestMetrics.length - abnormalCount;

  const tabs = [
    { key: "overview" as const, label: "Overview" },
    { key: "metrics" as const, label: "Metrics", count: patient.latestMetrics.length },
    { key: "emails" as const, label: "Emails", count: patient.emailCount },
    { key: "reports" as const, label: "Reports", count: patient.reportCount },
  ];

  return (
    <div className="min-h-screen">
      <Navbar />

      <PageTransition className="max-w-4xl mx-auto px-4 sm:px-6 py-12">
        {/* Back button */}
        <button
          onClick={() => router.push("/patients")}
          className="flex items-center gap-2 text-sm text-text-muted hover:text-foreground transition-colors mb-6 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          Patients
        </button>

        {/* Patient Header */}
        <GlassCard className="p-6 mb-6">
          <div className="flex items-start gap-4">
            <InitialsAvatar name={patient.name} />

            <div className="flex-1 min-w-0">
              {editing ? (
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="flex-1 min-w-[160px] px-3 py-1.5 rounded-lg border border-card-border bg-background text-base font-semibold focus:outline-none focus:ring-2 focus:ring-primary/30"
                    autoFocus
                  />
                  <input
                    type="text"
                    value={editGovId}
                    onChange={(e) => setEditGovId(e.target.value)}
                    className="w-40 px-3 py-1.5 rounded-lg border border-card-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                    placeholder="TC Kimlik No"
                  />
                  <button
                    onClick={saveEdit}
                    disabled={saving}
                    className="p-1.5 rounded-lg hover:bg-severity-low/10 text-severity-low"
                  >
                    {saving ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Check className="w-4 h-4" />
                    )}
                  </button>
                  <button
                    onClick={() => setEditing(false)}
                    className="p-1.5 rounded-lg hover:bg-card-hover text-text-muted"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-2">
                    <h1 className="text-xl font-bold truncate">{patient.name}</h1>
                    <button
                      onClick={startEdit}
                      className="p-1 rounded-lg hover:bg-card-hover text-text-faint hover:text-text-secondary transition-colors shrink-0"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-text-muted mt-1">
                    {maskGovernmentId(patient.governmentId) && (
                      <span className="font-mono text-xs">TC: {maskGovernmentId(patient.governmentId)}</span>
                    )}
                    {patient.gender && <span>{patient.gender === "Male" ? "Male" : patient.gender === "Female" ? "Female" : patient.gender}</span>}
                    {patient.birthYear && <span>Born {patient.birthYear}</span>}
                  </div>
                </>
              )}

              {/* Stats row */}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-3">
                <span className="flex items-center gap-1.5 text-sm text-text-muted">
                  <Mail className="w-4 h-4" />
                  {patient.emailCount} emails
                </span>
                <span className="flex items-center gap-1.5 text-sm text-text-muted">
                  <FileText className="w-4 h-4" />
                  {patient.reportCount} reports
                </span>
                <span className="flex items-center gap-1.5 text-sm text-text-muted">
                  <Activity className="w-4 h-4" />
                  {patient.metricCount} metrics
                </span>
              </div>
            </div>

            {/* Generate Report CTA */}
            <div className="hidden sm:block shrink-0">
              <Button
                size="sm"
                onClick={() => router.push(`/dashboard?patient=${encodeURIComponent(patient.name)}`)}
              >
                <BarChart3 className="w-4 h-4 mr-2" />
                Generate Report
              </Button>
            </div>
          </div>

          {/* Mobile Generate Report */}
          <div className="sm:hidden mt-4">
            <Button
              size="sm"
              className="w-full"
              onClick={() => router.push(`/dashboard?patient=${encodeURIComponent(patient.name)}`)}
            >
              <BarChart3 className="w-4 h-4 mr-2" />
              Generate Report
            </Button>
          </div>
        </GlassCard>

        {/* Tab Navigation */}
        <div className="flex gap-1 mb-6 p-1 rounded-xl bg-secondary/30 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                "flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap cursor-pointer",
                activeTab === tab.key
                  ? "bg-card text-foreground shadow-sm"
                  : "text-text-muted hover:text-foreground"
              )}
            >
              {tab.label}
              {tab.count !== undefined && (
                <span
                  className={cn(
                    "px-1.5 py-0.5 rounded-full text-xs",
                    activeTab === tab.key
                      ? "bg-primary/10 text-primary"
                      : "bg-secondary/50 text-text-muted"
                  )}
                >
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
          >
            {/* ── OVERVIEW TAB ─────────────────────────────── */}
            {activeTab === "overview" && (
              <div className="space-y-6">
                {/* Health Summary */}
                {patient.latestMetrics.length > 0 && (
                  <section>
                    <div className="flex items-center gap-3 mb-4">
                      <div className="p-2 rounded-xl bg-primary/10">
                        <Activity className="w-5 h-5 text-primary" />
                      </div>
                      <h2 className="text-lg font-bold">Health Summary</h2>
                      <div className="flex items-center gap-2 ml-auto">
                        {abnormalCount > 0 && (
                          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-severity-high/10 text-severity-high">
                            {abnormalCount} abnormal
                          </span>
                        )}
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-severity-low/10 text-severity-low">
                          {normalCount} normal
                        </span>
                      </div>
                    </div>
                    <GlassCard className="p-5">
                      <div className="space-y-4">
                        {patient.latestMetrics.slice(0, 8).map((metric) => (
                          <MetricBar key={metric.metricName} metric={metric} />
                        ))}
                        {patient.latestMetrics.length > 8 && (
                          <button
                            onClick={() => setActiveTab("metrics")}
                            className="text-sm text-primary font-medium hover:underline cursor-pointer"
                          >
                            View all {patient.latestMetrics.length} metrics
                          </button>
                        )}
                      </div>
                    </GlassCard>
                  </section>
                )}

                {/* Recent Emails */}
                {labEmails.length > 0 && (
                  <section>
                    <div className="flex items-center gap-3 mb-4">
                      <div className="p-2 rounded-xl bg-[#6B5B4D]/10">
                        <FlaskConical className="w-5 h-5 text-[#6B5B4D]" />
                      </div>
                      <h2 className="text-lg font-bold">Recent Lab Reports</h2>
                      <span className="text-sm text-text-muted">{labEmails.length} total</span>
                    </div>
                    <div className="space-y-2">
                      {labEmails.slice(0, 3).map((email, i) => (
                        <motion.div
                          key={email.id}
                          initial={{ opacity: 0, y: 5 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.05 }}
                        >
                          <GlassCard className="p-4">
                            <div className="flex items-center gap-3">
                              <div className="p-1.5 rounded-lg bg-severity-low/10">
                                <FlaskConical className="w-4 h-4 text-severity-low" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="font-medium truncate text-sm">
                                  {email.subject || "(no subject)"}
                                </p>
                                <div className="flex items-center gap-2 text-xs text-text-muted mt-0.5">
                                  <span className="truncate">{email.from}</span>
                                  {email.date && (
                                    <>
                                      <span>·</span>
                                      <span>{format(new Date(email.date), "MMM d, yyyy")}</span>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>
                          </GlassCard>
                        </motion.div>
                      ))}
                      {labEmails.length > 3 && (
                        <button
                          onClick={() => setActiveTab("emails")}
                          className="text-sm text-primary font-medium hover:underline cursor-pointer"
                        >
                          View all {labEmails.length} lab reports
                        </button>
                      )}
                    </div>
                  </section>
                )}

                {/* Recent Reports */}
                {patient.reports.length > 0 && (
                  <section>
                    <div className="flex items-center gap-3 mb-4">
                      <div className="p-2 rounded-xl bg-primary/10">
                        <FileText className="w-5 h-5 text-primary" />
                      </div>
                      <h2 className="text-lg font-bold">Generated Reports</h2>
                    </div>
                    <div className="space-y-2">
                      {patient.reports.slice(0, 3).map((report, i) => {
                        const typeConfig = REPORT_TYPE_LABELS[report.reportType] || {
                          label: report.reportType,
                          icon: FileText,
                        };
                        const Icon = typeConfig.icon;
                        return (
                          <motion.div
                            key={report.id}
                            initial={{ opacity: 0, y: 5 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.05 }}
                          >
                            <GlassCard
                              className="p-4 transition-all cursor-pointer hover:border-primary/20"
                              onClick={() => router.push(`/report/${report.id}`)}
                            >
                              <div className="flex items-center gap-3">
                                <div className="p-1.5 rounded-lg bg-primary/10">
                                  <Icon className="w-4 h-4 text-primary" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="font-medium truncate text-sm">{report.title}</p>
                                  <div className="flex items-center gap-2 text-xs text-text-muted mt-0.5">
                                    <span>{typeConfig.label}</span>
                                    <span>·</span>
                                    <span>
                                      {formatDistanceToNow(new Date(report.createdAt), {
                                        addSuffix: true,
                                      })}
                                    </span>
                                    <span
                                      className={cn(
                                        "px-1.5 py-0.5 rounded text-xs",
                                        report.status === "completed"
                                          ? "bg-severity-low/10 text-severity-low"
                                          : report.status === "failed"
                                            ? "bg-severity-high/10 text-severity-high"
                                            : "bg-severity-medium/10 text-severity-medium"
                                      )}
                                    >
                                      {report.status}
                                    </span>
                                  </div>
                                </div>
                                <ExternalLink className="w-4 h-4 text-text-faint shrink-0" />
                              </div>
                            </GlassCard>
                          </motion.div>
                        );
                      })}
                      {patient.reports.length > 3 && (
                        <button
                          onClick={() => setActiveTab("reports")}
                          className="text-sm text-primary font-medium hover:underline cursor-pointer"
                        >
                          View all {patient.reports.length} reports
                        </button>
                      )}
                    </div>
                  </section>
                )}

                {/* Empty state */}
                {patient.latestMetrics.length === 0 && patient.emails.length === 0 && patient.reports.length === 0 && (
                  <GlassCard className="p-12 text-center">
                    <Activity className="w-12 h-12 text-text-faint mx-auto mb-4" />
                    <h3 className="font-semibold mb-2">No data yet</h3>
                    <p className="text-sm text-text-secondary mb-4">
                      Generate a report to populate this patient&apos;s health data.
                    </p>
                    <Button
                      onClick={() =>
                        router.push(`/dashboard?patient=${encodeURIComponent(patient.name)}`)
                      }
                    >
                      <BarChart3 className="w-4 h-4 mr-2" />
                      Generate Report
                    </Button>
                  </GlassCard>
                )}
              </div>
            )}

            {/* ── METRICS TAB ──────────────────────────────── */}
            {activeTab === "metrics" && (
              <div className="space-y-6">
                {/* All Latest Metrics */}
                {patient.latestMetrics.length > 0 && (
                  <section>
                    <div className="flex items-center gap-3 mb-4">
                      <div className="p-2 rounded-xl bg-primary/10">
                        <Activity className="w-5 h-5 text-primary" />
                      </div>
                      <h2 className="text-lg font-bold">Latest Values</h2>
                      <div className="flex items-center gap-2 ml-auto">
                        {abnormalCount > 0 && (
                          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-severity-high/10 text-severity-high">
                            {abnormalCount} abnormal
                          </span>
                        )}
                      </div>
                    </div>
                    <GlassCard className="p-5">
                      <div className="space-y-4">
                        {patient.latestMetrics.map((metric) => (
                          <MetricBar key={metric.metricName} metric={metric} />
                        ))}
                      </div>
                    </GlassCard>
                  </section>
                )}

                {/* Chart with all historical data */}
                {patient.allMetrics.length > 0 && (
                  <BloodMetricsChart metrics={patient.allMetrics} variant="default" />
                )}

                {patient.latestMetrics.length === 0 && (
                  <GlassCard className="p-12 text-center">
                    <Activity className="w-12 h-12 text-text-faint mx-auto mb-4" />
                    <h3 className="font-semibold mb-2">No metrics recorded</h3>
                    <p className="text-sm text-text-secondary">
                      Metrics are extracted when you generate reports from lab emails.
                    </p>
                  </GlassCard>
                )}
              </div>
            )}

            {/* ── EMAILS TAB ───────────────────────────────── */}
            {activeTab === "emails" && (
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 rounded-xl bg-[#6B5B4D]/10">
                    <Mail className="w-5 h-5 text-[#6B5B4D]" />
                  </div>
                  <h2 className="text-lg font-bold">All Emails</h2>
                  <span className="text-sm text-text-muted">{patient.emailCount} total</span>
                </div>
                {patient.emails.length > 0 ? (
                  <div className="space-y-2">
                    {displayedEmails.map((email, i) => (
                      <motion.div
                        key={email.id}
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.03 }}
                      >
                        <GlassCard className="p-4">
                          <div className="flex items-center gap-3">
                            <div
                              className={cn(
                                "p-1.5 rounded-lg",
                                email.isLabReport
                                  ? "bg-severity-low/10"
                                  : "bg-secondary/50"
                              )}
                            >
                              {email.isLabReport ? (
                                <FlaskConical className="w-4 h-4 text-severity-low" />
                              ) : (
                                <Mail className="w-4 h-4 text-text-muted" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="font-medium truncate text-sm">
                                  {email.subject || "(no subject)"}
                                </p>
                                {email.isLabReport && (
                                  <span className="px-1.5 py-0.5 rounded text-xs bg-severity-low/10 text-severity-low shrink-0">
                                    Lab
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 text-xs text-text-muted mt-0.5">
                                <span className="truncate">{email.from}</span>
                                {email.date && (
                                  <>
                                    <span>·</span>
                                    <span>
                                      {format(new Date(email.date), "MMM d, yyyy")}
                                    </span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        </GlassCard>
                      </motion.div>
                    ))}
                    {!showAllEmails && patient.emails.length > 5 && (
                      <button
                        onClick={() => setShowAllEmails(true)}
                        className="flex items-center gap-1 text-sm text-primary font-medium hover:underline cursor-pointer"
                      >
                        <ChevronDown className="w-4 h-4" />
                        Show all {patient.emails.length} emails
                      </button>
                    )}
                  </div>
                ) : (
                  <GlassCard className="p-12 text-center">
                    <Mail className="w-12 h-12 text-text-faint mx-auto mb-4" />
                    <h3 className="font-semibold mb-2">No emails linked</h3>
                    <p className="text-sm text-text-secondary">
                      Emails are linked when you sync and generate reports.
                    </p>
                  </GlassCard>
                )}
              </div>
            )}

            {/* ── REPORTS TAB ──────────────────────────────── */}
            {activeTab === "reports" && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-primary/10">
                      <FileText className="w-5 h-5 text-primary" />
                    </div>
                    <h2 className="text-lg font-bold">All Reports</h2>
                    <span className="text-sm text-text-muted">
                      {patient.reportCount} total
                    </span>
                  </div>
                  <Button
                    size="sm"
                    onClick={() =>
                      router.push(
                        `/dashboard?patient=${encodeURIComponent(patient.name)}`
                      )
                    }
                  >
                    <BarChart3 className="w-4 h-4 mr-2" />
                    New Report
                  </Button>
                </div>
                {patient.reports.length > 0 ? (
                  <div className="space-y-2">
                    {patient.reports.map((report, i) => {
                      const typeConfig = REPORT_TYPE_LABELS[report.reportType] || {
                        label: report.reportType,
                        icon: FileText,
                      };
                      const Icon = typeConfig.icon;
                      return (
                        <motion.div
                          key={report.id}
                          initial={{ opacity: 0, y: 5 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.05 }}
                        >
                          <GlassCard
                            className="p-4 transition-all cursor-pointer hover:border-primary/20"
                            onClick={() => router.push(`/report/${report.id}`)}
                          >
                            <div className="flex items-center gap-3">
                              <div className="p-1.5 rounded-lg bg-primary/10">
                                <Icon className="w-4 h-4 text-primary" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="font-medium truncate text-sm">{report.title}</p>
                                <div className="flex items-center gap-2 text-xs text-text-muted mt-0.5">
                                  <span>{typeConfig.label}</span>
                                  <span>·</span>
                                  <span>{report.format}</span>
                                  <span>·</span>
                                  <span>
                                    {format(new Date(report.createdAt), "MMM d, yyyy")}
                                  </span>
                                </div>
                              </div>
                              <span
                                className={cn(
                                  "px-2 py-0.5 rounded-full text-xs font-medium shrink-0",
                                  report.status === "completed"
                                    ? "bg-severity-low/10 text-severity-low"
                                    : report.status === "failed"
                                      ? "bg-severity-high/10 text-severity-high"
                                      : "bg-severity-medium/10 text-severity-medium"
                                )}
                              >
                                {report.status}
                              </span>
                              <ExternalLink className="w-4 h-4 text-text-faint shrink-0" />
                            </div>
                          </GlassCard>
                        </motion.div>
                      );
                    })}
                  </div>
                ) : (
                  <GlassCard className="p-12 text-center">
                    <FileText className="w-12 h-12 text-text-faint mx-auto mb-4" />
                    <h3 className="font-semibold mb-2">No reports generated</h3>
                    <p className="text-sm text-text-secondary mb-4">
                      Create your first report for this patient.
                    </p>
                    <Button
                      onClick={() =>
                        router.push(
                          `/dashboard?patient=${encodeURIComponent(patient.name)}`
                        )
                      }
                    >
                      <BarChart3 className="w-4 h-4 mr-2" />
                      Generate Report
                    </Button>
                  </GlassCard>
                )}
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </PageTransition>
    </div>
  );
}
