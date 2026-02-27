"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState, useEffect, useCallback, useRef } from "react";
import { Navbar } from "@/components/navbar";
import { GlassCard } from "@/components/ui/glass-card";
import { Button } from "@/components/ui/button";
import { QueryBuilder } from "@/components/query-builder/query-builder";
import { PatientSelector } from "@/components/query-builder/patient-selector";
import { defaultQueryTemplate } from "@/config/query-templates";
import { QueryValues, PatientCandidate } from "@/types";
import {
  FileText,
  Clock,
  Loader2,
  AlertTriangle,
  RotateCcw,
  SearchX,
  Users,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { GmailReconnectBanner } from "@/components/gmail-reconnect-banner";

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [step, setStep] = useState<
    "query" | "searching" | "disambiguate" | "generating" | "failed" | "no_results"
  >("query");
  const [candidates, setCandidates] = useState<PatientCandidate[]>([]);
  const [progress, setProgress] = useState("");
  const [failedReport, setFailedReport] = useState<{
    reportId: string;
    patientId: string;
    emailIds: string[];
    patientName: string;
    reportType?: string;
    format?: string;
    errorMessage: string;
  } | null>(null);

  const [queryKey, setQueryKey] = useState(0);
  const [tokenExpired, setTokenExpired] = useState(false);
  const queryValuesRef = useRef<QueryValues>({});

  interface RecentReport {
    id: string;
    title: string;
    status: string;
    createdAt: string;
    patient: { id: string; name: string };
  }
  const [recentReports, setRecentReports] = useState<RecentReport[]>([]);

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/auth/signin");
  }, [status, router]);

  useEffect(() => {
    if (status === "authenticated") {
      fetch("/api/reports?limit=5")
        .then((r) => r.json())
        .then((data) => { if (Array.isArray(data)) setRecentReports(data); })
        .catch(() => {});
    }
  }, [status]);

  const handleQuerySubmit = useCallback(
    async (values: QueryValues) => {
      setStep("searching");
      setProgress("Searching Gmail...");
      queryValuesRef.current = values;

      try {
        const query = values.patientName;

        setProgress("Syncing emails...");
        const syncRes = await fetch("/api/gmail/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query,
            patientName: values.patientName,
          }),
        });

        const syncData = await syncRes.json();
        if (syncData.error === "gmail_token_expired") {
          setTokenExpired(true);
          setStep("query");
          return;
        }
        if (!syncRes.ok) throw new Error("Failed to sync emails");

        if (syncData.total === 0) {
          setStep("no_results");
          return;
        }

        setProgress("Checking patient records...");
        const emailIds = syncData.emails.map((e: { id: string }) => e.id);

        const disambRes = await fetch("/api/patients/disambiguate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            patientName: values.patientName,
            emailIds,
          }),
        });

        const disambData = await disambRes.json();

        if (disambData.needsDisambiguation) {
          setCandidates(disambData.candidates);
          setStep("disambiguate");
          return;
        }

        const patId = disambData.candidates[0]?.id;
        if (!patId) {
          setProgress("Could not find patient. Please try again.");
          setTimeout(() => setStep("query"), 2000);
          return;
        }
        if (values.reportType === "plain PDF") {
          await generatePlainPdf(patId, emailIds, values.patientName!);
        } else {
          await generateReport(
            patId,
            emailIds,
            values.patientName!,
            values.reportType,
            values.format
          );
        }
      } catch (error) {
        console.error("Query error:", error);
        setProgress("An error occurred. Please try again.");
        setTimeout(() => setStep("query"), 2000);
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
          body: JSON.stringify({
            patientName: candidate.name,
            governmentId: candidate.governmentId,
            create: true,
          }),
        });
        const data = await res.json();
        patientId = data.candidates?.[0]?.id || candidate.id;
      }

      const syncRes = await fetch("/api/gmail/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: candidate.name,
          patientName: candidate.name,
        }),
      });
      const syncData = await syncRes.json();
      const emailIds = syncData.emails?.map((e: { id: string }) => e.id) || [];

      if (queryValuesRef.current.reportType === "plain PDF") {
        await generatePlainPdf(patientId, emailIds, candidate.name);
      } else {
        await generateReport(
          patientId,
          emailIds,
          candidate.name,
          queryValuesRef.current.reportType,
          queryValuesRef.current.format
        );
      }
    },
    [router]
  );

  const generatePlainPdf = async (
    patientId: string,
    emailIds: string[],
    name: string
  ) => {
    setStep("generating");
    setProgress("Fetching & merging PDF attachments...");

    try {
      const res = await fetch("/api/reports/plain-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientId,
          emailIds,
          title: `Plain PDF - ${name}`,
        }),
      });

      const data = await res.json();

      if (data.reportId) {
        // Poll for completion
        const pollInterval = setInterval(async () => {
          const statusRes = await fetch(`/api/reports?id=${data.reportId}`);
          const report = await statusRes.json();

          if (report.status === "completed") {
            clearInterval(pollInterval);
            router.push(`/report/${data.reportId}`);
          } else if (report.status === "failed" || report.status === "no_results") {
            clearInterval(pollInterval);
            if (report.status === "no_results") {
              setStep("no_results");
            } else {
              setProgress("Failed to merge PDFs. Please try again.");
              setTimeout(() => setStep("query"), 2000);
            }
          }
        }, 1500);
      } else {
        setProgress("Failed to create report.");
        setTimeout(() => setStep("query"), 2000);
      }
    } catch (error) {
      console.error("Plain PDF error:", error);
      setProgress("An error occurred. Please try again.");
      setTimeout(() => setStep("query"), 2000);
    }
  };

  const generateReport = async (
    patientId: string,
    emailIds: string[],
    name: string,
    reportType?: string,
    format?: string
  ) => {
    setStep("generating");
    setProgress("Step 1/2: Extracting blood metrics...");

    const res = await fetch("/api/ai/generate-report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        patientId,
        emailIds,
        title: `Report for ${name}`,
        reportType,
        format,
      }),
    });

    const data = await res.json();

    if (data.reportId) {
      const pollInterval = setInterval(async () => {
        const statusRes = await fetch(`/api/reports?id=${data.reportId}`);
        const report = await statusRes.json();

        if (report.step) {
          const steps: Record<string, string> = {
            extracting_metrics: "Step 1/2: Extracting blood metrics...",
            generating_summary: "Step 2/2: Generating summary & analysis...",
          };
          setProgress(steps[report.step] || report.step);
        }

        if (
          report.status === "completed" ||
          report.status === "failed" ||
          report.status === "no_results"
        ) {
          clearInterval(pollInterval);
          if (report.status === "completed") {
            router.push(`/report/${data.reportId}`);
          } else if (report.status === "no_results") {
            setStep("no_results");
          } else {
            setFailedReport({
              reportId: data.reportId,
              patientId,
              emailIds,
              patientName: name,
              reportType,
              format,
              errorMessage: report.step || "An unexpected error occurred.",
            });
            setStep("failed");
          }
        }
      }, 2000);
    }
  };

  const handleRetry = async () => {
    if (!failedReport) return;
    await fetch(`/api/reports?id=${failedReport.reportId}`, {
      method: "DELETE",
    });
    const {
      patientId,
      emailIds,
      patientName: name,
      reportType,
      format,
    } = failedReport;
    setFailedReport(null);
    await generateReport(patientId, emailIds, name, reportType, format);
  };

  const handleStartOver = () => {
    setFailedReport(null);
    setStep("query");
    setProgress("");
    setQueryKey((k) => k + 1);
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
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-16">
        {step === "query" && (
          <>
            {tokenExpired && <GmailReconnectBanner />}

            {/* Welcome */}
            <div className="mb-12">
              <h1 className="text-2xl sm:text-3xl font-bold mb-2">
                Welcome back, {session.user?.name?.split(" ")[0]}
              </h1>
              <p className="text-text-secondary">
                Fill in the blanks below to generate a report.
              </p>
            </div>

            {/* Query Builder */}
            <div className="mb-12">
              <QueryBuilder
                key={queryKey}
                template={defaultQueryTemplate}
                onSubmit={handleQuerySubmit}
              />
            </div>

            {/* Quick actions */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
              <GlassCard
                className="p-6 cursor-pointer"
                hover
                onClick={() => router.push("/report")}
              >
                <div className="flex items-start gap-4">
                  <div className="p-2.5 rounded-xl bg-primary/10">
                    <FileText className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold mb-1">View Reports</h3>
                    <p className="text-sm text-text-secondary">
                      Browse your previously generated patient reports.
                    </p>
                  </div>
                </div>
              </GlassCard>
              <GlassCard
                className="p-6 cursor-pointer"
                hover
                onClick={() => router.push("/batch")}
              >
                <div className="flex items-start gap-4">
                  <div className="p-2.5 rounded-xl bg-severity-medium/10">
                    <Users className="w-5 h-5 text-severity-medium" />
                  </div>
                  <div>
                    <h3 className="font-semibold mb-1">Batch Reports</h3>
                    <p className="text-sm text-text-secondary">
                      Generate reports for multiple patients at once.
                    </p>
                  </div>
                </div>
              </GlassCard>
              <GlassCard
                className="p-6 cursor-pointer"
                hover
                onClick={() => router.push("/report")}
              >
                <div className="flex items-start gap-4">
                  <div className="p-2.5 rounded-xl bg-severity-low/10">
                    <Clock className="w-5 h-5 text-severity-low" />
                  </div>
                  <div>
                    <h3 className="font-semibold mb-1">Recent Activity</h3>
                    <p className="text-sm text-text-secondary">
                      {recentReports.length > 0
                        ? `${recentReports.length} recent report${recentReports.length !== 1 ? "s" : ""}`
                        : "No reports yet"}
                    </p>
                  </div>
                </div>
              </GlassCard>
            </div>

            {/* Recent Reports */}
            {recentReports.length > 0 && (
              <GlassCard className="p-6">
                <h3 className="font-semibold mb-4">Recent Reports</h3>
                <div className="space-y-3">
                  {recentReports.map((r) => (
                    <div
                      key={r.id}
                      onClick={() => router.push(`/report/${r.id}`)}
                      className="flex items-center gap-3 p-3 rounded-xl hover:bg-secondary/30 transition-colors cursor-pointer"
                    >
                      <span
                        className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                          r.status === "completed"
                            ? "bg-severity-low"
                            : r.status === "processing"
                            ? "bg-severity-medium"
                            : r.status === "failed"
                            ? "bg-severity-high"
                            : "bg-text-muted"
                        }`}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {r.title}
                        </p>
                        <p className="text-xs text-text-muted">
                          {r.patient.name}
                        </p>
                      </div>
                      <span className="text-xs text-text-muted flex-shrink-0">
                        {formatDistanceToNow(new Date(r.createdAt), { addSuffix: true })}
                      </span>
                    </div>
                  ))}
                </div>
              </GlassCard>
            )}
          </>
        )}

        {(step === "searching" || step === "generating") && (
          <div className="flex flex-col items-center justify-center py-24">
            <Loader2 className="w-10 h-10 text-primary animate-spin mb-6" />
            <p className="text-lg font-medium">{progress}</p>
          </div>
        )}

        {step === "failed" && failedReport && (
          <div className="flex flex-col items-center justify-center py-24 max-w-md mx-auto">
            <div className="p-3 rounded-full bg-severity-high/10 mb-6">
              <AlertTriangle className="w-10 h-10 text-severity-high" />
            </div>
            <h2 className="text-xl font-bold mb-2">
              Report Generation Failed
            </h2>
            <p className="text-sm text-text-secondary text-center mb-6">
              {failedReport.errorMessage}
            </p>
            <div className="flex gap-3">
              <Button variant="ghost" onClick={handleStartOver}>
                Start Over
              </Button>
              <Button onClick={handleRetry}>
                <RotateCcw className="w-4 h-4 mr-2" />
                Retry
              </Button>
            </div>
          </div>
        )}

        {step === "no_results" && (
          <div className="flex flex-col items-center justify-center py-24 max-w-md mx-auto">
            <div className="p-3 rounded-full bg-text-muted/10 mb-6">
              <SearchX className="w-10 h-10 text-text-muted" />
            </div>
            <h2 className="text-xl font-bold mb-2">No Lab Reports Found</h2>
            <p className="text-sm text-text-secondary text-center mb-6">
              No laboratory test results were found for this patient. Make sure
              the patient name matches the name in the lab report emails.
            </p>
            <Button variant="ghost" onClick={handleStartOver}>
              Try Another Search
            </Button>
          </div>
        )}

        {step === "disambiguate" && (
          <div className="max-w-xl mx-auto">
            <PatientSelector
              candidates={candidates}
              onSelect={handlePatientSelect}
            />
          </div>
        )}
      </div>
    </div>
  );
}
