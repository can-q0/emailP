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
} from "lucide-react";
import { cn } from "@/lib/utils";

interface PatientItem {
  id: string;
  name: string;
  governmentId: string | null;
  email: string | null;
  emailCount: number;
  reportCount: number;
}

export default function PatientsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [patients, setPatients] = useState<PatientItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editGovId, setEditGovId] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showMergeModal, setShowMergeModal] = useState(false);
  const [mergeSource, setMergeSource] = useState<PatientItem | null>(null);
  const [mergeTargetId, setMergeTargetId] = useState("");
  const [merging, setMerging] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/auth/signin");
  }, [status, router]);

  const fetchPatients = useCallback(async (q = "") => {
    const url = q ? `/api/patients?q=${encodeURIComponent(q)}` : "/api/patients";
    const res = await fetch(url);
    const data = await res.json();
    setPatients(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!session) return;
    fetchPatients();
  }, [session, fetchPatients]);

  useEffect(() => {
    if (!session) return;
    const timer = setTimeout(() => fetchPatients(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery, session, fetchPatients]);

  const startEdit = (p: PatientItem) => {
    setEditingId(p.id);
    setEditName(p.name);
    setEditGovId(p.governmentId || "");
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

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this patient? Their reports will also be deleted.")) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/patients?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        setPatients((prev) => prev.filter((p) => p.id !== id));
        toast.success("Patient deleted.");
      }
    } finally {
      setDeletingId(null);
    }
  };

  const openMerge = (source: PatientItem) => {
    setMergeSource(source);
    setMergeTargetId("");
    setShowMergeModal(true);
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
        fetchPatients(searchQuery);
      }
    } finally {
      setMerging(false);
    }
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

  return (
    <div className="min-h-screen">
      <Navbar />

      <PageTransition className="max-w-4xl mx-auto px-4 sm:px-6 py-12">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-bold">Patients</h1>
        </div>

        {/* Search */}
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
          <input
            type="text"
            placeholder="Search patients..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-card-border bg-card text-foreground placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>

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
            <p className="text-sm text-text-secondary">
              {searchQuery
                ? "Try a different search term."
                : "Patients are created when you generate reports."}
            </p>
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
                <GlassCard className="p-5">
                  <div className="flex items-center gap-4">
                    <div className="p-2.5 rounded-xl bg-primary/10">
                      <Users className="w-5 h-5 text-primary" />
                    </div>

                    {editingId === patient.id ? (
                      <div className="flex-1 flex items-center gap-2">
                        <input
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="flex-1 px-3 py-1.5 rounded-lg border border-card-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                          placeholder="Name"
                          autoFocus
                        />
                        <input
                          type="text"
                          value={editGovId}
                          onChange={(e) => setEditGovId(e.target.value)}
                          className="w-40 px-3 py-1.5 rounded-lg border border-card-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                          placeholder="Gov ID"
                        />
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
                    ) : (
                      <>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold truncate">{patient.name}</h3>
                          <div className="flex items-center gap-3 text-sm text-text-muted mt-1">
                            {patient.governmentId && (
                              <span>TC: {patient.governmentId}</span>
                            )}
                            <span className="flex items-center gap-1">
                              <Mail className="w-3.5 h-3.5" />
                              {patient.emailCount} emails
                            </span>
                            <span className="flex items-center gap-1">
                              <FileText className="w-3.5 h-3.5" />
                              {patient.reportCount} reports
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1">
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
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(patient.id)}
                            disabled={deletingId === patient.id}
                            className="p-1.5 rounded-lg hover:bg-severity-high/10 text-text-faint hover:text-severity-high transition-colors"
                          >
                            {deletingId === patient.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Trash2 className="w-4 h-4" />
                            )}
                          </button>
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
                    {p.name} {p.governmentId ? `(${p.governmentId})` : ""}
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
