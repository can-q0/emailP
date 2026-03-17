"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { GlassCard } from "@/components/ui/glass-card";
import { Button } from "@/components/ui/button";
import { BloodMetricsChart } from "@/components/report/blood-metrics-chart";
import {
  Users,
  Mail,
  Activity,
  AlertTriangle,
  FileText,
  ChevronDown,
  Loader2,
  BarChart3,
  X,
} from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import type { SearchResult, PatientSearchResult } from "@/types";

interface SearchResultsProps {
  results: SearchResult;
  isLoading: boolean;
}

export function SearchResults({ results, isLoading }: SearchResultsProps) {
  const { patients, emails, metrics, stats } = results;
  const hasResults = patients.length > 0 || emails.length > 0 || metrics.length > 0;

  if (!hasResults && !isLoading) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-8"
    >
      {/* Stats bar */}
      {hasResults && <StatsBar stats={stats} />}

      {/* Patient cards */}
      {patients.length > 0 && <PatientCards patients={patients} />}

      {/* Email list */}
      {emails.length > 0 && <EmailList emails={results.emails} />}

      {/* Metric charts */}
      {metrics.length > 0 && (
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <BloodMetricsChart
            metrics={metrics}
            variant="sparklines"
          />
        </motion.section>
      )}
    </motion.div>
  );
}

// ── Stats Bar ────────────────────────────────────────────

function StatsBar({ stats }: { stats: SearchResult["stats"] }) {
  const items = [
    {
      icon: Users,
      value: stats.uniquePatients,
      label: "hasta",
      color: "text-blue-500",
      bg: "bg-blue-500/10",
    },
    {
      icon: Mail,
      value: stats.totalEmails,
      label: "email",
      color: "text-text-secondary",
      bg: "bg-card-hover",
    },
    {
      icon: Activity,
      value: stats.totalMetrics,
      label: "metrik",
      color: "text-primary",
      bg: "bg-primary/10",
    },
    ...(stats.abnormalCount > 0
      ? [
          {
            icon: AlertTriangle,
            value: stats.abnormalCount,
            label: "anormal",
            color: "text-severity-high",
            bg: "bg-severity-high/10",
          },
        ]
      : []),
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="flex flex-wrap items-center gap-2">
        {items.map((item, i) => (
          <motion.div
            key={item.label}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.05, duration: 0.25 }}
            className={cn(
              "flex items-center gap-2 px-3 py-2 rounded-xl border border-card-border",
              item.bg
            )}
          >
            <item.icon className={cn("w-4 h-4", item.color)} />
            <span className="text-sm font-semibold">{item.value}</span>
            <span className="text-xs text-text-muted">{item.label}</span>
          </motion.div>
        ))}

        {stats.dateRange && (
          <motion.span
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="text-xs text-text-muted ml-auto px-3 py-2 rounded-xl border border-card-border bg-card"
          >
            {format(new Date(stats.dateRange.from), "MMM yyyy")} — {format(new Date(stats.dateRange.to), "MMM yyyy")}
          </motion.span>
        )}
      </div>
    </motion.div>
  );
}

// ── Initials Avatar ──────────────────────────────────────

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
        "w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-sm font-semibold text-primary shrink-0",
        className
      )}
    >
      {initials}
    </div>
  );
}

// ── Patient Cards ────────────────────────────────────────

