"use client";

import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect, useCallback, Suspense } from "react";
import { Navbar } from "@/components/navbar";
import { QueryBuilder } from "@/components/query-builder/query-builder";
import { PatientSelector } from "@/components/query-builder/patient-selector";
import { GlassCard } from "@/components/ui/glass-card";
import { defaultQueryTemplate } from "@/config/query-templates";
import { QueryValues, PatientCandidate } from "@/types";
import { Loader2 } from "lucide-react";

function QueryPageContent() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const patientName = searchParams.get("patient") || "";

  const [step, setStep] = useState<
    "query" | "searching" | "disambiguate" | "generating"
  >("query");
  const [candidates, setCandidates] = useState<PatientCandidate[]>([]);
  const [progress, setProgress] = useState("");

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/auth/signin");
  }, [status, router]);

  const handleQuerySubmit = useCallback(
    async (values: QueryValues) => {
      setStep("searching");
      setProgress("Searching Gmail...");

      try {
        // Build Gmail query
        let query = values.patientName || patientName;
        if (values.dateFrom) query += ` after:${values.dateFrom}`;
        if (values.dateTo) query += ` before:${values.dateTo}`;

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
          setProgress("No emails found. Try a different search.");
          setTimeout(() => setStep("query"), 2000);
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
        await generateReport(
          disambData.candidates[0]?.id || syncData.emails[0]?.patientId,
          emailIds,
          values.patientName || patientName
        );
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

      await generateReport(patientId, emailIds, candidate.name);
    },
    [router]
  );

  const generateReport = async (
    patientId: string,
    emailIds: string[],
    name: string
  ) => {
    setStep("generating");
    setProgress("Generating report...");

    const res = await fetch("/api/ai/generate-report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        patientId,
        emailIds,
        title: `Report for ${name}`,
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
            classifying: "Classifying emails...",
            extracting_metrics: "Extracting blood metrics...",
            generating_summary: "Generating summary...",
            generating_attention_points: "Analyzing attention points...",
          };
          setProgress(steps[report.step] || report.step);
        }

        if (report.status === "completed" || report.status === "failed") {
          clearInterval(pollInterval);
          if (report.status === "completed") {
            router.push(`/report/${data.reportId}`);
          } else {
            setProgress("Report generation failed. Please try again.");
            setTimeout(() => setStep("query"), 3000);
          }
        }
      }, 2000);
    }
  };

  if (status === "loading" || !session) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-sky-accent border-t-transparent rounded-full animate-spin" />
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
              <p className="text-foreground/50">
                Fill in the blanks to search for patient emails
              </p>
            </div>
            <QueryBuilder
              template={defaultQueryTemplate}
              initialValues={patientName ? { patientName } : undefined}
              onSubmit={handleQuerySubmit}
            />
          </>
        )}

        {(step === "searching" || step === "generating") && (
          <div className="flex flex-col items-center justify-center py-24">
            <Loader2 className="w-10 h-10 text-sky-accent animate-spin mb-6" />
            <p className="text-lg font-medium">{progress}</p>
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
          <div className="w-8 h-8 border-2 border-sky-accent border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <QueryPageContent />
    </Suspense>
  );
}
