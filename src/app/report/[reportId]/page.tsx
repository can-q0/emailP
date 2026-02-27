"use client";

import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import { useState, useEffect } from "react";
import { Navbar } from "@/components/navbar";
import { ReportLayout } from "@/components/report/report-layout";
import { getLayoutConfig } from "@/config/report-layouts";
import { Button } from "@/components/ui/button";
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
} from "lucide-react";
import { format as formatDate } from "date-fns";

export default function ReportPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
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

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/reports?id=${reportId}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      router.replace("/report");
    } catch {
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
      setTimeout(() => {
        setShowSendModal(false);
        setSendResult(null);
        setSendEmail("");
      }, 2000);
    } catch {
      setSendResult("error");
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
      const res = await fetch(`/api/reports?id=${reportId}`);
      if (!res.ok) {
        router.replace("/report");
        return;
      }
      const data = await res.json();
      setReport({
        ...data,
        attentionPoints: data.attentionPoints || [],
        bloodMetrics: data.bloodMetrics || [],
        emails: data.emails || [],
      });
      setLoading(false);
    };

    fetchReport();
  }, [reportId, session, router]);

  if (status === "loading" || loading || !session) {
    return (
      <div className="min-h-screen">
        <Navbar />
        <div className="flex items-center justify-center py-32">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
        </div>
      </div>
    );
  }

  if (!report) return null;

  const layout = getLayoutConfig(report.reportType, report.format);

  return (
    <div className="min-h-screen">
      <Navbar />

      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Button variant="ghost" size="sm" onClick={() => router.back()}>
            <ArrowLeft className="w-4 h-4 mr-1" />
            Back
          </Button>
          <div className="flex-1 flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-primary/10">
              <User className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">{report.patient.name}</h1>
              <div className="flex items-center gap-2 text-sm text-text-muted mt-0.5">
                {report.patient.governmentId && (
                  <span>TC: {report.patient.governmentId}</span>
                )}
                <span>•</span>
                <span>{formatDate(new Date(report.createdAt), "MMM d, yyyy")}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => window.open(`/api/reports/pdf?id=${reportId}`, "_blank")}
            >
              <Download className="w-4 h-4 mr-1" />
              PDF
            </Button>
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
        {showSendModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
            <div className="bg-card border border-card-border rounded-2xl shadow-xl w-full max-w-md p-6 mx-4">
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
                <div className="flex flex-col items-center py-6 text-green-600">
                  <CheckCircle className="w-10 h-10 mb-3" />
                  <p className="font-medium">Report sent successfully!</p>
                </div>
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
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {showDeleteModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
            <div className="bg-card border border-card-border rounded-2xl shadow-xl w-full max-w-sm p-6 mx-4">
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
            </div>
          </div>
        )}

        <ReportLayout report={report} layout={layout} />
      </div>
    </div>
  );
}
