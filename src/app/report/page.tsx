"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { Navbar } from "@/components/navbar";
import { GlassCard } from "@/components/ui/glass-card";
import { Button } from "@/components/ui/button";
import { FileText, User, Calendar, Activity, ChevronRight, Loader2, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface ReportListItem {
  id: string;
  title: string;
  status: string;
  patient: { id: string; name: string };
  _count: { bloodMetrics: number; reportEmails: number };
  createdAt: string;
}

export default function ReportListPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [reports, setReports] = useState<ReportListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDeleteReport = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!confirm("Delete this report? This cannot be undone.")) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/reports?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        setReports((prev) => prev.filter((r) => r.id !== id));
      }
    } finally {
      setDeletingId(null);
    }
  };

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/auth/signin");
  }, [status, router]);

  useEffect(() => {
    if (!session) return;

    fetch("/api/reports")
      .then((r) => r.json())
      .then((data) => {
        setReports(data);
        setLoading(false);
      });
  }, [session]);

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

      <div className="max-w-4xl mx-auto px-6 py-12">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-bold">Reports</h1>
          <Button onClick={() => router.push("/dashboard")}>
            New Report
          </Button>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-6 h-6 text-primary animate-spin" />
          </div>
        ) : reports.length === 0 ? (
          <GlassCard className="p-12 text-center">
            <FileText className="w-12 h-12 text-text-faint mx-auto mb-4" />
            <h3 className="font-semibold mb-2">No reports yet</h3>
            <p className="text-sm text-text-secondary mb-6">
              Search for a patient to generate your first report.
            </p>
            <Button onClick={() => router.push("/dashboard")}>
              Get Started
            </Button>
          </GlassCard>
        ) : (
          <div className="space-y-3">
            {reports.map((report) => (
              <GlassCard
                key={report.id}
                className="p-5 cursor-pointer transition-all hover:border-primary/20"
                hover
                onClick={() => router.push(`/report/${report.id}`)}
              >
                <div className="flex items-center gap-4">
                  <div
                    className={cn(
                      "p-2.5 rounded-xl",
                      report.status === "completed"
                        ? "bg-severity-low/10"
                        : report.status === "processing"
                          ? "bg-severity-medium/10"
                          : "bg-severity-high/10"
                    )}
                  >
                    <FileText
                      className={cn(
                        "w-5 h-5",
                        report.status === "completed"
                          ? "text-severity-low"
                          : report.status === "processing"
                            ? "text-severity-medium"
                            : "text-severity-high"
                      )}
                    />
                  </div>

                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold truncate">{report.title}</h3>
                    <div className="flex items-center gap-3 text-sm text-text-muted mt-1">
                      <span className="flex items-center gap-1">
                        <User className="w-3.5 h-3.5" />
                        {report.patient.name}
                      </span>
                      <span className="flex items-center gap-1">
                        <Activity className="w-3.5 h-3.5" />
                        {report._count.bloodMetrics} metrics
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" />
                        {format(new Date(report.createdAt), "MMM d, yyyy")}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={(e) => handleDeleteReport(e, report.id)}
                    disabled={deletingId === report.id}
                    className="p-1.5 rounded-lg hover:bg-severity-high/10 text-text-faint hover:text-severity-high transition-colors"
                  >
                    {deletingId === report.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                  </button>
                  <ChevronRight className="w-5 h-5 text-text-faint" />
                </div>
              </GlassCard>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
