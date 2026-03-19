"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { Navbar } from "@/components/navbar";
import { GlassCard } from "@/components/ui/glass-card";
import { Button } from "@/components/ui/button";
import { PageTransition } from "@/components/ui/page-transition";
import { SkeletonCard } from "@/components/ui/skeleton";
import {
  Users,
  Search,
  Loader2,
  Trash2,
  Pencil,
  Check,
  X,
  Merge,
  Mail,
  FileText,
  ArrowUpDown,
  AlertTriangle,
  Activity,
  Calendar,
  MoreVertical,
  Plus,
  BarChart3,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";

// ── Types ────────────────────────────────────────────────

interface AbnormalMetric {
  name: string;
  value: number;
  unit: string;
  refMin: number | null;
  refMax: number | null;
}

interface SparklineData {
  name: string;
  values: number[];
  unit: string;
  refMin: number | null;
  refMax: number | null;
  isAbnormal: boolean;
}

interface PatientItem {
  id: string;
  name: string;
  governmentId: string | null;
  email: string | null;
  birthYear: number | null;
  gender: string | null;
  emailCount: number;
  reportCount: number;
  metricCount: number;
  lastEmailDate: string | null;
  abnormalMetrics: AbnormalMetric[];
  sparklines: SparklineData[];
}

interface DuplicatePair {
  patientA: { id: string; name: string; governmentId: string | null; emailCount: number };
  patientB: { id: string; name: string; governmentId: string | null; emailCount: number };
  similarity: number;
  reason: string;
}

type SortKey = "name-asc" | "name-desc" | "emails" | "updated";

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "updated", label: "Last Updated" },
  { value: "name-asc", label: "Name A-Z" },
  { value: "name-desc", label: "Name Z-A" },
  { value: "emails", label: "Most Emails" },
];

// ── Helper Components ────────────────────────────────────

function InitialsAvatar({ name, className, onClick }: { name: string; className?: string; onClick?: () => void }) {
  const initials = name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toLocaleUpperCase("tr-TR"))
    .join("");
  return (
    <div
      onClick={onClick}
      className={cn(
        "w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center text-sm font-semibold text-primary shrink-0",
        className
      )}
    >
      {initials}
    </div>
  );
}

function maskGovernmentId(govId: string | null): string | null {
  if (!govId) return null;
  if (govId.startsWith("pending_")) return null;
  if (govId.length === 11) {
    return `${govId.slice(0, 3)}${"•".repeat(5)}${govId.slice(8)}`;
  }
  return govId;
}

function formatGender(gender: string | null): string | null {
  if (!gender) return null;
  if (gender === "Male") return "M";
  if (gender === "Female") return "F";
  return gender;
}

/** Mini SVG sparkline — no external dependency */
function Sparkline({ data, isAbnormal }: { data: SparklineData; isAbnormal?: boolean }) {
  const { values, refMin, refMax } = data;
  if (values.length < 2) return null;

  const width = 64;
  const height = 24;
  const padding = 2;

  const allValues = [...values];
  if (refMin != null) allValues.push(refMin);
  if (refMax != null) allValues.push(refMax);

  const min = Math.min(...allValues);
  const max = Math.max(...allValues);
  const range = max - min || 1;

  const points = values.map((v, i) => {
    const x = padding + (i / (values.length - 1)) * (width - padding * 2);
    const y = padding + (1 - (v - min) / range) * (height - padding * 2);
    return `${x},${y}`;
  });

  const lastValue = values[values.length - 1];
  const lastX = padding + ((values.length - 1) / (values.length - 1)) * (width - padding * 2);
  const lastY = padding + (1 - (lastValue - min) / range) * (height - padding * 2);
  const strokeColor = isAbnormal ? "var(--color-severity-high)" : "var(--color-primary)";

  return (
    <div className="flex items-center gap-1.5">
      <svg width={width} height={height} className="shrink-0">
        {/* Reference range band */}
        {refMin != null && refMax != null && (
          <rect
            x={padding}
            y={padding + (1 - (refMax - min) / range) * (height - padding * 2)}
            width={width - padding * 2}
            height={Math.max(((refMax - refMin) / range) * (height - padding * 2), 1)}
            fill="var(--color-severity-low)"
            opacity={0.15}
            rx={1}
          />
        )}
        <polyline
          points={points.join(" ")}
          fill="none"
          stroke={strokeColor}
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Last value dot */}
        <circle cx={lastX} cy={lastY} r={2} fill={strokeColor} />
      </svg>
      <div className="text-[10px] leading-tight">
        <span className={cn("font-medium", isAbnormal ? "text-severity-high" : "text-foreground")}>
          {lastValue}
        </span>
        <span className="text-text-muted ml-0.5">{data.unit}</span>
      </div>
    </div>
  );
}

