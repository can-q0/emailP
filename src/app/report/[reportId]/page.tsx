"use client";

import React from "react";
import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { Navbar } from "@/components/navbar";
import { ReportLayout } from "@/components/report/report-layout";
import { getLayoutConfig } from "@/config/report-layouts";
import { Button } from "@/components/ui/button";
import { PageTransition } from "@/components/ui/page-transition";
import { SkeletonReport } from "@/components/ui/skeleton";
import { ReportData } from "@/types";
import { cn } from "@/lib/utils";
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
  Paperclip,
  Search,
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
  const [showMergedPdf, setShowMergedPdf] = useState(false);
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
        clinicalCorrelations: data.clinicalCorrelations || [],
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

  // Auto-refresh when report is partial (waiting for AI summary)
  useEffect(() => {
    if (!report || report.status !== "partial") return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/reports?id=${reportId}`);
        if (!res.ok) return;
        const data = await res.json();
        if (data.status === "completed") {
          setReport({
            ...data,
            attentionPoints: data.attentionPoints || [],
            trendAlerts: data.trendAlerts || [],
            clinicalCorrelations: data.clinicalCorrelations || [],
            bloodMetrics: data.bloodMetrics || [],
            emails: data.emails || [],
          });
          clearInterval(interval);
        }
      } catch { /* ignore */ }
    }, 3000);
    return () => clearInterval(interval);
  }, [report?.status, reportId]);

  // Report tour disabled — users find it intrusive
  // To re-enable: uncomment and the tour will show on first report view
  // useEffect(() => {
  //   if (!loading && report && !completedTours.includes("report")) {
  //     const timer = setTimeout(() => startTour("report"), 800);
  //     return () => clearTimeout(timer);
  //   }
  // }, [loading, report, completedTours, startTour]);

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
            {!isPlainPdf && report.emails.some((e: { pdfPath?: string }) => e.pdfPath) && (
              <Button
                variant={showMergedPdf ? "primary" : "ghost"}
                size="sm"
                onClick={() => setShowMergedPdf(!showMergedPdf)}
              >
                <Paperclip className="w-4 h-4 mr-1" />
                {showMergedPdf ? "Report" : "Lab PDFs"}
              </Button>
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
          <PdfViewerWithSearch
            reportId={reportId}
            emails={report.emails}
            pdfSrc={`/api/reports/plain-pdf?id=${reportId}`}
          />
        ) : showMergedPdf ? (
          <PdfViewerWithSearch reportId={reportId} emails={report.emails} />
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

// ── PDF Viewer with text search sidebar ─────────────────

interface EmailWithBody {
  id: string;
  subject?: string;
  body?: string;
  date?: string;
  pdfPath?: string;
}

function PdfViewerWithSearch({ reportId, emails, pdfSrc }: { reportId: string; emails: EmailWithBody[]; pdfSrc?: string }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeMatchId, setActiveMatchId] = useState<string | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  const searchableEmails = useMemo(
    () => emails.filter((e) => e.body && e.body.length > 10).sort((a, b) =>
      new Date(a.date || 0).getTime() - new Date(b.date || 0).getTime()
    ),
    [emails]
  );

  const query = searchQuery.trim().toLowerCase();
  const hasQuery = query.length >= 2;

  // Count total matches for the sidebar header
  const totalMatches = useMemo(() => {
    if (!hasQuery) return 0;
    let count = 0;
    for (const email of searchableEmails) {
      if (!email.body) continue;
      const lower = email.body.toLowerCase();
      let pos = 0;
      while (pos < lower.length) {
        const idx = lower.indexOf(query, pos);
        if (idx === -1) break;
        count++;
        pos = idx + query.length;
      }
    }
    return count;
  }, [query, hasQuery, searchableEmails]);

  // Build sidebar results (snippets with context)
  const sidebarResults = useMemo(() => {
    if (!hasQuery) return [];
    const results: Array<{ emailId: string; subject: string; date: string; matchIndex: number; snippet: string; globalId: string }> = [];
    let globalCounter = 0;

    for (const email of searchableEmails) {
      if (!email.body) continue;
      const lower = email.body.toLowerCase();
      let pos = 0;
      while (pos < lower.length) {
        const idx = lower.indexOf(query, pos);
        if (idx === -1) break;
        const start = Math.max(0, idx - 25);
        const end = Math.min(email.body.length, idx + query.length + 25);
        results.push({
          emailId: email.id,
          subject: email.subject || "(no subject)",
          date: email.date ? new Date(email.date).toISOString().slice(0, 10) : "",
          matchIndex: idx,
          snippet: email.body.slice(start, end),
          globalId: `match-${email.id}-${globalCounter++}`,
        });
        pos = idx + query.length;
        if (results.length >= 50) break;
      }
      if (results.length >= 50) break;
    }
    return results;
  }, [query, hasQuery, searchableEmails]);

  const handleResultClick = useCallback((globalId: string, resultIndex: number) => {
    setActiveMatchId(globalId);

    if (!contentRef.current) return;

    // Find all highlights in order and scroll to the Nth one
    const highlights = contentRef.current.querySelectorAll("[data-highlight-idx]");
    const targetEl = highlights[resultIndex];

    if (targetEl) {
      targetEl.scrollIntoView({ behavior: "smooth", block: "center" });
      targetEl.classList.add("ring-3", "ring-orange-400/70", "bg-orange-300/50", "scale-105", "z-20");
      setTimeout(() => {
        targetEl.classList.remove("ring-3", "ring-orange-400/70", "bg-orange-300/50", "scale-105", "z-20");
      }, 2500);
    }

    setTimeout(() => setActiveMatchId(null), 2500);
  }, []);

  return (
    <div className="flex gap-3 w-full" style={{ height: "calc(100vh - 140px)" }}>
      {/* Search sidebar */}
      <div className="w-64 shrink-0 flex flex-col border border-card-border rounded-xl bg-card overflow-hidden">
        <div className="p-3 border-b border-card-border space-y-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search lab values..."
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-card-border bg-background focus:outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10"
              autoFocus
            />
          </div>
          {hasQuery && (
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-text-muted">
                {totalMatches} result{totalMatches !== 1 ? "s" : ""}
              </span>
              <button
                onClick={() => setSearchQuery("")}
                className="text-[10px] text-primary hover:underline cursor-pointer"
              >
                Clear
              </button>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto">
          {!hasQuery ? (
            <div className="flex flex-col items-center justify-center h-full p-4 text-center">
              <Search className="w-5 h-5 text-text-faint mb-2" />
              <p className="text-[11px] text-text-muted leading-relaxed">
                Search for lab values, metric names, or any text
              </p>
            </div>
          ) : sidebarResults.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full p-4">
              <p className="text-xs text-text-muted">No matches</p>
            </div>
          ) : (
            <div>
              {sidebarResults.map((r, i) => {
                const showHeader = i === 0 || sidebarResults[i - 1].emailId !== r.emailId;
                return (
                  <div key={r.globalId}>
                    {showHeader && (
                      <div className="sticky top-0 z-10 px-3 py-1.5 bg-card-hover/80 backdrop-blur-sm border-b border-card-border">
                        <span className="text-[10px] font-medium text-text-secondary truncate block">{r.subject}</span>
                        <span className="text-[9px] text-text-muted">{r.date}</span>
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => handleResultClick(r.globalId, i)}
                      className={cn(
                        "w-full text-left px-3 py-1.5 text-[11px] leading-relaxed border-b border-card-border/30 cursor-pointer transition-colors hover:bg-primary/5",
                        activeMatchId === r.globalId && "bg-primary/10"
                      )}
                    >
                      <HighlightedSnippet text={r.snippet} query={searchQuery.trim()} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* PDF pages rendered as canvas — scrollable with DOM control */}
      <PdfCanvasViewer
        ref={contentRef}
        src={pdfSrc || `/api/reports/merged-pdf?id=${reportId}`}
        searchQuery={searchQuery}
      />
    </div>
  );
}

// ── PDF Canvas Viewer — renders pages as canvas for scroll control ───

interface PdfPageData {
  imageUrl: string;
  pageWidth: number;
  pageHeight: number;
  textItems: Array<{
    str: string;
    x: number;
    y: number;
    width: number;
    height: number;
  }>;
}

const PdfCanvasViewer = React.forwardRef<
  HTMLDivElement,
  { src: string; activeEmailId?: string; searchQuery?: string }
>(function PdfCanvasViewer({ src, searchQuery }, ref) {
  const [pages, setPages] = useState<PdfPageData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function renderPages() {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(src);
        if (!response.ok) throw new Error("Failed to load PDF");
        const arrayBuffer = await response.arrayBuffer();

        const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");
        pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

        const doc = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;
        const rendered: PdfPageData[] = [];

        for (let i = 1; i <= doc.numPages; i++) {
          const page = await doc.getPage(i);
          const scale = 1.5;
          const viewport = page.getViewport({ scale });
          const canvas = document.createElement("canvas");
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          const ctx = canvas.getContext("2d")!;
          await page.render({ canvasContext: ctx, viewport } as never).promise;

          // Extract text positions for highlight overlays
          const textContent = await page.getTextContent();
          const textItems = textContent.items
            .filter((item) => "str" in item && (item as { str: string }).str.trim().length > 0)
            .map((item) => {
              const ti = item as { str: string; transform: number[]; width: number; height: number };
              return {
              str: ti.str,
              x: ti.transform[4] * scale,
              y: viewport.height - ti.transform[5] * scale - (ti.height || 10) * scale,
              width: ti.width * scale,
              height: (ti.height || 10) * scale + 2,
            };});

          rendered.push({
            imageUrl: canvas.toDataURL("image/png"),
            pageWidth: viewport.width,
            pageHeight: viewport.height,
            textItems,
          });
          if (cancelled) return;
        }

        if (!cancelled) {
          setPages(rendered);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to render PDF");
          setLoading(false);
        }
      }
    }

    renderPages();
    return () => { cancelled = true; };
  }, [src]);

  const query = (searchQuery || "").trim().toLowerCase();

  if (loading) {
    return (
      <div className="flex-1 min-w-0 flex items-center justify-center rounded-xl border border-card-border bg-card">
        <div className="text-center">
          <Loader2 className="w-6 h-6 text-primary animate-spin mx-auto mb-2" />
          <p className="text-sm text-text-muted">Rendering PDF pages...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 min-w-0 flex items-center justify-center rounded-xl border border-card-border bg-card">
        <p className="text-sm text-severity-high">{error}</p>
      </div>
    );
  }

  return (
    <div
      ref={ref}
      className="flex-1 min-w-0 overflow-y-auto rounded-xl border border-card-border bg-neutral-700 p-2 space-y-2"
    >
      {pages.map((page, i) => (
        <div key={i} data-page={i} className="relative rounded shadow-md overflow-hidden">
          <img
            src={page.imageUrl}
            alt={`Page ${i + 1}`}
            className="w-full block"
          />
          {/* Highlight overlay for matching text */}
          {query.length >= 2 && (() => {
            // Count highlights on previous pages to get global offset
            const prevHighlightCount = pages.slice(0, i).reduce((sum, p) =>
              sum + p.textItems.filter((t) => t.str.toLowerCase().includes(query)).length, 0
            );
            return (
              <div className="absolute inset-0 pointer-events-none">
                {page.textItems
                  .filter((item) => item.str.toLowerCase().includes(query))
                  .map((item, j) => (
                    <div
                      key={j}
                      data-highlight-idx={prevHighlightCount + j}
                      className="absolute bg-yellow-400/40 border border-yellow-500/60 rounded-sm transition-all duration-300"
                      style={{
                        left: `${(item.x / page.pageWidth) * 100}%`,
                        top: `${(item.y / page.pageHeight) * 100}%`,
                        width: `${(item.width / page.pageWidth) * 100}%`,
                        height: `${(item.height / page.pageHeight) * 100}%`,
                      }}
                    />
                  ))}
              </div>
            );
          })()}
        </div>
      ))}
    </div>
  );
});

function HighlightedSnippet({ text, query }: { text: string; query: string }) {
  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();
  const parts: Array<{ text: string; highlight: boolean }> = [];
  let pos = 0;

  while (pos < text.length) {
    const idx = lowerText.indexOf(lowerQuery, pos);
    if (idx === -1) {
      parts.push({ text: text.slice(pos), highlight: false });
      break;
    }
    if (idx > pos) parts.push({ text: text.slice(pos, idx), highlight: false });
    parts.push({ text: text.slice(idx, idx + query.length), highlight: true });
    pos = idx + query.length;
  }

  return (
    <span className="text-text-secondary">
      {parts.map((p, i) =>
        p.highlight ? (
          <mark key={i} className="bg-primary/20 text-primary font-semibold rounded-sm px-0.5">{p.text}</mark>
        ) : (
          <span key={i} className="text-text-muted">{p.text}</span>
        )
      )}
    </span>
  );
}
