"use client";

import { useSession, signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { Navbar } from "@/components/navbar";
import { GlassCard } from "@/components/ui/glass-card";
import { Button } from "@/components/ui/button";
import { SearchBar } from "@/components/search/search-bar";
import { PatientSelector } from "@/components/query-builder/patient-selector";
import { ComparisonDatePicker } from "@/components/query-builder/comparison-date-picker";
import { PageTransition } from "@/components/ui/page-transition";
import { SkeletonCard, SkeletonReportRow } from "@/components/ui/skeleton";
import { ProgressSteps } from "@/components/ui/progress-steps";
import { useProgressiveSearch } from "@/hooks/useProgressiveSearch";
import { PatientCandidate } from "@/types";
import type { PatientSearchResult } from "@/types";
import {
  FileText,
  Clock,
  AlertTriangle,
  RotateCcw,
  SearchX,
  Users,
  Search,
  ArrowRight,
  Activity,
  Sparkles,
  BarChart3,
  X,
  Loader2,
  Mail,
  Database,
  PenLine,
  Paperclip,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { GmailReconnectBanner } from "@/components/gmail-reconnect-banner";
import { cn } from "@/lib/utils";
import { useOnboarding } from "@/components/onboarding/onboarding-provider";
import { WelcomeWizard } from "@/components/onboarding/welcome-wizard";
import { SpotlightOverlay } from "@/components/onboarding/spotlight-overlay";
import { GoLiveModal } from "@/components/onboarding/go-live-modal";
import { DASHBOARD_TOUR } from "@/components/onboarding/tour-steps";

const REPORT_STEPS = [
  { label: "Syncing" },
  { label: "Extracting" },
  { label: "Generating" },
];

const REPORT_TYPES = [
  { value: "detailed report", label: "Full Analysis", icon: BarChart3, desc: "AI summary + charts + attention points + emails", badge: "Recommended" },
  { value: "plain PDF", label: "PDF Merge", icon: Paperclip, desc: "Download combined PDF — no AI", badge: "Fast" },
];

function InitialsAvatar({ name, className }: { name: string; className?: string }) {
  const initials = name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toLocaleUpperCase("tr-TR"))
    .join("");
  return (
    <div className={cn(
      "w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-sm font-semibold text-primary shrink-0",
      className
    )}>
      {initials}
    </div>
  );
}

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const {
    showWelcome,
    showGoLive,
    setShowGoLive,
    activeTour,
    startDemoMode,
    startTourOnly,
    skipOnboarding,
    completeTour,
    cancelTour,
    goLive,
    isRestart,
  } = useOnboarding();

  // Search state
  const { query, setQuery, tokenLabels, results, isLoading: searchLoading } = useProgressiveSearch();
  const hasQuery = query.trim().length > 0;
  const hasResults = results.patients.length > 0 || results.emails.length > 0;

  // Report config
  const [reportType, setReportType] = useState("detailed report");
  const format = "detailed";

  // Report generation state
  const [step, setStep] = useState<
    "search" | "disambiguate" | "select_dates" | "generating" | "failed" | "no_results"
  >("search");
  const [pendingPatientId, setPendingPatientId] = useState<string | null>(null);
  const [pendingEmailIds, setPendingEmailIds] = useState<string[]>([]);
  const [pendingPatientName, setPendingPatientName] = useState<string>("");
  const [candidates, setCandidates] = useState<PatientCandidate[]>([]);
  const [progress, setProgress] = useState("");
  const [progressStep, setProgressStep] = useState(0);
  const [failedReport, setFailedReport] = useState<{
    reportId: string;
    patientId: string;
    emailIds: string[];
    patientName: string;
    reportType?: string;
    format?: string;
    errorMessage: string;
  } | null>(null);

  const [tokenExpired, setTokenExpired] = useState(false);

  // Email detail modal state
  const [selectedEmail, setSelectedEmail] = useState<{
    id: string;
    subject?: string;
    from?: string;
    date?: string;
    body?: string;
    pdfPath?: string;
    patientName?: string;
  } | null>(null);
  const [loadingEmailId, setLoadingEmailId] = useState<string | null>(null);

  const handleEmailClick = useCallback(async (emailId: string) => {
    setLoadingEmailId(emailId);
    try {
      const res = await fetch(`/api/emails/${emailId}`);
      if (res.ok) {
        const data = await res.json();
        setSelectedEmail(data);
      } else {
        toast.error("Email yüklenemedi.");
      }
    } catch {
      toast.error("Bir hata oluştu.");
    } finally {
      setLoadingEmailId(null);
    }
  }, []);

  // Recent reports
  interface RecentReport {
    id: string;
    title: string;
    status: string;
    createdAt: string;
    patient: { id: string; name: string };
  }
  const [recentReports, setRecentReports] = useState<RecentReport[]>([]);
  const [reportsLoading, setReportsLoading] = useState(true);

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/auth/signin");
  }, [status, router]);

  useEffect(() => {
    if (status === "authenticated") {
      fetch("/api/reports?limit=5")
        .then((r) => r.json())
        .then((data) => { if (Array.isArray(data)) setRecentReports(data); })
        .catch(() => {})
        .finally(() => setReportsLoading(false));

      // Check Gmail token health on load
      fetch("/api/gmail/token-status")
        .then((r) => r.json())
        .then((data) => setTokenExpired(!!data.expired))
        .catch(() => {});
    }
  }, [status]);

  // ── Generate flow ──────────────────────────────────────

  const handleGenerate = useCallback(async (patient: PatientSearchResult, rType: string, fmt: string) => {

    setStep("generating");
    setProgress("Syncing emails...");
    setProgressStep(0);

    try {
      const syncRes = await fetch("/api/gmail/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: patient.name, patientName: patient.name }),
      });

      const syncData = await syncRes.json();
      if (syncData.error === "gmail_token_expired") {
        setTokenExpired(true);
        setStep("search");
        toast.error("Gmail token expired. Please reconnect.");
        return;
      }
      if (!syncRes.ok) throw new Error("Failed to sync emails");

      if (syncData.total === 0) {
        setStep("no_results");
        return;
      }

      const emailIds = syncData.emails.map((e: { id: string }) => e.id);

      setProgress("Checking patient records...");
      const disambRes = await fetch("/api/patients/disambiguate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ patientName: patient.name, emailIds }),
      });
      const disambData = await disambRes.json();

      if (disambData.needsDisambiguation) {
        setCandidates(disambData.candidates);
        setPendingEmailIds(emailIds);
        setPendingPatientName(patient.name);
        setStep("disambiguate");
        return;
      }

      const patId = disambData.candidates[0]?.id;
      if (!patId) {
        toast.error("Could not find patient. Please try again.");
        setStep("search");
        return;
      }

      if (rType === "plain PDF") {
        await generatePlainPdf(patId, emailIds, patient.name);
      } else if (rType === "comparison") {
        setPendingPatientId(patId);
        setPendingEmailIds(emailIds);
        setPendingPatientName(patient.name);
        setStep("select_dates");
      } else {
        await generateReport(patId, emailIds, patient.name, rType, fmt);
      }
    } catch (error) {
      console.error("Generate error:", error);
      toast.error("An error occurred. Please try again.");
      setStep("search");
    }
  }, [router]);

  const handlePatientSelect = useCallback(async (candidate: PatientCandidate) => {
    let patientId = candidate.id;
    if (!patientId) {
      const res = await fetch("/api/patients/disambiguate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ patientName: candidate.name, governmentId: candidate.governmentId, create: true }),
      });
      const data = await res.json();
      patientId = data.candidates?.[0]?.id || candidate.id;
    }

    const syncRes = await fetch("/api/gmail/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: candidate.name, patientName: candidate.name }),
    });
    const syncData = await syncRes.json();
    const emailIds = syncData.emails?.map((e: { id: string }) => e.id) || [];

    if (reportType === "plain PDF") {
      await generatePlainPdf(patientId, emailIds, candidate.name);
    } else if (reportType === "comparison") {
      setPendingPatientId(patientId);
      setPendingEmailIds(emailIds);
      setPendingPatientName(candidate.name);
      setStep("select_dates");
    } else {
      await generateReport(patientId, emailIds, candidate.name, reportType, format);
    }
  }, [reportType, format, router]);

  const generatePlainPdf = async (patientId: string, emailIds: string[], name: string) => {
    setStep("generating");
    setProgress("Fetching & merging PDF attachments...");
    setProgressStep(1);
    try {
      const res = await fetch("/api/reports/plain-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ patientId, emailIds, title: `Plain PDF - ${name}` }),
      });
      const data = await res.json();
      if (data.reportId) {
        const pollInterval = setInterval(async () => {
          const statusRes = await fetch(`/api/reports?id=${data.reportId}`);
          const report = await statusRes.json();
          if (report.status === "completed") {
            clearInterval(pollInterval);
            toast.success("PDF merged successfully!");
            router.push(`/report/${data.reportId}`);
          } else if (report.status === "failed" || report.status === "no_results") {
            clearInterval(pollInterval);
            if (report.step === "gmail_token_expired") {
              setTokenExpired(true);
              toast.error("Gmail token expired. Please reconnect your Google account.");
              setStep("search");
            } else if (report.status === "no_results") {
              setStep("no_results");
            } else { toast.error("Failed to merge PDFs."); setStep("search"); }
          }
        }, 1500);
      } else { toast.error("Failed to create report."); setStep("search"); }
    } catch { toast.error("An error occurred."); setStep("search"); }
  };

  const generateReport = async (
    patientId: string, emailIds: string[], name: string,
    rType?: string, fmt?: string,
    comparisonDateA?: string, comparisonDateB?: string
  ) => {
    setStep("generating");
    setProgress("Extracting blood metrics...");
    setProgressStep(1);

    const res = await fetch("/api/ai/generate-report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ patientId, emailIds, title: `Report for ${name}`, reportType: rType, format: fmt, comparisonDateA, comparisonDateB }),
    });
    const data = await res.json();

    if (data.reportId) {
      const pollInterval = setInterval(async () => {
        const statusRes = await fetch(`/api/reports?id=${data.reportId}`);
        const report = await statusRes.json();
        if (report.step) {
          const steps: Record<string, { text: string; idx: number }> = {
            extracting_metrics: { text: "Extracting blood metrics...", idx: 1 },
            generating_summary: { text: "Generating summary & analysis...", idx: 2 },
          };
          const s = steps[report.step];
          if (s) { setProgress(s.text); setProgressStep(s.idx); }
        }
        if (report.status === "completed" || report.status === "failed" || report.status === "no_results") {
          clearInterval(pollInterval);
          if (report.step === "gmail_token_expired") {
            setTokenExpired(true);
            toast.error("Gmail token expired. Please reconnect your Google account.");
            setStep("search");
          } else if (report.status === "completed") { toast.success("Report generated!"); router.push(`/report/${data.reportId}`); }
          else if (report.status === "no_results") { setStep("no_results"); }
          else {
            setFailedReport({ reportId: data.reportId, patientId, emailIds, patientName: name, reportType: rType, format: fmt, errorMessage: report.step || "An unexpected error occurred." });
            setStep("failed");
          }
        }
      }, 2000);
    }
  };

  const handleCacheEmails = useCallback(async () => {
    toast.loading("Syncing from Gmail & caching emails...", { id: "cache" });
    try {
      const res = await fetch("/api/emails/cache", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      toast.dismiss("cache");
      if (!res.ok) {
        toast.error(data.error || "Failed to cache emails.");
      } else if (data.cached > 0 || data.synced > 0) {
        toast.success(data.message);
      } else {
        toast.info(data.message || "All emails already cached.");
      }
    } catch {
      toast.dismiss("cache");
      toast.error("Failed to cache emails.");
    }
  }, []);

  const handleRetry = async () => {
    if (!failedReport) return;
    await fetch(`/api/reports?id=${failedReport.reportId}`, { method: "DELETE" });
    const { patientId, emailIds, patientName: name, reportType: rt, format: f } = failedReport;
    setFailedReport(null);
    await generateReport(patientId, emailIds, name, rt, f);
  };

  const handleStartOver = () => {
    setFailedReport(null);

    setStep("search");
    setProgress("");
    setProgressStep(0);
  };

  // ── Render ─────────────────────────────────────────────

  if (status === "loading" || !session) {
    return (
      <div className="min-h-screen">
        <Navbar />
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-16 space-y-6">
          <div className="flex items-center gap-4 mb-12">
            <div className="w-12 h-12 rounded-2xl bg-card-border/50 animate-shimmer bg-[length:200%_100%]" />
            <div className="space-y-2">
              <div className="h-7 w-56 rounded-xl bg-card-border/50 animate-shimmer bg-[length:200%_100%]" />
              <div className="h-4 w-72 rounded-lg bg-card-border/50 animate-shimmer bg-[length:200%_100%]" />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Navbar />
      <div className={cn("mx-auto px-4 sm:px-6 py-8 sm:py-16", hasQuery && hasResults ? "max-w-6xl" : "max-w-4xl")}>
        {tokenExpired && <GmailReconnectBanner />}
        <AnimatePresence mode="wait">
          {step === "search" && (
            <PageTransition key="search">

              {/* Header */}
              <div className="mb-8">
                <div className="flex items-center gap-4 mb-1">
                  <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: "spring", stiffness: 200, damping: 15 }}
                    className="p-3 rounded-2xl bg-primary/10"
                  >
                    <Sparkles className="w-6 h-6 text-primary" />
                  </motion.div>
                  <div>
                    <motion.h1
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.1, duration: 0.4 }}
                      className="text-2xl sm:text-3xl font-bold"
                    >
                      Welcome back, {session.user?.name?.split(" ")[0]}
                    </motion.h1>
                    <motion.p
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.2, duration: 0.4 }}
                      className="text-text-secondary text-sm"
                    >
                      Search for a patient to generate a report.
                    </motion.p>
                  </div>
                </div>
              </div>

              {/* Search Bar */}
              <motion.div
                data-tour="search-bar"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25, duration: 0.4 }}
                className="mb-8"
              >
                <SearchBar
                  query={query}
                  onChange={setQuery}
                  tokenLabels={tokenLabels}
                  isLoading={searchLoading}
                  placeholder="Hasta adı ile rapor oluşturun..."
                />
              </motion.div>

              {/* Two-column layout: report config left, emails right */}
              {hasQuery && (
                <motion.div
                  key="search-results"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="mb-8 flex flex-col lg:flex-row gap-6"
                >
                  {/* Left column — report config */}
                  <div className="flex-1 min-w-0">
                    {/* Report Type */}
                    <div className="mb-5">
                      <p className="text-sm font-medium mb-2.5">What to generate</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {REPORT_TYPES.map((t) => (
                          <motion.button
                            key={t.value}
                            whileTap={{ scale: 0.97 }}
                            onClick={() => setReportType(t.value)}
                            className={cn(
                              "relative flex items-start gap-3 p-3.5 rounded-xl border text-left transition-all cursor-pointer",
                              reportType === t.value
                                ? "border-primary/40 bg-primary/5 ring-2 ring-primary/10"
                                : "border-card-border hover:border-card-border/80 bg-card"
                            )}
                          >
                            <div className={cn(
                              "p-2 rounded-lg shrink-0",
                              reportType === t.value ? "bg-primary/10" : "bg-card-hover"
                            )}>
                              <t.icon className={cn("w-4 h-4", reportType === t.value ? "text-primary" : "text-text-muted")} />
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <p className={cn("text-sm font-medium", reportType === t.value ? "text-primary" : "text-foreground")}>{t.label}</p>
                                {t.badge && (
                                  <span className={cn(
                                    "px-1.5 py-0.5 rounded text-[10px] font-medium",
                                    t.badge === "Recommended" ? "bg-primary/10 text-primary" : "bg-emerald-500/10 text-emerald-600"
                                  )}>{t.badge}</span>
                                )}
                              </div>
                              <p className="text-[11px] text-text-muted mt-0.5 leading-relaxed">{t.desc}</p>
                            </div>
                          </motion.button>
                        ))}
                      </div>
                    </div>

                    {/* Generate button */}
                    <Button
                      className="w-full py-3"
                      onClick={() => {
                        if (results.patients.length === 1) {
                          handleGenerate(results.patients[0], reportType, format);
                        } else if (results.patients.length > 1) {
                          setCandidates(results.patients.map((p) => ({
                            id: p.id, name: p.name, governmentId: p.governmentId, emailCount: p.emailCount,
                          })));
                          setStep("disambiguate");
                        } else {
                          toast.error("No patients found to generate report.");
                        }
                      }}
                      disabled={results.patients.length === 0 || searchLoading}
                    >
                      <Sparkles className="w-4 h-4 mr-2" />
                      Generate Report
                      {hasResults && (
                        <span className="ml-2 text-xs opacity-70">
                          ({results.emails.length} emails)
                        </span>
                      )}
                    </Button>

                    {/* Patient summary below button */}
                    {results.patients.length > 0 && (
                      <div className="mt-4">
                        <div className="flex items-center gap-2 mb-2">
                          <Users className="w-4 h-4 text-text-muted" />
                          <span className="text-sm font-medium text-text-muted">
                            {results.patients.length} hasta
                          </span>
                        </div>
                        <div className="space-y-2">
                          {results.patients.map((p) => (
                            <GlassCard key={p.id} className="px-3 py-2">
                              <p className="text-sm font-medium truncate">{p.name}</p>
                              <div className="flex items-center gap-3 mt-0.5 text-[11px] text-text-muted">
                                <span>{p.emailCount} email</span>
                                <span>{p.metricCount} metrik</span>
                                {p.gender && <span>{p.gender === "Male" ? "E" : "K"}</span>}
                                {p.birthYear && <span>{p.birthYear}</span>}
                              </div>
                            </GlassCard>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Right column — live email results */}
                  <div className="lg:w-80 shrink-0">
                    <div className="flex items-center gap-2 mb-3">
                      <Mail className="w-4 h-4 text-text-muted" />
                      <span className="text-sm font-medium text-text-muted">
                        {hasResults ? `${results.emails.length} email${results.emails.length !== 1 ? "s" : ""} found` : "Matching emails"}
                      </span>
                    </div>

                    <GlassCard className="overflow-hidden">
                      <AnimatePresence mode="wait">
                        {searchLoading && results.emails.length === 0 && (
                          <motion.div
                            key="loading"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="p-8 text-center"
                          >
                            <Loader2 className="w-5 h-5 text-primary animate-spin mx-auto mb-2" />
                            <p className="text-xs text-text-muted">Searching...</p>
                          </motion.div>
                        )}

                        {!searchLoading && results.emails.length === 0 && results.patients.length === 0 && (
                          <motion.div
                            key="no-emails"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="p-8 text-center"
                          >
                            <Search className="w-6 h-6 text-text-faint mx-auto mb-2" />
                            <p className="text-xs text-text-muted">Sonuç bulunamadı</p>
                          </motion.div>
                        )}

                        {results.emails.length > 0 && (
                          <motion.div
                            key="emails"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="divide-y divide-card-border max-h-[420px] overflow-y-auto"
                          >
                            {results.emails.map((email, i) => (
                              <motion.button
                                key={email.id}
                                type="button"
                                initial={{ opacity: 0, x: 8 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: i * 0.03 }}
                                onClick={() => handleEmailClick(email.id)}
                                className="w-full text-left px-3 py-2.5 hover:bg-card-hover/50 transition-colors cursor-pointer"
                              >
                                <div className="flex items-center gap-2">
                                  {loadingEmailId === email.id ? (
                                    <Loader2 className="w-3 h-3 text-primary animate-spin shrink-0" />
                                  ) : (
                                    <FileText className="w-3 h-3 text-text-muted shrink-0" />
                                  )}
                                  <p className="text-xs font-medium truncate">
                                    {email.subject || "(konu yok)"}
                                  </p>
                                </div>
                                <div className="flex items-center gap-2 mt-0.5 text-[11px] text-text-muted pl-5">
                                  {email.patientName && (
                                    <span className="font-medium text-text-secondary truncate">{email.patientName}</span>
                                  )}
                                  {email.date && (
                                    <span className="shrink-0">
                                      {new Date(email.date).toLocaleDateString("tr-TR", { day: "numeric", month: "short", year: "numeric" })}
                                    </span>
                                  )}
                                  {email.pdfPath && (
                                    <span className="px-1 py-0.5 rounded text-[10px] bg-primary/10 text-primary font-medium shrink-0">PDF</span>
                                  )}
                                </div>
                              </motion.button>
                            ))}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </GlassCard>
                  </div>
                </motion.div>
              )}

              {/* Quick actions */}
              {!hasQuery && (
                <motion.div
                  data-tour="quick-actions"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3, duration: 0.4 }}
                  className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8"
                >
                  {[
                    { icon: FileText, iconBg: "bg-primary/10", iconColor: "text-primary", title: "View Reports", desc: "Browse generated reports.", action: () => router.push("/report") },
                    { icon: Database, iconBg: "bg-emerald-500/10", iconColor: "text-emerald-500", title: "Cache Emails", desc: "Pre-extract metrics for faster reports.", action: handleCacheEmails },
                    { icon: PenLine, iconBg: "bg-blue-500/10", iconColor: "text-blue-500", title: "Query Builder", desc: "Fill-in-the-blanks report builder.", action: () => router.push("/query") },
                  ].map((card, i) => (
                    <motion.div
                      key={card.title}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.35 + i * 0.08, duration: 0.4 }}
                    >
                      <GlassCard className="p-5 h-full cursor-pointer group" hover onClick={card.action}>
                        <div className="flex flex-col items-center text-center gap-3 h-full">
                          <div className={`p-2.5 rounded-xl ${card.iconBg}`}>
                            <card.icon className={`w-5 h-5 ${card.iconColor}`} />
                          </div>
                          <div className="flex-1">
                            <h3 className="font-semibold">{card.title}</h3>
                            <p className="text-sm text-text-secondary mt-0.5">{card.desc}</p>
                          </div>
                          <ArrowRight className="w-4 h-4 text-text-faint group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                        </div>
                      </GlassCard>
                    </motion.div>
                  ))}
                </motion.div>
              )}

              {/* Recent Reports */}
              {!hasQuery && (
                <>
                  {reportsLoading ? (
                    <GlassCard className="p-6">
                      <div className="h-5 w-32 rounded-lg bg-card-border/50 animate-shimmer bg-[length:200%_100%] mb-4" />
                      <div className="space-y-3">{[0, 1, 2].map((i) => <SkeletonReportRow key={i} />)}</div>
                    </GlassCard>
                  ) : recentReports.length > 0 ? (
                    <motion.div data-tour="recent-reports" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6, duration: 0.4 }}>
                      <GlassCard className="overflow-hidden">
                        <div className="flex items-center justify-between px-5 py-4 border-b border-card-border">
                          <div className="flex items-center gap-3">
                            <div className="p-2 rounded-xl bg-severity-low/10"><Clock className="w-4 h-4 text-severity-low" /></div>
                            <h3 className="font-semibold">Recent Reports</h3>
                            <span className="text-xs text-text-muted">{recentReports.length} reports</span>
                          </div>
                          <Button variant="ghost" size="sm" onClick={() => router.push("/report")}>
                            View All <ArrowRight className="w-3.5 h-3.5 ml-1" />
                          </Button>
                        </div>
                        <div className="divide-y divide-card-border">
                          {recentReports.map((r, i) => (
                            <motion.div
                              key={r.id}
                              initial={{ opacity: 0, x: -8 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: 0.65 + i * 0.06, duration: 0.3 }}
                              onClick={() => router.push(`/report/${r.id}`)}
                              className="flex items-center gap-3 px-5 py-3.5 hover:bg-card-hover/50 transition-colors cursor-pointer group"
                            >
                              <InitialsAvatar name={r.patient.name} className="w-8 h-8 text-xs rounded-lg" />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">{r.title}</p>
                                <p className="text-xs text-text-muted">{r.patient.name}</p>
                              </div>
                              <span className={cn(
                                "px-2 py-0.5 rounded-lg text-xs font-medium shrink-0",
                                r.status === "completed" ? "bg-severity-low/10 text-severity-low"
                                  : r.status === "processing" ? "bg-severity-medium/10 text-severity-medium"
                                  : r.status === "failed" ? "bg-severity-high/10 text-severity-high"
                                  : "bg-card-hover text-text-muted"
                              )}>
                                {r.status === "completed" ? "Completed" : r.status === "processing" ? "Processing" : r.status === "failed" ? "Failed" : r.status}
                              </span>
                              <span className="text-xs text-text-faint shrink-0 hidden sm:block">
                                {formatDistanceToNow(new Date(r.createdAt), { addSuffix: true })}
                              </span>
                              <ArrowRight className="w-4 h-4 text-text-faint group-hover:text-primary transition-colors shrink-0" />
                            </motion.div>
                          ))}
                        </div>
                      </GlassCard>
                    </motion.div>
                  ) : (
                    <motion.div data-tour="recent-reports" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6, duration: 0.4 }}>
                      <GlassCard className="p-8 text-center">
                        <div className="animate-float inline-block mb-3">
                          <div className="p-3 rounded-2xl bg-primary/5"><Activity className="w-8 h-8 text-primary/30" /></div>
                        </div>
                        <p className="text-sm text-text-muted mb-1 font-medium">No reports yet</p>
                        <p className="text-xs text-text-faint">Search for a patient above to generate your first report.</p>
                      </GlassCard>
                    </motion.div>
                  )}
                </>
              )}
            </PageTransition>
          )}

          {step === "generating" && (
            <motion.div key="loading" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.98 }} transition={{ duration: 0.3 }} className="flex flex-col items-center justify-center py-24">
              <div className="relative mb-8">
                <motion.div className="w-16 h-16 rounded-full bg-primary/20" animate={{ scale: [1, 1.15, 1] }} transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }} />
                <motion.div className="absolute inset-2 rounded-full bg-primary/40" animate={{ scale: [1, 1.1, 1] }} transition={{ duration: 2, repeat: Infinity, ease: "easeInOut", delay: 0.2 }} />
                <motion.div className="absolute inset-4 rounded-full bg-primary" animate={{ scale: [1, 1.05, 1] }} transition={{ duration: 2, repeat: Infinity, ease: "easeInOut", delay: 0.4 }} />
              </div>
              <motion.p key={progress} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="text-lg font-medium mb-8">{progress}</motion.p>
              <ProgressSteps steps={REPORT_STEPS} currentStep={progressStep} />
            </motion.div>
          )}

          {step === "failed" && failedReport && (
            <motion.div key="failed" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="flex flex-col items-center justify-center py-24 max-w-md mx-auto">
              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 200, damping: 15 }} className="p-3 rounded-full bg-severity-high/10 mb-6">
                <AlertTriangle className="w-10 h-10 text-severity-high" />
              </motion.div>
              <h2 className="text-xl font-bold mb-2">Report Generation Failed</h2>
              <p className="text-sm text-text-secondary text-center mb-6">{failedReport.errorMessage}</p>
              <div className="flex gap-3">
                <Button variant="ghost" onClick={handleStartOver}>Start Over</Button>
                <Button onClick={handleRetry}><RotateCcw className="w-4 h-4 mr-2" />Retry</Button>
              </div>
            </motion.div>
          )}

          {step === "no_results" && (
            <motion.div key="no-results" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="flex flex-col items-center justify-center py-24 max-w-md mx-auto">
              <div className="p-3 rounded-full bg-text-muted/10 mb-6 animate-float"><SearchX className="w-10 h-10 text-text-muted" /></div>
              <h2 className="text-xl font-bold mb-2">No Lab Reports Found</h2>
              <p className="text-sm text-text-secondary text-center mb-6">
                {tokenExpired
                  ? "Your Gmail connection has expired. Please reconnect to access your lab emails."
                  : "No laboratory test results were found for this patient."}
              </p>
              <div className="flex gap-3">
                <Button variant="ghost" onClick={handleStartOver}>Try Another Search</Button>
                {tokenExpired && (
                  <Button onClick={() => signIn("google", { callbackUrl: window.location.pathname })}>
                    Reconnect Gmail
                  </Button>
                )}
              </div>
            </motion.div>
          )}

          {step === "disambiguate" && (
            <motion.div key="disambiguate" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} className="max-w-xl mx-auto">
              <PatientSelector candidates={candidates} onSelect={handlePatientSelect} />
            </motion.div>
          )}

          {step === "select_dates" && pendingPatientId && (
            <motion.div key="dates" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} className="max-w-2xl mx-auto">
              <ComparisonDatePicker
                patientId={pendingPatientId}
                onSelect={(dateA, dateB) => generateReport(pendingPatientId, pendingEmailIds, pendingPatientName, "comparison", format, dateA, dateB)}
                onBack={handleStartOver}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Email detail modal */}
      <AnimatePresence>
        {selectedEmail && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4"
            onClick={() => setSelectedEmail(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 8 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className={cn(
                "bg-card border border-card-border shadow-xl w-full flex flex-col",
                selectedEmail?.pdfPath ? "max-w-[95vw] h-[92vh] rounded-xl" : "max-w-3xl max-h-[85vh] rounded-2xl"
              )}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between px-5 py-3 border-b border-card-border shrink-0">
                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold text-sm truncate">
                    {selectedEmail.subject || "(konu yok)"}
                  </h3>
                  <div className="flex items-center gap-2 text-xs text-text-muted mt-0.5">
                    {selectedEmail.from && <span className="truncate">{selectedEmail.from}</span>}
                    {selectedEmail.date && (
                      <>
                        <span>·</span>
                        <span>{new Date(selectedEmail.date).toLocaleDateString("tr-TR", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                      </>
                    )}
                    {selectedEmail.patientName && (
                      <>
                        <span>·</span>
                        <span className="font-medium text-text-secondary">{selectedEmail.patientName}</span>
                      </>
                    )}
                    {selectedEmail.pdfPath && (
                      <a
                        href={`/api/emails/${selectedEmail.id}/pdf`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ml-2 text-xs text-primary hover:underline"
                      >
                        Yeni sekmede aç
                      </a>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => setSelectedEmail(null)}
                  className="p-1 rounded-lg hover:bg-secondary/50 text-text-muted shrink-0 ml-3 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              {selectedEmail.pdfPath ? (
                <iframe
                  src={`/api/emails/${selectedEmail.id}/pdf`}
                  className="w-full flex-1 min-h-0"
                  title="PDF attachment"
                />
              ) : (
                <div className="p-5 overflow-y-auto flex-1 min-h-0">
                  <p className="text-sm text-text-secondary whitespace-pre-wrap leading-relaxed">
                    {selectedEmail.body || "İçerik yok"}
                  </p>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Onboarding: Welcome Wizard */}
      <AnimatePresence>
        {showWelcome && (
          <WelcomeWizard
            userName={session.user?.name?.split(" ")[0] || ""}
            isRestart={isRestart}
            onStartDemo={startDemoMode}
            onStartTourOnly={startTourOnly}
            onSkip={skipOnboarding}
          />
        )}
      </AnimatePresence>

      {/* Onboarding: Spotlight Tour */}
      {activeTour === "dashboard" && (
        <SpotlightOverlay
          steps={DASHBOARD_TOUR}
          onComplete={() => completeTour("dashboard")}
          onSkip={() => cancelTour()}
        />
      )}

      {/* Onboarding: Go Live Modal (Phase 3) */}
      <AnimatePresence>
        {showGoLive && (
          <GoLiveModal
            onGoLive={goLive}
            onDismiss={() => setShowGoLive(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
