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
          <Loader2 className="w-8 h-8 text-sky-accent animate-spin" />
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
            <div className="flex items-center gap-2 text-sm text-foreground/50 mt-1">
              <User className="w-3.5 h-3.5" />
              <span>{report.patient.name}</span>
              {report.patient.governmentId && (
                <span className="text-foreground/30">
                  • ID: {report.patient.governmentId}
                </span>
              )}
            </div>
          </div>
        </div>

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
                      ? "bg-sky-accent/10 text-sky-accent"
                      : "text-foreground/40 hover:text-foreground/60"
                  )}
                >
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