function PatientCards({ patients }: { patients: PatientSearchResult[] }) {
  const router = useRouter();
  const [generatingId, setGeneratingId] = useState<string | null>(null);

  const handleGenerateReport = useCallback(async (patient: PatientSearchResult) => {
    setGeneratingId(patient.id);
    toast.loading("Rapor oluşturuluyor...", { id: `gen-${patient.id}` });
    try {
      const syncRes = await fetch("/api/gmail/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: patient.name,
          patientName: patient.name,
        }),
      });
      const syncData = await syncRes.json();
      const emailIds = syncData.emails?.map((e: { id: string }) => e.id) || [];

      if (emailIds.length === 0) {
        toast.dismiss(`gen-${patient.id}`);
        toast.error("Email bulunamadı.");
        setGeneratingId(null);
        return;
      }

      const disambRes = await fetch("/api/patients/disambiguate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ patientName: patient.name, emailIds }),
      });
      const disambData = await disambRes.json();
      const patientId = disambData.candidates?.[0]?.id || patient.id;

      const genRes = await fetch("/api/ai/generate-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientId,
          emailIds,
          title: `Report for ${patient.name}`,
          reportType: "detailed report",
          format: "detailed",
        }),
      });
      const genData = await genRes.json();

      if (genData.reportId) {
        const poll = setInterval(async () => {
          const statusRes = await fetch(`/api/reports?id=${genData.reportId}`);
          const report = await statusRes.json();
          if (report.status === "completed") {
            clearInterval(poll);
            toast.dismiss(`gen-${patient.id}`);
            toast.success("Rapor hazır!");
            router.push(`/report/${genData.reportId}`);
          } else if (report.status === "failed" || report.status === "no_results") {
            clearInterval(poll);
            toast.dismiss(`gen-${patient.id}`);
            toast.error("Rapor oluşturulamadı.");
            setGeneratingId(null);
          }
        }, 2000);
      } else {
        toast.dismiss(`gen-${patient.id}`);
        toast.error("Rapor oluşturulamadı.");
        setGeneratingId(null);
      }
    } catch {
      toast.dismiss(`gen-${patient.id}`);
      toast.error("Bir hata oluştu.");
      setGeneratingId(null);
    }
  }, [router]);

  return (
    <section>
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 rounded-xl bg-blue-500/10">
          <Users className="w-5 h-5 text-blue-500" />
        </div>
        <h2 className="text-lg font-bold">Hastalar</h2>
        <span className="text-sm text-text-muted">{patients.length} sonuç</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <AnimatePresence mode="popLayout">
          {patients.map((patient, i) => (
            <motion.div
              key={patient.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ delay: i * 0.06, duration: 0.3 }}
              layout
            >
              <GlassCard hover className="p-4">
                <div className="flex items-start gap-3">
                  <InitialsAvatar name={patient.name} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="font-semibold truncate">{patient.name}</h3>
                        <div className="flex items-center gap-2 mt-0.5 text-xs text-text-muted flex-wrap">
                          {patient.governmentId && (
                            <span className="px-1.5 py-0.5 rounded bg-card-hover border border-card-border font-mono">
                              TC: {patient.governmentId}
                            </span>
                          )}
                          {patient.gender && (
                            <span>{patient.gender === "Male" ? "Erkek" : "Kadın"}</span>
                          )}
                          {patient.birthYear && <span>{patient.birthYear}</span>}
                        </div>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => handleGenerateReport(patient)}
                        disabled={generatingId !== null}
                      >
                        {generatingId === patient.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <>
                            <BarChart3 className="w-3.5 h-3.5 mr-1.5" />
                            Rapor
                          </>
                        )}
                      </Button>
                    </div>

                    {/* Stats row */}
                    <div className="flex items-center gap-3 mt-2.5">
                      <span className="flex items-center gap-1.5 text-xs text-text-secondary">
                        <Mail className="w-3.5 h-3.5" />
                        <span className="font-medium">{patient.emailCount}</span> email
                      </span>
                      <span className="flex items-center gap-1.5 text-xs text-text-secondary">
                        <Activity className="w-3.5 h-3.5" />
                        <span className="font-medium">{patient.metricCount}</span> metrik
                      </span>
                    </div>
                  </div>
                </div>
              </GlassCard>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </section>
  );
}

// ── Email Detail Modal ───────────────────────────────────

interface EmailDetail {
  id: string;
  subject?: string;
  from?: string;
  date?: string;
  body?: string;
  patientName?: string;
}

