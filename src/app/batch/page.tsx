"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { Navbar } from "@/components/navbar";
import { GlassCard } from "@/components/ui/glass-card";
import { Button } from "@/components/ui/button";
import { PageTransition } from "@/components/ui/page-transition";
import { SkeletonCard } from "@/components/ui/skeleton";
import { ProgressSteps } from "@/components/ui/progress-steps";
import {
  Users,
  Search,
  Loader2,
  CheckCircle,
  AlertTriangle,
  Clock,
  ArrowLeft,
  FileText,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { trFuzzyIncludes } from "@/lib/turkish";

interface Patient {
  id: string;
  name: string;
  governmentId?: string;
  emailCount: number;
  reportCount: number;
}

interface BatchReport {
  patientId: string;
  patientName: string;
  reportId: string;
  status: string;
}

type Step = "select" | "configure" | "progress";

const BATCH_STEPS = [
  { label: "Select" },
  { label: "Configure" },
  { label: "Generate" },
];

export default function BatchPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [step, setStep] = useState<Step>("select");
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loadingPatients, setLoadingPatients] = useState(true);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [reportType, setReportType] = useState("detailed report");
  const [format, setFormat] = useState("detailed");
  const [batchReports, setBatchReports] = useState<BatchReport[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/auth/signin");
  }, [status, router]);

  useEffect(() => {
    if (status === "authenticated") {
      fetch("/api/patients")
        .then((r) => r.json())
        .then((data) => {
          if (Array.isArray(data)) setPatients(data);
          setLoadingPatients(false);
        })
        .catch(() => setLoadingPatients(false));
    }
  }, [status]);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const filteredPatients = patients.filter((p) =>
    trFuzzyIncludes(p.name, search)
  );

  const togglePatient = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else if (next.size < 20) next.add(id);
      return next;
    });
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const res = await fetch("/api/reports/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientIds: Array.from(selected),
          reportType,
          format,
        }),
      });

      const data = await res.json();
      if (data.reports) {
        setBatchReports(data.reports);
        setStep("progress");
        toast.success(`${data.reports.length} reports queued.`);

        const reportIds = data.reports.map((r: BatchReport) => r.reportId);
        pollRef.current = setInterval(async () => {
          const statusRes = await fetch(
            `/api/reports/batch-status?ids=${reportIds.join(",")}`
          );
          const statuses = await statusRes.json();
          if (Array.isArray(statuses)) {
            setBatchReports((prev) =>
              prev.map((r) => {
                const updated = statuses.find((s: { id: string }) => s.id === r.reportId);
                return updated ? { ...r, status: updated.status } : r;
              })
            );

            const allDone = statuses.every(
              (s: { status: string }) =>
                s.status === "completed" || s.status === "failed" || s.status === "no_results"
            );
            if (allDone && pollRef.current) {
              clearInterval(pollRef.current);
              pollRef.current = null;
              const completed = statuses.filter((s: { status: string }) => s.status === "completed").length;
              toast.success(`Batch complete: ${completed}/${statuses.length} succeeded.`);
            }
          }
        }, 3000);
      }
    } catch (error) {
      console.error("Batch error:", error);
      toast.error("Failed to start batch generation.");
    } finally {
      setSubmitting(false);
    }
  };

  const currentStepIdx = step === "select" ? 0 : step === "configure" ? 1 : 2;

  if (status === "loading" || !session) {
    return (
      <div className="min-h-screen">
        <Navbar />
        <div className="max-w-4xl mx-auto px-6 py-8 space-y-3">
          {[0, 1, 2].map((i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Navbar />
      <PageTransition className="max-w-4xl mx-auto px-6 py-8">
        <div className="flex items-center gap-3 mb-6">
          <Button variant="ghost" size="sm" onClick={() => router.push("/dashboard")}>
            <ArrowLeft className="w-4 h-4 mr-1" />
            Dashboard
          </Button>
          <div className="p-2.5 rounded-xl bg-primary/10">
            <Users className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Batch Reports</h1>
            <p className="text-sm text-text-muted">
              Generate reports for multiple patients at once
            </p>
          </div>
        </div>

        <div className="mb-8">
          <ProgressSteps steps={BATCH_STEPS} currentStep={currentStepIdx} />
        </div>

        <AnimatePresence mode="wait">
          {/* Step 1: Select Patients */}
          {step === "select" && (
            <motion.div
              key="select"
              initial={{ opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -16 }}
              transition={{ duration: 0.25 }}
            >
              <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                <input
                  type="text"
                  placeholder="Search patients..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-card-border bg-background text-foreground placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>

              {loadingPatients ? (
                <div className="space-y-2">
                  {[0, 1, 2, 3].map((i) => (
                    <div key={i} className="rounded-xl border border-card-border bg-card p-3">
                      <div className="flex items-center gap-3">
                        <div className="w-4 h-4 rounded bg-card-border/50 animate-shimmer bg-[length:200%_100%]" />
                        <div className="flex-1 space-y-1.5">
                          <div className="h-3.5 w-2/5 rounded bg-card-border/50 animate-shimmer bg-[length:200%_100%]" />
                          <div className="h-3 w-1/4 rounded bg-card-border/50 animate-shimmer bg-[length:200%_100%]" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : filteredPatients.length === 0 ? (
                <GlassCard className="p-6 text-center">
                  <p className="text-text-muted">
                    {patients.length === 0
                      ? "No patients found. Sync some emails first."
                      : "No patients match your search."}
                  </p>
                </GlassCard>
              ) : (
                <GlassCard className="divide-y divide-card-border max-h-[400px] overflow-y-auto">
                  {filteredPatients.map((p, i) => (
                    <motion.label
                      key={p.id}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.03, duration: 0.25 }}
                      className="flex items-center gap-3 px-4 py-3 hover:bg-secondary/30 transition-colors cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={selected.has(p.id)}
                        onChange={() => togglePatient(p.id)}
                        className="w-4 h-4 rounded border-card-border text-primary focus:ring-primary/30"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{p.name}</p>
                        {p.governmentId && (
                          <p className="text-xs text-text-muted">{p.governmentId}</p>
                        )}
                      </div>
                      <span className="text-xs text-text-muted">
                        {p.emailCount} email{p.emailCount !== 1 ? "s" : ""}
                      </span>
                    </motion.label>
                  ))}
                </GlassCard>
              )}

              <div className="flex items-center justify-between mt-4">
                <span className="text-sm text-text-muted">
                  {selected.size} of {patients.length} selected (max 20)
                </span>
                <Button
                  onClick={() => setStep("configure")}
                  disabled={selected.size === 0}
                >
                  Next: Configure
                </Button>
              </div>
            </motion.div>
          )}

          {/* Step 2: Configure */}
          {step === "configure" && (
            <motion.div
              key="configure"
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 16 }}
              transition={{ duration: 0.25 }}
            >
              <GlassCard className="p-6 space-y-6">
                <div>
                  <h3 className="font-semibold mb-3">Report Type</h3>
                  <div className="flex gap-2 flex-wrap">
                    {["detailed report", "all emails", "comparison"].map((opt) => (
                      <motion.button
                        key={opt}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => setReportType(opt)}
                        className={cn(
                          "px-4 py-2 rounded-full text-sm font-medium transition-all cursor-pointer",
                          reportType === opt
                            ? "bg-primary text-white"
                            : "border border-card-border text-text-secondary hover:border-foreground/20"
                        )}
                      >
                        {opt}
                      </motion.button>
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold mb-3">Format</h3>
                  <div className="flex gap-2 flex-wrap">
                    {["summary", "detailed", "graphical"].map((opt) => (
                      <motion.button
                        key={opt}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => setFormat(opt)}
                        className={cn(
                          "px-4 py-2 rounded-full text-sm font-medium transition-all cursor-pointer",
                          format === opt
                            ? "bg-primary text-white"
                            : "border border-card-border text-text-secondary hover:border-foreground/20"
                        )}
                      >
                        {opt}
                      </motion.button>
                    ))}
                  </div>
                </div>

                <div className="text-sm text-text-muted">
                  Generating reports for {selected.size} patient{selected.size !== 1 ? "s" : ""}
                </div>

                <div className="flex items-center justify-between">
                  <Button variant="ghost" onClick={() => setStep("select")}>
                    Back
                  </Button>
                  <Button onClick={handleSubmit} disabled={submitting}>
                    {submitting ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Submitting...
                      </>
                    ) : (
                      <>Generate {selected.size} Reports</>
                    )}
                  </Button>
                </div>
              </GlassCard>
            </motion.div>
          )}

          {/* Step 3: Progress */}
          {step === "progress" && (
            <motion.div
              key="progress"
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 16 }}
              transition={{ duration: 0.25 }}
            >
              <GlassCard className="divide-y divide-card-border">
                {batchReports.map((r, i) => (
                  <motion.div
                    key={r.reportId}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05, duration: 0.3 }}
                    className="flex items-center gap-3 px-4 py-3"
                  >
                    <AnimatePresence mode="wait">
                      <motion.div
                        key={r.status}
                        initial={{ scale: 0.5, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ type: "spring", stiffness: 300, damping: 20 }}
                      >
                        {r.status === "completed" ? (
                          <CheckCircle className="w-5 h-5 text-severity-low flex-shrink-0" />
                        ) : r.status === "failed" ? (
                          <AlertTriangle className="w-5 h-5 text-severity-high flex-shrink-0" />
                        ) : r.status === "no_results" ? (
                          <AlertTriangle className="w-5 h-5 text-text-muted flex-shrink-0" />
                        ) : (
                          <Clock className="w-5 h-5 text-severity-medium flex-shrink-0 animate-pulse" />
                        )}
                      </motion.div>
                    </AnimatePresence>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{r.patientName}</p>
                      <p className="text-xs text-text-muted capitalize">{r.status}</p>
                    </div>
                    {r.status === "completed" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => router.push(`/report/${r.reportId}`)}
                      >
                        <FileText className="w-4 h-4 mr-1" />
                        View
                      </Button>
                    )}
                  </motion.div>
                ))}
              </GlassCard>

              {/* Progress bar */}
              <div className="mt-4">
                <div className="relative h-1.5 bg-card-border rounded-full overflow-hidden">
                  <motion.div
                    className="absolute inset-y-0 left-0 bg-primary rounded-full"
                    animate={{
                      width: `${(batchReports.filter((r) => r.status === "completed" || r.status === "failed" || r.status === "no_results").length / batchReports.length) * 100}%`,
                    }}
                    transition={{ duration: 0.5 }}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between mt-4">
                <span className="text-sm text-text-muted">
                  {batchReports.filter((r) => r.status === "completed").length} of{" "}
                  {batchReports.length} completed
                </span>
                <Button variant="ghost" onClick={() => router.push("/dashboard")}>
                  Back to Dashboard
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </PageTransition>
    </div>
  );
}
