"use client";

import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect, useCallback, useRef, Suspense } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { Navbar } from "@/components/navbar";
import { GlassCard } from "@/components/ui/glass-card";
import { SearchBar } from "@/components/search/search-bar";
import { PatientSelector } from "@/components/query-builder/patient-selector";
import { ComparisonDatePicker } from "@/components/query-builder/comparison-date-picker";
import { PageTransition } from "@/components/ui/page-transition";
import { useProgressiveSearch } from "@/hooks/useProgressiveSearch";
import { PatientCandidate } from "@/types";
import {
  Loader2,
  AlertTriangle,
  RotateCcw,
  SearchX,
  FileText,
  Mail,
  Activity,
  Sparkles,
  ArrowRight,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const REPORT_TYPES = [
  { value: "detailed report", label: "Detailed Report", icon: FileText, desc: "Full analysis with metrics" },
  { value: "all emails", label: "All Emails", icon: Mail, desc: "Summary of all lab emails" },
  { value: "comparison", label: "Comparison", icon: Activity, desc: "Compare two test dates" },
  { value: "plain PDF", label: "Plain PDF", icon: FileText, desc: "Merge PDF attachments" },
];

const FORMATS = [
  { value: "summary", label: "Summary" },
  { value: "detailed", label: "Detailed" },
  { value: "graphical", label: "Graphical" },
];

function QueryPageContent() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialPatient = searchParams.get("patient") || "";

  // Search
  const { query, setQuery, tokenLabels, results, isLoading: searchLoading } = useProgressiveSearch();
  const hasQuery = query.trim().length > 0;
  const hasResults = results.patients.length > 0 || results.emails.length > 0;

  // Report config
  const [reportType, setReportType] = useState("detailed report");
  const [format, setFormat] = useState("detailed");

  // Generation state
  const [step, setStep] = useState<
    "query" | "searching" | "disambiguate" | "select_dates" | "generating" | "failed" | "no_results"
  >("query");
  const [candidates, setCandidates] = useState<PatientCandidate[]>([]);
  const [progress, setProgress] = useState("");
  const [pendingPatientId, setPendingPatientId] = useState<string | null>(null);
  const [pendingEmailIds, setPendingEmailIds] = useState<string[]>([]);
  const [pendingPatientName, setPendingPatientName] = useState<string>("");
  const [failedReport, setFailedReport] = useState<{
    reportId: string;
    patientId: string;
    emailIds: string[];
    patientName: string;
    reportType?: string;
    format?: string;
    errorMessage: string;
  } | null>(null);
  const queryValuesRef = useRef({ reportType: "detailed report", format: "detailed" });

  // Pre-fill from URL param
  useEffect(() => {
    if (initialPatient && !query) setQuery(initialPatient);
  }, [initialPatient]);

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/auth/signin");
  }, [status, router]);

  // Keep ref in sync
  useEffect(() => {
    queryValuesRef.current = { reportType, format };
  }, [reportType, format]);

  // ── Generate flow ──────────────────────────────────────

  const handleGenerate = useCallback(async () => {
    if (results.patients.length === 0 && results.emails.length === 0) {
      toast.error("No patients or emails found. Adjust your search.");
      return;
    }

    const emailIds = results.emails.map((e) => e.id);

    if (results.patients.length > 1) {
      setCandidates(
        results.patients.map((p) => ({
          id: p.id,
          name: p.name,
          governmentId: p.governmentId,
          emailCount: p.emailCount,
        }))
      );
      setStep("disambiguate");
      return;
    }

    if (results.patients.length === 1) {
      await proceedWithPatient(results.patients[0].id, emailIds, results.patients[0].name, reportType, format);
      return;
    }

    // No patients but we have emails — fall back to Gmail sync
    setStep("searching");
    setProgress("Syncing emails from Gmail...");
    try {
      const name = query.trim().split(/\s+/).slice(0, 2).join(" ");
      const syncRes = await fetch("/api/gmail/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: name, patientName: name }),
      });
      if (!syncRes.ok) throw new Error("Failed to sync");
      const syncData = await syncRes.json();
      if (syncData.total === 0) { setStep("no_results"); return; }

      const syncEmailIds = syncData.emails.map((e: { id: string }) => e.id);
      const disambRes = await fetch("/api/patients/disambiguate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ patientName: name, emailIds: syncEmailIds }),
      });
      const disambData = await disambRes.json();

      if (disambData.needsDisambiguation) {
        setCandidates(disambData.candidates);
        setStep("disambiguate");
        return;
      }
      const patId = disambData.candidates[0]?.id;
      if (!patId) { toast.error("Patient not found."); setStep("query"); return; }
      await proceedWithPatient(patId, syncEmailIds, name, reportType, format);
    } catch {
      toast.error("An error occurred.");
      setStep("query");
    }
  }, [results, query, reportType, format, router]);

  const proceedWithPatient = useCallback(
    async (patId: string, emailIds: string[], name: string, rType?: string, fmt?: string) => {
      if (rType === "plain PDF") {
        await generatePlainPdf(patId, emailIds, name);
      } else if (rType === "comparison") {
        setPendingPatientId(patId);
        setPendingEmailIds(emailIds);
        setPendingPatientName(name);
        setStep("select_dates");
      } else {
        await generateReport(patId, emailIds, name, rType, fmt);
      }
    },
    [router]
  );

  const handlePatientSelect = useCallback(
    async (candidate: PatientCandidate) => {
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
      const emailIds = results.emails.map((e) => e.id);
      await proceedWithPatient(patientId, emailIds, candidate.name, queryValuesRef.current.reportType, queryValuesRef.current.format);
    },
    [results, proceedWithPatient]
  );

  const generatePlainPdf = async (patientId: string, emailIds: string[], name: string) => {
    setStep("generating");
    setProgress("Fetching & merging PDF attachments...");
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
          if (report.status === "completed") { clearInterval(pollInterval); router.push(`/report/${data.reportId}`); }
          else if (report.status === "failed" || report.status === "no_results") {
            clearInterval(pollInterval);
            report.status === "no_results" ? setStep("no_results") : (() => { toast.error("Failed to merge PDFs."); setStep("query"); })();
          }
        }, 1500);
      } else { toast.error("Failed to create report."); setStep("query"); }
    } catch { toast.error("An error occurred."); setStep("query"); }
  };

  const generateReport = async (
    patientId: string, emailIds: string[], name: string,
    rType?: string, fmt?: string, comparisonDateA?: string, comparisonDateB?: string
  ) => {
    setStep("generating");
    setProgress("Step 1/2: Extracting blood metrics...");
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
          const steps: Record<string, string> = { extracting_metrics: "Step 1/2: Extracting blood metrics...", generating_summary: "Step 2/2: Generating summary & analysis..." };
          setProgress(steps[report.step] || report.step);
        }
        if (report.status === "completed" || report.status === "failed" || report.status === "no_results") {
          clearInterval(pollInterval);
          if (report.status === "completed") router.push(`/report/${data.reportId}`);
          else if (report.status === "no_results") setStep("no_results");
          else {
            setFailedReport({ reportId: data.reportId, patientId, emailIds, patientName: name, reportType: rType, format: fmt, errorMessage: report.step || "An unexpected error occurred." });
            setStep("failed");
          }
        }
      }, 2000);
    }
  };

  const handleRetry = async () => {
    if (!failedReport) return;
    await fetch(`/api/reports?id=${failedReport.reportId}`, { method: "DELETE" });
    const { patientId, emailIds, patientName: name, reportType: rt, format: f } = failedReport;
    setFailedReport(null);
    await generateReport(patientId, emailIds, name, rt, f);
  };

  const handleStartOver = () => {
    setFailedReport(null);
    setStep("query");
    setProgress("");
  };

  if (status === "loading" || !session) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Navbar />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        <AnimatePresence mode="wait">
          {step === "query" && (
            <PageTransition key="query">
              {/* Header */}
              <div className="text-center mb-8">
                <h1 className="text-2xl font-bold mb-1">Query Builder</h1>
                <p className="text-text-secondary text-sm">
                  Type tokens to build your query, then choose report type
                </p>
              </div>

              {/* Search Bar — full width above columns */}
              <div className="mb-6">
                <SearchBar
                  query={query}
                  onChange={setQuery}
                  tokenLabels={tokenLabels}
                  isLoading={searchLoading}
                />
              </div>

              {/* Two-column layout: controls left, emails right */}
              <div className="flex flex-col lg:flex-row gap-6">
                {/* Left column — report config */}
                <div className="flex-1 min-w-0">
                  {/* Report Type */}
                  <div className="mb-5">
                    <p className="text-sm font-medium mb-2.5">Report Type</p>
                    <div className="grid grid-cols-2 gap-2">
                      {REPORT_TYPES.map((t) => (
                        <motion.button
                          key={t.value}
                          whileTap={{ scale: 0.97 }}
                          onClick={() => setReportType(t.value)}
                          className={cn(
                            "flex items-center gap-2.5 p-3 rounded-xl border text-left transition-all cursor-pointer",
                            reportType === t.value
                              ? "border-primary/40 bg-primary/5 ring-2 ring-primary/10"
                              : "border-card-border hover:border-card-border/80 bg-card"
                          )}
                        >
                          <t.icon className={cn("w-4 h-4 shrink-0", reportType === t.value ? "text-primary" : "text-text-muted")} />
                          <div>
                            <p className={cn("text-xs font-medium", reportType === t.value ? "text-primary" : "text-foreground")}>{t.label}</p>
                            <p className="text-[10px] text-text-muted mt-0.5">{t.desc}</p>
                          </div>
                        </motion.button>
                      ))}
                    </div>
                  </div>

                  {/* Format — hide for plain PDF */}
                  <AnimatePresence>
                    {reportType !== "plain PDF" && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="mb-6"
                      >
                        <p className="text-sm font-medium mb-2.5">Format</p>
                        <div className="flex gap-2">
                          {FORMATS.map((f) => (
                            <motion.button
                              key={f.value}
                              whileTap={{ scale: 0.95 }}
                              onClick={() => setFormat(f.value)}
                              className={cn(
                                "px-4 py-2 rounded-xl text-sm font-medium transition-all cursor-pointer",
                                format === f.value
                                  ? "bg-primary text-white"
                                  : "border border-card-border text-text-secondary hover:border-foreground/20"
                              )}
                            >
                              {f.label}
                            </motion.button>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Generate button */}
                  <Button
                    className="w-full py-3"
                    onClick={handleGenerate}
                    disabled={!hasResults || searchLoading}
                  >
                    <Sparkles className="w-4 h-4 mr-2" />
                    Generate Report
                    {hasResults && (
                      <span className="ml-2 text-xs opacity-70">
                        ({results.emails.length} emails)
                      </span>
                    )}
                  </Button>

                  {/* Syntax hint when empty */}
                  {!hasQuery && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.3 }}
                      className="mt-6"
                    >
                      <p className="text-xs text-text-muted mb-2">Token format:</p>
                      <div className="flex flex-wrap gap-1.5 text-xs">
                        {[
                          { label: "isim", example: "ENİS", color: "bg-blue-500" },
                          { label: "soyisim", example: "ARPACI", color: "bg-blue-500" },
                          { label: "yil", example: "2025", color: "bg-amber-500" },
                          { label: "ay", example: "4", color: "bg-amber-500" },
                          { label: "lab", example: "lb", color: "bg-purple-500" },
                          { label: "cinsiyet", example: "E", color: "bg-pink-500" },
                          { label: "dogum yili", example: "1963", color: "bg-emerald-500" },
                        ].map((t) => (
                          <span key={t.label} className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-card border border-card-border">
                            <span className={`w-2 h-2 rounded-full ${t.color}`} />
                            <code className="font-mono">{t.example}</code>
                            <span className="text-text-muted">{t.label}</span>
                          </span>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </div>

                {/* Right column — live email results */}
                <div className="lg:w-80 shrink-0">
                  <div className="flex items-center gap-2 mb-3">
                    <Mail className="w-4 h-4 text-text-muted" />
                    <span className="text-sm font-medium text-text-muted">
                      {hasQuery ? `${results.emails.length} email${results.emails.length !== 1 ? "s" : ""} found` : "Matching emails"}
                    </span>
                  </div>

                  <GlassCard className="overflow-hidden">
                    <AnimatePresence mode="wait">
                      {!hasQuery && (
                        <motion.div
                          key="empty"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          className="p-8 text-center"
                        >
                          <Mail className="w-8 h-8 text-text-faint mx-auto mb-2" />
                          <p className="text-xs text-text-muted">
                            Start typing to see matching emails
                          </p>
                        </motion.div>
                      )}

                      {hasQuery && searchLoading && results.emails.length === 0 && (
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

                      {hasQuery && !searchLoading && results.emails.length === 0 && (
                        <motion.div
                          key="no-emails"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          className="p-8 text-center"
                        >
                          <SearchX className="w-6 h-6 text-text-faint mx-auto mb-2" />
                          <p className="text-xs text-text-muted">No emails match</p>
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
                            <motion.div
                              key={email.id}
                              initial={{ opacity: 0, x: 8 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: i * 0.03 }}
                              className="px-3 py-2.5 hover:bg-card-hover/50 transition-colors"
                            >
                              <p className="text-xs font-medium truncate">
                                {email.subject || "(no subject)"}
                              </p>
                              <div className="flex items-center gap-2 mt-0.5 text-[11px] text-text-muted">
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
                            </motion.div>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </GlassCard>

                  {/* Patient summary below emails */}
                  {results.patients.length > 0 && (
                    <div className="mt-3">
                      <div className="flex items-center gap-2 mb-2">
                        <User className="w-4 h-4 text-text-muted" />
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
              </div>
            </PageTransition>
          )}

          {(step === "searching" || step === "generating") && (
            <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center justify-center py-24">
              <Loader2 className="w-10 h-10 text-primary animate-spin mb-6" />
              <p className="text-lg font-medium">{progress}</p>
            </motion.div>
          )}

          {step === "failed" && failedReport && (
            <motion.div key="failed" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center justify-center py-24 max-w-md mx-auto">
              <div className="p-3 rounded-full bg-severity-high/10 mb-6">
                <AlertTriangle className="w-10 h-10 text-severity-high" />
              </div>
              <h2 className="text-xl font-bold mb-2">Report Generation Failed</h2>
              <p className="text-sm text-text-secondary text-center mb-6">{failedReport.errorMessage}</p>
              <div className="flex gap-3">
                <Button variant="ghost" onClick={handleStartOver}>Start Over</Button>
                <Button onClick={handleRetry}><RotateCcw className="w-4 h-4 mr-2" />Retry</Button>
              </div>
            </motion.div>
          )}

          {step === "no_results" && (
            <motion.div key="no-results" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center justify-center py-24 max-w-md mx-auto">
              <div className="p-3 rounded-full bg-text-muted/10 mb-6">
                <SearchX className="w-10 h-10 text-text-muted" />
              </div>
              <h2 className="text-xl font-bold mb-2">No Lab Reports Found</h2>
              <p className="text-sm text-text-secondary text-center mb-6">
                No laboratory test results were found for this patient.
              </p>
              <Button variant="ghost" onClick={handleStartOver}>Try Another Search</Button>
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
    </div>
  );
}

export default function QueryPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <QueryPageContent />
    </Suspense>
  );
}
