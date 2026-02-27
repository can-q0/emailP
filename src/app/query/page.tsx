"use client";

import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect, useCallback, useRef, Suspense } from "react";
import { Navbar } from "@/components/navbar";
import { QueryBuilder } from "@/components/query-builder/query-builder";
import { PatientSelector } from "@/components/query-builder/patient-selector";
import { defaultQueryTemplate } from "@/config/query-templates";
import { QueryValues, PatientCandidate } from "@/types";
import { Loader2, AlertTriangle, RotateCcw, SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";

function QueryPageContent() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const patientName = searchParams.get("patient") || "";

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

  // Counter to force QueryBuilder remount when returning to query step
  const [queryKey, setQueryKey] = useState(0);

  // Store query values for use after disambiguation
  const queryValuesRef = useRef<QueryValues>({});

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/auth/signin");
  }, [status, router]);

  const handleQuerySubmit = useCallback(
    async (values: QueryValues) => {
      setStep("searching");
      setProgress("Searching Gmail...");
      queryValuesRef.current = values;

      try {
        // Build Gmail query (just patient name)
        const query = values.patientName || patientName;

        // Sync emails
        setProgress("Syncing emails...");
        const syncRes = await fetch("/api/gmail/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query,
            patientName: values.patientName || patientName,
          }),
        });

        if (!syncRes.ok) throw new Error("Failed to sync emails");
        const syncData = await syncRes.json();

        if (syncData.total === 0) {
          setStep("no_results");
          return;
        }

        // Check for disambiguation
        setProgress("Checking patient records...");
        const emailIds = syncData.emails.map((e: { id: string }) => e.id);

        const disambRes = await fetch("/api/patients/disambiguate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            patientName: values.patientName || patientName,
            emailIds,
          }),
        });

        const disambData = await disambRes.json();

        if (disambData.needsDisambiguation) {
          setCandidates(disambData.candidates);
          setStep("disambiguate");
          return;
        }

        // Generate report directly
        const patId = disambData.candidates[0]?.id;
        if (!patId) {
          setProgress("Could not find patient. Please try again.");
          setTimeout(() => setStep("query"), 2000);
          return;
        }
        if (values.reportType === "plain PDF") {
          await generatePlainPdf(patId, emailIds, values.patientName || patientName);
        } else {
          await generateReport(
            patId,
            emailIds,
            values.patientName || patientName,
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
    [patientName, router]
  );

  const handlePatientSelect = useCallback(
    async (candidate: PatientCandidate) => {
      // If candidate doesn't have an ID yet, create the patient
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

      // Get all email IDs for this patient
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
      // Poll for completion
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

        if (report.status === "completed" || report.status === "failed" || report.status === "no_results") {
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
    // Delete the failed report, then retry
    await fetch(`/api/reports?id=${failedReport.reportId}`, { method: "DELETE" });
    const { patientId, emailIds, patientName: name, reportType, format } = failedReport;
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

      <div className="max-w-4xl mx-auto px-6 py-16">
        {step === "query" && (
          <>
            <div className="text-center mb-12">
              <h1 className="text-2xl font-bold mb-2">Build Your Query</h1>
              <p className="text-text-secondary">
                Fill in the blanks to search for patient emails
              </p>
            </div>
            <QueryBuilder
              key={queryKey}
              template={defaultQueryTemplate}
              initialValues={patientName ? { patientName } : undefined}
              onSubmit={handleQuerySubmit}
            />
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
            <h2 className="text-xl font-bold mb-2">Report Generation Failed</h2>
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
              No laboratory test results were found for this patient. Make sure the patient name matches the name in the lab report emails.
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