// ── Main Component ───────────────────────────────────────

export default function PatientsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [patients, setPatients] = useState<PatientItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortKey>("updated");
  const [showSortMenu, setShowSortMenu] = useState(false);

  // Duplicates
  const [duplicates, setDuplicates] = useState<DuplicatePair[]>([]);
  const [dismissedDuplicates, setDismissedDuplicates] = useState<Set<string>>(new Set());
  const [mergingDuplicate, setMergingDuplicate] = useState(false);

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editGovId, setEditGovId] = useState("");

  // Delete modal state
  const [deleteTarget, setDeleteTarget] = useState<PatientItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Merge modal state
  const [showMergeModal, setShowMergeModal] = useState(false);
  const [mergeSource, setMergeSource] = useState<PatientItem | null>(null);
  const [mergeTargetId, setMergeTargetId] = useState("");
  const [merging, setMerging] = useState(false);

  // Action menu state (mobile)
  const [actionMenuId, setActionMenuId] = useState<string | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/auth/signin");
  }, [status, router]);

  const fetchPatients = useCallback(
    async (q = "", sort: SortKey = "updated") => {
      const params = new URLSearchParams();
      if (q) params.set("q", q);
      if (sort !== "updated") params.set("sort", sort);
      const url = `/api/patients${params.toString() ? `?${params}` : ""}`;
      const res = await fetch(url);
      const data = await res.json();
      setPatients(data);
      setLoading(false);
    },
    []
  );

  const fetchDuplicates = useCallback(async () => {
    try {
      const res = await fetch("/api/patients/duplicates");
      if (res.ok) {
        const data = await res.json();
        setDuplicates(data);
      }
    } catch {
      // Silently fail — duplicates are non-critical
    }
  }, []);

  useEffect(() => {
    if (!session) return;
    fetchPatients("", sortBy);
    fetchDuplicates();
  }, [session, fetchPatients, fetchDuplicates, sortBy]);

  useEffect(() => {
    if (!session) return;
    const timer = setTimeout(() => fetchPatients(searchQuery, sortBy), 300);
    return () => clearTimeout(timer);
  }, [searchQuery, session, fetchPatients, sortBy]);

  // Close menus on outside click
  useEffect(() => {
    const handler = () => {
      setShowSortMenu(false);
      setActionMenuId(null);
    };
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, []);

  const startEdit = (p: PatientItem) => {
    setEditingId(p.id);
    setEditName(p.name);
    setEditGovId(p.governmentId?.startsWith("pending_") ? "" : p.governmentId || "");
    setActionMenuId(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditName("");
    setEditGovId("");
  };

  const saveEdit = async (id: string) => {
    const res = await fetch(`/api/patients?id=${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: editName, governmentId: editGovId || undefined }),
    });
    if (res.ok) {
      setPatients((prev) =>
        prev.map((p) =>
          p.id === id ? { ...p, name: editName, governmentId: editGovId || null } : p
        )
      );
      toast.success("Patient updated.");
    }
    cancelEdit();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/patients?id=${deleteTarget.id}`, { method: "DELETE" });
      if (res.ok) {
        setPatients((prev) => prev.filter((p) => p.id !== deleteTarget.id));
        toast.success("Patient deleted.");
      }
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  };

  const openMerge = (source: PatientItem) => {
    setMergeSource(source);
    setMergeTargetId("");
    setShowMergeModal(true);
    setActionMenuId(null);
  };

  const handleMerge = async () => {
    if (!mergeSource || !mergeTargetId) return;
    setMerging(true);
    try {
      const res = await fetch("/api/patients/merge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourcePatientId: mergeSource.id,
          targetPatientId: mergeTargetId,
        }),
      });
      if (res.ok) {
        setShowMergeModal(false);
        setMergeSource(null);
        toast.success("Patients merged.");
        fetchPatients(searchQuery, sortBy);
        fetchDuplicates();
      }
    } finally {
      setMerging(false);
    }
  };

  const handleDuplicateMerge = async (dup: DuplicatePair) => {
    // Merge the patient with fewer emails into the one with more
    const source = dup.patientA.emailCount <= dup.patientB.emailCount ? dup.patientA : dup.patientB;
    const target = source === dup.patientA ? dup.patientB : dup.patientA;

    setMergingDuplicate(true);
    try {
      const res = await fetch("/api/patients/merge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourcePatientId: source.id,
          targetPatientId: target.id,
        }),
      });
      if (res.ok) {
        toast.success(`Merged "${source.name}" into "${target.name}"`);
        fetchPatients(searchQuery, sortBy);
        fetchDuplicates();
      }
    } finally {
      setMergingDuplicate(false);
    }
  };

  const dismissDuplicate = (dup: DuplicatePair) => {
    const key = [dup.patientA.id, dup.patientB.id].sort().join(":");
    setDismissedDuplicates((prev) => new Set(prev).add(key));
  };

  if (status === "loading" || !session) {
    return (
      <div className="min-h-screen">
        <Navbar />
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12 space-y-3">
          {[0, 1, 2, 3].map((i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      </div>
    );
  }

  const mergeTargets = patients.filter((p) => p.id !== mergeSource?.id);
  const totalPatients = patients.length;
  const totalEmails = patients.reduce((sum, p) => sum + p.emailCount, 0);
  const totalReports = patients.reduce((sum, p) => sum + p.reportCount, 0);

  const visibleDuplicates = duplicates.filter((d) => {
    const key = [d.patientA.id, d.patientB.id].sort().join(":");
    return !dismissedDuplicates.has(key);
  });

  return (
    <div className="min-h-screen">
      <Navbar />

      <PageTransition className="max-w-4xl mx-auto px-4 sm:px-6 py-12">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">Patients</h1>
            {!loading && totalPatients > 0 && (
              <p className="text-sm text-text-muted mt-1">
                {totalPatients} patients · {totalEmails} emails · {totalReports} reports
              </p>
            )}
          </div>
        </div>

        {/* Duplicate Detection Banner */}
        <AnimatePresence>
          {visibleDuplicates.length > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-6 space-y-2"
            >
              {visibleDuplicates.slice(0, 3).map((dup, i) => {
                const key = [dup.patientA.id, dup.patientB.id].sort().join(":");
                return (
                  <motion.div
                    key={key}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.1 }}
                  >
                    <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-severity-medium/30 bg-severity-medium/5">
                      <AlertTriangle className="w-4 h-4 text-severity-medium shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm">
                          <strong>{dup.patientA.name}</strong>
                          {" and "}
                          <strong>{dup.patientB.name}</strong>
                          <span className="text-text-muted"> — {dup.reason} ({Math.round(dup.similarity * 100)}%)</span>
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => handleDuplicateMerge(dup)}
                          disabled={mergingDuplicate}
                        >
                          {mergingDuplicate ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Merge className="w-3.5 h-3.5 mr-1" />}
                          Merge
                        </Button>
                        <button
                          onClick={() => dismissDuplicate(dup)}
                          className="p-1 rounded-lg hover:bg-card-hover text-text-muted"
                          title="Dismiss"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
              {visibleDuplicates.length > 3 && (
                <p className="text-xs text-text-muted pl-4">
                  + {visibleDuplicates.length - 3} more possible duplicates
                </p>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Search + Sort */}
        <div className="flex gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
            <input
              type="text"
              placeholder="Search patients..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-card-border bg-card text-foreground placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
          <div className="relative">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowSortMenu((prev) => !prev);
              }}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-card-border bg-card text-foreground hover:bg-card-hover transition-colors"
            >
              <ArrowUpDown className="w-4 h-4 text-text-muted" />
              <span className="hidden sm:inline text-sm">
                {SORT_OPTIONS.find((o) => o.value === sortBy)?.label}
              </span>
            </button>
            <AnimatePresence>
              {showSortMenu && (
                <motion.div
                  initial={{ opacity: 0, y: 4, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 4, scale: 0.95 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 top-full mt-2 w-44 bg-card border border-card-border rounded-xl shadow-lg overflow-hidden z-30"
                  onClick={(e) => e.stopPropagation()}
                >
                  {SORT_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => {
                        setSortBy(option.value);
                        setShowSortMenu(false);
                      }}
                      className={cn(
                        "w-full text-left px-4 py-2.5 text-sm transition-colors",
                        sortBy === option.value
                          ? "bg-primary/10 text-primary font-medium"
                          : "text-foreground hover:bg-card-hover"
                      )}
                    >
                      {option.label}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Patient List */}
        {loading ? (
          <div className="space-y-3">
            {[0, 1, 2, 3].map((i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : patients.length === 0 ? (
          <GlassCard className="p-12 text-center">
            <div className="animate-float">
              <Users className="w-12 h-12 text-text-faint mx-auto mb-4" />
            </div>
            <h3 className="font-semibold mb-2">No patients found</h3>
            <p className="text-sm text-text-secondary mb-4">
              {searchQuery
                ? "Try a different search term."
                : "Patients are created when you generate reports."}
            </p>
            {!searchQuery && (
              <Button size="sm" onClick={() => router.push("/dashboard")}>
                <Plus className="w-4 h-4 mr-2" />
                Generate First Report
              </Button>
            )}
          </GlassCard>
        ) : (
          <div className="space-y-3">
            {patients.map((patient, i) => (
              <motion.div
                key={patient.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04, duration: 0.3 }}
                layout
              >
                <GlassCard className="p-5 transition-all hover:border-primary/20">
                  <div className="flex items-start gap-4">
                    <InitialsAvatar
                      name={patient.name}
                      className="cursor-pointer"
                      onClick={() => router.push(`/patients/${patient.id}`)}
                    />

                    {editingId === patient.id ? (
                      <div className="flex-1 flex flex-wrap items-center gap-2">
                        <input
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="flex-1 min-w-[140px] px-3 py-1.5 rounded-lg border border-card-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                          placeholder="Name"
                          autoFocus
                        />
                        <input
                          type="text"
                          value={editGovId}
                          onChange={(e) => setEditGovId(e.target.value)}
                          className="w-36 px-3 py-1.5 rounded-lg border border-card-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                          placeholder="TC Kimlik No"
                        />
                        <div className="flex gap-1">
                          <button
                            onClick={() => saveEdit(patient.id)}
                            className="p-1.5 rounded-lg hover:bg-severity-low/10 text-severity-low"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                          <button
                            onClick={cancelEdit}
                            className="p-1.5 rounded-lg hover:bg-card-hover text-text-muted"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex-1 min-w-0">
                          {/* Row 1: Name + demographics */}
                          <h3
                            className="font-semibold truncate cursor-pointer hover:text-primary transition-colors"
                            onClick={() => router.push(`/patients/${patient.id}`)}
                          >
                            {patient.name}
                          </h3>
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-text-muted mt-1">
                            {maskGovernmentId(patient.governmentId) && (
                              <span className="font-mono">
                                TC: {maskGovernmentId(patient.governmentId)}
                              </span>
                            )}
                            {patient.gender && (
                              <span>{formatGender(patient.gender)}</span>
                            )}
                            {patient.birthYear && (
                              <span>b.{patient.birthYear}</span>
                            )}
                          </div>

                          {/* Row 2: Stats */}
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-text-muted mt-2">
                            <span className="flex items-center gap-1">
                              <Mail className="w-3.5 h-3.5" />
                              {patient.emailCount}
                            </span>
                            <span className="flex items-center gap-1">
                              <FileText className="w-3.5 h-3.5" />
                              {patient.reportCount}
                            </span>
                            <span className="flex items-center gap-1">
                              <Activity className="w-3.5 h-3.5" />
                              {patient.metricCount}
                            </span>
                            {patient.lastEmailDate && (
                              <span className="flex items-center gap-1">
                                <Calendar className="w-3.5 h-3.5" />
                                {formatDistanceToNow(new Date(patient.lastEmailDate), {
                                  addSuffix: true,
                                })}
                              </span>
                            )}
                          </div>

                          {/* Row 3: Sparklines */}
                          {patient.sparklines.length > 0 && (
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2">
                              {patient.sparklines.map((spark) => (
                                <div key={spark.name} className="flex items-center gap-1.5">
                                  <span className="text-[10px] text-text-muted font-medium w-14 truncate">
                                    {spark.name}
                                  </span>
                                  <Sparkline data={spark} isAbnormal={spark.isAbnormal} />
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Row 4: Abnormal metrics badges */}
                          {patient.abnormalMetrics.length > 0 && patient.sparklines.length === 0 && (
                            <div className="flex flex-wrap gap-1.5 mt-2">
                              {patient.abnormalMetrics.map((m, idx) => (
                                <span
                                  key={idx}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-severity-high/10 text-severity-high text-xs font-medium"
                                >
                                  <AlertTriangle className="w-3 h-3" />
                                  {m.name} {m.value}{m.unit}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Actions: desktop inline, mobile kebab */}
                        <div className="relative shrink-0">
                          {/* Desktop actions */}
                          <div className="hidden sm:flex items-center gap-1">
                            <button
                              onClick={() =>
                                router.push(
                                  `/dashboard?patient=${encodeURIComponent(patient.name)}`
                                )
                              }
                              className="p-1.5 rounded-lg hover:bg-primary/10 text-text-faint hover:text-primary transition-colors"
                              title="Generate report"
                            >
                              <BarChart3 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => openMerge(patient)}
                              className="p-1.5 rounded-lg hover:bg-card-hover text-text-faint hover:text-text-secondary transition-colors"
                              title="Merge into another patient"
                            >
                              <Merge className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => startEdit(patient)}
                              className="p-1.5 rounded-lg hover:bg-card-hover text-text-faint hover:text-text-secondary transition-colors"
                              title="Edit patient"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => {
                                setDeleteTarget(patient);
                                setActionMenuId(null);
                              }}
                              className="p-1.5 rounded-lg hover:bg-severity-high/10 text-text-faint hover:text-severity-high transition-colors"
                              title="Delete patient"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>

                          {/* Mobile kebab menu */}
                          <div className="sm:hidden">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setActionMenuId(
                                  actionMenuId === patient.id ? null : patient.id
                                );
                              }}
                              className="p-2 rounded-lg hover:bg-card-hover text-text-muted"
                            >
                              <MoreVertical className="w-5 h-5" />
                            </button>
                            <AnimatePresence>
                              {actionMenuId === patient.id && (
                                <motion.div
                                  initial={{ opacity: 0, scale: 0.95 }}
                                  animate={{ opacity: 1, scale: 1 }}
                                  exit={{ opacity: 0, scale: 0.95 }}
                                  transition={{ duration: 0.12 }}
                                  className="absolute right-0 top-full mt-1 w-44 bg-card border border-card-border rounded-xl shadow-lg overflow-hidden z-20"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <button
                                    onClick={() => {
                                      setActionMenuId(null);
                                      router.push(
                                        `/dashboard?patient=${encodeURIComponent(patient.name)}`
                                      );
                                    }}
                                    className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-primary hover:bg-primary/5"
                                  >
                                    <BarChart3 className="w-4 h-4" /> Generate Report
                                  </button>
                                  <button
                                    onClick={() => startEdit(patient)}
                                    className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-foreground hover:bg-card-hover"
                                  >
                                    <Pencil className="w-4 h-4" /> Edit
                                  </button>
                                  <button
                                    onClick={() => openMerge(patient)}
                                    className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-foreground hover:bg-card-hover"
                                  >
                                    <Merge className="w-4 h-4" /> Merge
                                  </button>
                                  <button
                                    onClick={() => {
                                      setDeleteTarget(patient);
                                      setActionMenuId(null);
                                    }}
                                    className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-severity-high hover:bg-severity-high/10"
                                  >
                                    <Trash2 className="w-4 h-4" /> Delete
                                  </button>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </GlassCard>
              </motion.div>
            ))}
          </div>
        )}
      </PageTransition>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {deleteTarget && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm"
            onClick={() => !deleting && setDeleteTarget(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 8 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="bg-card border border-card-border rounded-2xl shadow-xl w-full max-w-sm p-6 mx-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2.5 rounded-xl bg-severity-high/10">
                  <AlertTriangle className="w-5 h-5 text-severity-high" />
                </div>
                <h2 className="text-lg font-semibold">Delete Patient</h2>
              </div>
              <p className="text-sm text-text-secondary mb-2">
                Are you sure you want to delete <strong>{deleteTarget.name}</strong>?
              </p>
              <p className="text-xs text-text-muted mb-5">
                {deleteTarget.reportCount} reports and {deleteTarget.metricCount} metrics will
                be permanently removed. Emails will be preserved but unlinked.
              </p>
              <div className="flex justify-end gap-3">
                <Button
                  variant="ghost"
                  onClick={() => setDeleteTarget(null)}
                  disabled={deleting}
                >
                  Cancel
                </Button>
                <Button variant="danger" onClick={handleDelete} disabled={deleting}>
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

      {/* Merge Modal */}
      <AnimatePresence>
        {showMergeModal && mergeSource && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm"
            onClick={() => setShowMergeModal(false)}
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
                <h2 className="text-lg font-semibold">Merge Patient</h2>
                <button
                  onClick={() => setShowMergeModal(false)}
                  className="p-1 rounded-lg hover:bg-secondary/50 text-text-muted"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <p className="text-sm text-text-secondary mb-4">
                Merge <strong>{mergeSource.name}</strong> into another patient. All emails,
                reports, and metrics will be moved to the target.
              </p>
              <select
                value={mergeTargetId}
                onChange={(e) => setMergeTargetId(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-card-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 mb-4"
              >
                <option value="">Select target patient...</option>
                {mergeTargets.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} {p.governmentId && !p.governmentId.startsWith("pending_") ? `(${p.governmentId})` : ""}
                  </option>
                ))}
              </select>
              <div className="flex justify-end gap-3">
                <Button variant="ghost" onClick={() => setShowMergeModal(false)}>
                  Cancel
                </Button>
                <Button onClick={handleMerge} disabled={merging || !mergeTargetId}>
                  {merging ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Merge className="w-4 h-4 mr-2" />
                  )}
                  {merging ? "Merging..." : "Merge"}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
