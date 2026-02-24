"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { Navbar } from "@/components/navbar";
import { GlassCard } from "@/components/ui/glass-card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, FileText, Clock, ArrowRight } from "lucide-react";

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [patientName, setPatientName] = useState("");

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/auth/signin");
  }, [status, router]);

  if (status === "loading" || !session) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-sky-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (patientName.trim()) {
      router.push(`/query?patient=${encodeURIComponent(patientName.trim())}`);
    }
  };

  return (
    <div className="min-h-screen">
      <Navbar />
      <div className="max-w-4xl mx-auto px-6 py-16">
        {/* Welcome */}
        <div className="mb-12">
          <h1 className="text-3xl font-bold mb-2">
            Welcome back, {session.user?.name?.split(" ")[0]}
          </h1>
          <p className="text-foreground/50">
            Search for a patient to generate a new report.
          </p>
        </div>

        {/* Search */}
        <GlassCard className="p-8 mb-12">
          <form onSubmit={handleSearch} className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground/40" />
              <Input
                value={patientName}
                onChange={(e) => setPatientName(e.target.value)}
                placeholder="Enter patient name..."
                className="pl-10"
                autoFocus
              />
            </div>
            <Button type="submit" disabled={!patientName.trim()}>
              <ArrowRight className="w-4 h-4 mr-1" />
              Search
            </Button>
          </form>
        </GlassCard>

        {/* Quick actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <GlassCard
            className="p-6 cursor-pointer"
            hover
            onClick={() => router.push("/report")}
          >
            <div className="flex items-start gap-4">
              <div className="p-2.5 rounded-xl bg-sky-accent/10">
                <FileText className="w-5 h-5 text-sky-accent" />
              </div>
              <div>
                <h3 className="font-semibold mb-1">View Reports</h3>
                <p className="text-sm text-foreground/50">
                  Browse your previously generated patient reports.
                </p>
              </div>
            </div>
          </GlassCard>
          <GlassCard className="p-6 cursor-pointer" hover>
            <div className="flex items-start gap-4">
              <div className="p-2.5 rounded-xl bg-amber-500/10">
                <Clock className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <h3 className="font-semibold mb-1">Recent Activity</h3>
                <p className="text-sm text-foreground/50">
                  Your recent email syncs and report generation.
                </p>
              </div>
            </div>
          </GlassCard>
        </div>
      </div>
    </div>
  );
}
