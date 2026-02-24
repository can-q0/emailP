"use client";

import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import { useState, useEffect } from "react";
import { Navbar } from "@/components/navbar";
import { GeneralSummary } from "@/components/report/general-summary";
import { BloodMetricsChart } from "@/components/report/blood-metrics-chart";
import { AttentionPoints } from "@/components/report/attention-points";
import { EmailTimeline } from "@/components/report/email-timeline";
import { GlassCard } from "@/components/ui/glass-card";
import { Button } from "@/components/ui/button";
import { ReportData, AttentionPoint } from "@/types";
import {
  FileText,
  Activity,
  AlertTriangle,
  Mail,
  ArrowLeft,
  Loader2,
  User,
  Send,
  X,
  CheckCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

const sections = [
  { id: "summary", label: "Summary", icon: FileText },
  { id: "metrics", label: "Metrics", icon: Activity },
  { id: "attention", label: "Attention", icon: AlertTriangle },
  { id: "emails", label: "Emails", icon: Mail },
];

export default function ReportPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const reportId = params.reportId as string;
  const [report, setReport] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState("summary");
  const [showSendModal, setShowSendModal] = useState(false);
  const [sendEmail, setSendEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<"success" | "error" | null>(null);

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

    sections.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [report]);

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

  const attentionPoints = (report.attentionPoints || []) as AttentionPoint[];

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
          <div className="flex-1">
            <h1 className="text-2xl font-bold">{report.title}</h1>
            <div className="flex items-center gap-2 text-sm text-text-secondary mt-1">
              <User className="w-3.5 h-3.5" />
              <span>{report.patient.name}</span>
              {report.patient.governmentId && (
                <span className="text-text-muted">
                  • ID: {report.patient.governmentId}
                </span>
              )}
            </div>
          </div>
          <Button onClick={() => setShowSendModal(true)}>
            <Send className="w-4 h-4 mr-2" />
            Send Report
          </Button>
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
                    Send &quot;{report.title}&quot; to a recipient.
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

        <div className="flex gap-8">
          {/* Sticky navigation */}
          <nav className="hidden lg:block w-48 shrink-0">
            <div className="sticky top-20 space-y-1">
              {sections.map(({ id, label, icon: Icon }) => (
                <a
                  key={id}
                  href={`#${id}`}
                  onClick={(e) => {
                    e.preventDefault();
                    document
                      .getElementById(id)
                      ?.scrollIntoView({ behavior: "smooth" });
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
              ))}
            </div>
          </nav>

          {/* Content */}
          <div className="flex-1 space-y-12 min-w-0">
            {report.summary && <GeneralSummary summary={report.summary} />}

            {report.bloodMetrics.length > 0 && (
              <BloodMetricsChart metrics={report.bloodMetrics} />
            )}

            {attentionPoints.length > 0 && (
              <AttentionPoints points={attentionPoints} />
            )}

            {report.emails.length > 0 && (
              <EmailTimeline emails={report.emails} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
