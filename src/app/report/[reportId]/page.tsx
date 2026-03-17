"use client";

import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { Navbar } from "@/components/navbar";
import { ReportLayout } from "@/components/report/report-layout";
import { getLayoutConfig } from "@/config/report-layouts";
import { Button } from "@/components/ui/button";
import { PageTransition } from "@/components/ui/page-transition";
import { SkeletonReport } from "@/components/ui/skeleton";
import { ReportData } from "@/types";
import {
  ArrowLeft,
  Loader2,
  User,
  Send,
  X,
  CheckCircle,
  Trash2,
  Download,
  FileSpreadsheet,
} from "lucide-react";
import { format as formatDate } from "date-fns";
import { useOnboarding } from "@/components/onboarding/onboarding-provider";
import { SpotlightOverlay } from "@/components/onboarding/spotlight-overlay";
import { REPORT_TOUR } from "@/components/onboarding/tour-steps";

export default function ReportPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { activeTour, completedTours, startTour, completeTour, cancelTour } = useOnboarding();
  const params = useParams();
  const reportId = params.reportId as string;
  const [report, setReport] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showSendModal, setShowSendModal] = useState(false);
  const [sendEmail, setSendEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<"success" | "error" | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [language, setLanguage] = useState("en");

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/reports?id=${reportId}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      toast.success("Report deleted.");
      router.replace("/report");
    } catch {
      toast.error("Failed to delete report.");
      setDeleting(false);
      setShowDeleteModal(false);
    }
  };

  const handleSendReport = async () => {
    if (!sendEmail || !reportId) return;
    setSending(true);
    setSendResult(null);
    try {
      const res = await fetch("/api/reports/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reportId, recipientEmail: sendEmail }),
      });
      if (!res.ok) throw new Error();
      setSendResult("success");
      toast.success("Report sent successfully!");
      setTimeout(() => {
        setShowSendModal(false);
        setSendResult(null);
        setSendEmail("");
      }, 1500);
    } catch {
      setSendResult("error");
      toast.error("Failed to send report.");
    } finally {
      setSending(false);
    }
  };

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/auth/signin");
  }, [status, router]);

  useEffect(() => {
    if (!reportId || !session) return;

    const fetchReport = async () => {
      const [reportRes, settingsRes] = await Promise.all([
        fetch(`/api/reports?id=${reportId}`),
        fetch("/api/settings"),
      ]);
      if (!reportRes.ok) {
        router.replace("/report");
        return;
      }
      const data = await reportRes.json();
      setReport({
        ...data,
        attentionPoints: data.attentionPoints || [],
        trendAlerts: data.trendAlerts || [],
        bloodMetrics: data.bloodMetrics || [],
        emails: data.emails || [],
      });
      if (settingsRes.ok) {
        const settings = await settingsRes.json();
        if (settings.reportLanguage) setLanguage(settings.reportLanguage);
      }
      setLoading(false);
    };

    fetchReport();
  }, [reportId, session, router]);

  // Auto-start report tour on first report view
  useEffect(() => {
    if (!loading && report && !completedTours.includes("report")) {
      const timer = setTimeout(() => startTour("report"), 800);
      return () => clearTimeout(timer);
    }
  }, [loading, report, completedTours, startTour]);

  if (status === "loading" || loading || !session) {
    return (
      <div className="min-h-screen">
        <Navbar />
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
          <SkeletonReport />
        </div>
      </div>
    );
  }

  if (!report) return null;

  const isPlainPdf = report.reportType === "plain PDF";
  const layout = getLayoutConfig(report.reportType, report.format);

  return (
    <div className="min-h-screen">
      <Navbar />

      <PageTransition className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-8">
          <Button variant="ghost" size="sm" onClick={() => router.back()}>
            <ArrowLeft className="w-4 h-4 mr-1" />
            Back
          </Button>
          <div className="flex-1 flex items-center gap-3">
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 200, damping: 15 }}
              className="p-2.5 rounded-xl bg-primary/10 shrink-0"
            >
              <User className="w-5 h-5 text-primary" />
            </motion.div>
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl font-bold truncate">{report.patient.name}</h1>
              <div className="flex flex-wrap items-center gap-2 text-sm text-text-muted mt-0.5">
                {report.patient.governmentId && (
                  <span>TC: {report.patient.governmentId}</span>
                )}
                <span>•</span>
                <span>{formatDate(new Date(report.createdAt), "MMM d, yyyy")}</span>
              </div>
            </div>
          </div>
          <div data-tour="export-actions" className="flex flex-wrap items-center gap-2">
            {isPlainPdf ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  window.open(`/api/reports/plain-pdf?id=${reportId}`, "_blank");
                  toast.success("PDF download started.");
                }}
              >
                <Download className="w-4 h-4 mr-1" />
                PDF
              </Button>
            ) : (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    window.open(`/api/reports/pdf?id=${reportId}`, "_blank");
                    toast.success("PDF download started.");
                  }}
                >
                  <Download className="w-4 h-4 mr-1" />
                  PDF
                </Button>
                {report.bloodMetrics.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      const a = document.createElement("a");
                      a.href = `/api/reports/excel?id=${reportId}`;
                      a.download = "";
                      a.click();
                      toast.success("Excel download started.");
                    }}
                  >
                    <FileSpreadsheet className="w-4 h-4 mr-1" />
                    Excel
                  </Button>
                )}
              </>
            )}
            <Button onClick={() => setShowSendModal(true)}>
              <Send className="w-4 h-4 mr-2" />
              Send Report
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowDeleteModal(true)}
              className="text-severity-high hover:text-severity-high"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Send Report Modal */}
        <AnimatePresence>
          {showSendModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm"
              onClick={() => { setShowSendModal(false); setSendResult(null); }}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 8 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 8 }}
                transition={{ type: "spring", damping: 25, stiffness: 300 }}
                className="bg-card border border-card-border rounded-2xl shadow-xl w-full max-w-md p-6 mx-4"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold">Send Report via Email</h2>
                  <button
                    onClick={() => { setShowSendModal(false); setSendResult(null); }}
                    className="p-1 rounded-lg hover:bg-secondary/50 text-text-muted"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                {sendResult === "success" ? (
                  <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="flex flex-col items-center py-6 text-green-600"
                  >
                    <CheckCircle className="w-10 h-10 mb-3" />
                    <p className="font-medium">Report sent successfully!</p>
                  </motion.div>
                ) : (
                  <>
                    <p className="text-sm text-text-secondary mb-4">
                      Send report for {report.patient.name} to a recipient.
                    </p>
                    <input
                      type="email"
                      placeholder="recipient@example.com"
                      value={sendEmail}
                      onChange={(e) => setSendEmail(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleSendReport()}
                      className="w-full px-4 py-3 rounded-xl border border-card-border bg-background text-foreground placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/30 mb-3"
                    />
                    {sendResult === "error" && (
                      <p className="text-sm text-red-500 mb-3">Failed to send. Check the email and try again.</p>
                    )}
                    <div className="flex justify-end gap-3">
                      <Button variant="ghost" onClick={() => setShowSendModal(false)}>
                        Cancel
                      </Button>
                      <Button onClick={handleSendReport} disabled={sending || !sendEmail}>
                        {sending ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <Send className="w-4 h-4 mr-2" />
                        )}
                        {sending ? "Sending..." : "Send"}
                      </Button>
                    </div>
                  </>
                )}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Delete Confirmation Modal */}
        <AnimatePresence>
          {showDeleteModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm"
              onClick={() => setShowDeleteModal(false)}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 8 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 8 }}
                transition={{ type: "spring", damping: 25, stiffness: 300 }}
                className="bg-card border border-card-border rounded-2xl shadow-xl w-full max-w-sm p-6 mx-4"
                onClick={(e) => e.stopPropagation()}
              >
                <h2 className="text-lg font-semibold mb-2">Delete Report?</h2>
                <p className="text-sm text-text-secondary mb-6">
                  This will permanently delete the report and all associated blood metrics. This action cannot be undone.
                </p>
                <div className="flex justify-end gap-3">
                  <Button variant="ghost" onClick={() => setShowDeleteModal(false)}>
                    Cancel
                  </Button>
                  <Button
                    onClick={handleDelete}
                    disabled={deleting}
                    className="bg-severity-high hover:bg-severity-high/90 text-white"
                  >
                    {deleting ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4 mr-2" />
                    )}
                    {deleting ? "Deleting..." : "Delete"}
                  </Button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {isPlainPdf ? (
          <div className="w-full" style={{ height: "calc(100vh - 140px)" }}>
            <iframe
              src={`/api/reports/plain-pdf?id=${reportId}`}
              className="w-full h-full rounded-xl border border-card-border"
              title="Merged PDF"
            />
          </div>
        ) : (
          <ReportLayout report={report} layout={layout} language={language} />
        )}
      </PageTransition>

      {/* Onboarding: Report Tour */}
      {activeTour === "report" && !isPlainPdf && (
        <SpotlightOverlay
          steps={REPORT_TOUR}
          onComplete={() => completeTour("report")}
          onSkip={() => cancelTour()}
        />
      )}
    </div>
  );
}