function EmailModal({ email, onClose }: { email: EmailDetail | null; onClose: () => void }) {
  return (
    <AnimatePresence>
      {email && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 8 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="bg-card border border-card-border rounded-2xl shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between p-5 border-b border-card-border">
              <div className="min-w-0 flex-1">
                <h3 className="font-semibold text-base truncate">
                  {email.subject || "(konu yok)"}
                </h3>
                <div className="flex items-center gap-2 text-xs text-text-muted mt-1">
                  {email.from && <span className="truncate">{email.from}</span>}
                  {email.date && (
                    <>
                      <span>·</span>
                      <span>{format(new Date(email.date), "d MMM yyyy HH:mm")}</span>
                    </>
                  )}
                  {email.patientName && (
                    <>
                      <span>·</span>
                      <span className="font-medium text-text-secondary">{email.patientName}</span>
                    </>
                  )}
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-1 rounded-lg hover:bg-secondary/50 text-text-muted shrink-0 ml-3 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 overflow-y-auto">
              <p className="text-sm text-text-secondary whitespace-pre-wrap leading-relaxed">
                {email.body || "İçerik yok"}
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ── Email List ───────────────────────────────────────────

function EmailList({ emails }: { emails: SearchResult["emails"] }) {
  const [expanded, setExpanded] = useState(false);
  const [selectedEmail, setSelectedEmail] = useState<EmailDetail | null>(null);
  const [loadingEmailId, setLoadingEmailId] = useState<string | null>(null);
  const displayed = expanded ? emails : emails.slice(0, 5);

  const handleEmailClick = async (emailId: string) => {
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
  };

  return (
    <section>
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 rounded-xl bg-[#6B5B4D]/10">
          <Mail className="w-5 h-5 text-[#6B5B4D]" />
        </div>
        <h2 className="text-lg font-bold">Emailler</h2>
        <span className="text-sm text-text-muted">{emails.length} sonuç</span>
      </div>

      <GlassCard className="divide-y divide-card-border overflow-hidden">
        {displayed.map((email, i) => (
          <motion.button
            key={email.id}
            type="button"
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.03, duration: 0.25 }}
            onClick={() => handleEmailClick(email.id)}
            className="w-full flex items-center gap-3 p-3.5 hover:bg-card-hover/50 transition-colors cursor-pointer text-left"
          >
            <div className="p-1.5 rounded-lg bg-severity-low/10 shrink-0">
              {loadingEmailId === email.id ? (
                <Loader2 className="w-3.5 h-3.5 text-severity-low animate-spin" />
              ) : (
                <FileText className="w-3.5 h-3.5 text-severity-low" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate text-sm">
                {email.subject || "(konu yok)"}
              </p>
              <div className="flex items-center gap-2 text-xs text-text-muted mt-0.5">
                {email.patientName && (
                  <>
                    <span className="font-medium text-text-secondary">{email.patientName}</span>
                    <span className="text-text-faint">·</span>
                  </>
                )}
                {email.date && (
                  <span>{format(new Date(email.date), "d MMM yyyy")}</span>
                )}
                {email.from && (
                  <>
                    <span className="text-text-faint">·</span>
                    <span className="truncate">{email.from}</span>
                  </>
                )}
              </div>
            </div>
            {email.pdfPath && (
              <span className="px-2 py-0.5 rounded-lg text-xs bg-primary/10 text-primary font-medium border border-primary/20 shrink-0">
                PDF
              </span>
            )}
          </motion.button>
        ))}
      </GlassCard>

      {!expanded && emails.length > 5 && (
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          onClick={() => setExpanded(true)}
          className="mt-3 flex items-center gap-1.5 text-sm text-primary font-medium hover:underline cursor-pointer"
        >
          <ChevronDown className="w-4 h-4" />
          Tümünü göster ({emails.length})
        </motion.button>
      )}

      <EmailModal email={selectedEmail} onClose={() => setSelectedEmail(null)} />
    </section>
  );
}
