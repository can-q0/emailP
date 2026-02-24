"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { GlassCard } from "@/components/ui/glass-card";
import Link from "next/link";
import { Mail, Activity, FileText, Sparkles } from "lucide-react";

export default function LandingPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (session) router.replace("/dashboard");
  }, [session, router]);

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-sky-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-blue-950/40 to-slate-950" />
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-sky-accent/5 rounded-full blur-3xl" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl" />

      <div className="relative z-10">
        {/* Nav */}
        <nav className="flex items-center justify-between px-8 py-6 max-w-6xl mx-auto">
          <div className="flex items-center gap-2">
            <Mail className="w-6 h-6 text-sky-accent" />
            <span className="text-xl font-semibold tracking-tight">
              EmailP
            </span>
          </div>
          <Link href="/auth/signin">
            <Button size="sm">Sign In</Button>
          </Link>
        </nav>

        {/* Hero */}
        <main className="max-w-4xl mx-auto px-8 pt-24 pb-32 text-center">
          <h1 className="text-5xl md:text-6xl font-bold tracking-tight mb-6">
            Your lab emails,
            <br />
            <span className="text-sky-accent">intelligently sorted.</span>
          </h1>
          <p className="text-lg text-foreground/60 max-w-2xl mx-auto mb-12">
            Connect your Gmail, search for patient emails, and generate
            AI-powered medical reports with blood metric visualizations — all in
            one place.
          </p>
          <Link href="/auth/signin">
            <Button size="lg" className="text-base">
              <Sparkles className="w-4 h-4 mr-2" />
              Get Started
            </Button>
          </Link>

          {/* Feature cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-24">
            <GlassCard className="p-6 text-left" hover>
              <Mail className="w-8 h-8 text-sky-accent mb-4" />
              <h3 className="font-semibold mb-2">Gmail Integration</h3>
              <p className="text-sm text-foreground/50">
                Securely connect to your Gmail and search patient emails with
                natural language queries.
              </p>
            </GlassCard>
            <GlassCard className="p-6 text-left" hover>
              <Activity className="w-8 h-8 text-sky-accent mb-4" />
              <h3 className="font-semibold mb-2">Blood Metric Charts</h3>
              <p className="text-sm text-foreground/50">
                Visualize 30+ blood metrics over time with reference ranges and
                abnormal value alerts.
              </p>
            </GlassCard>
            <GlassCard className="p-6 text-left" hover>
              <FileText className="w-8 h-8 text-sky-accent mb-4" />
              <h3 className="font-semibold mb-2">AI Reports</h3>
              <p className="text-sm text-foreground/50">
                Generate comprehensive medical summaries with attention points
                and recommendations.
              </p>
            </GlassCard>
          </div>
        </main>
      </div>
    </div>
  );
}
