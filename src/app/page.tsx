"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { motion, useInView } from "framer-motion";
import { Button } from "@/components/ui/button";
import { GlassCard } from "@/components/ui/glass-card";
import Link from "next/link";
import {
  Mail,
  Activity,
  FileText,
  Sparkles,
  ArrowRight,
  Search,
  Zap,
  Shield,
  BarChart3,
  Clock,
  Users,
  FlaskConical,
  GraduationCap,
} from "lucide-react";

// ── Animated background orbs ─────────────────────────────
function BackgroundOrbs() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <div className="absolute inset-0 bg-background" />
      <motion.div
        className="absolute w-[600px] h-[600px] rounded-full bg-primary/[0.04] blur-[100px]"
        style={{ top: "10%", left: "15%" }}
        animate={{
          x: [0, 30, -20, 0],
          y: [0, -25, 15, 0],
        }}
        transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
      />
      <motion.div
        className="absolute w-[500px] h-[500px] rounded-full bg-primary/[0.03] blur-[100px]"
        style={{ bottom: "10%", right: "10%" }}
        animate={{
          x: [0, -25, 20, 0],
          y: [0, 20, -30, 0],
        }}
        transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
      />
      <motion.div
        className="absolute w-[300px] h-[300px] rounded-full bg-severity-low/[0.03] blur-[80px]"
        style={{ top: "50%", left: "50%" }}
        animate={{
          x: [0, 40, -30, 0],
          y: [0, -20, 25, 0],
        }}
        transition={{ duration: 18, repeat: Infinity, ease: "linear" }}
      />
    </div>
  );
}

// ── Metric pill floating element ─────────────────────────
function FloatingPill({
  label,
  value,
  unit,
  severity,
  delay,
  className,
}: {
  label: string;
  value: string;
  unit: string;
  severity: "low" | "medium" | "high";
  delay: number;
  className: string;
}) {
  const colors = {
    low: "border-severity-low/20 bg-severity-low/5",
    medium: "border-severity-medium/20 bg-severity-medium/5",
    high: "border-severity-high/20 bg-severity-high/5",
  };
  const dot = {
    low: "bg-severity-low",
    medium: "bg-severity-medium",
    high: "bg-severity-high",
  };
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ delay, duration: 0.6, ease: [0.25, 0.1, 0.25, 1] }}
      className={`absolute hidden lg:flex ${className}`}
    >
      <motion.div
        animate={{ y: [0, -6, 0] }}
        transition={{ duration: 3 + delay, repeat: Infinity, ease: "easeInOut" }}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-full border ${colors[severity]} backdrop-blur-sm`}
      >
        <span className={`w-1.5 h-1.5 rounded-full ${dot[severity]}`} />
        <span className="text-xs font-medium text-foreground/80">{label}</span>
        <span className="text-xs font-mono text-text-muted">
          {value} {unit}
        </span>
      </motion.div>
    </motion.div>
  );
}

// ── Product mockup showing the query builder ─────────────
function ProductMockup() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.6, duration: 0.8, ease: [0.25, 0.1, 0.25, 1] }}
      className="relative max-w-3xl mx-auto mt-16 sm:mt-20"
    >
      {/* Browser chrome */}
      <div className="rounded-2xl border border-card-border bg-card shadow-2xl shadow-primary/5 overflow-hidden">
        {/* Title bar */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-card-border bg-card-hover/50">
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-severity-high/40" />
            <div className="w-3 h-3 rounded-full bg-severity-medium/40" />
            <div className="w-3 h-3 rounded-full bg-severity-low/40" />
          </div>
          <div className="flex-1 flex justify-center">
            <div className="px-4 py-1 rounded-lg bg-background/60 text-xs text-text-muted font-mono">
              emailp.app/dashboard
            </div>
          </div>
        </div>

        {/* App content mock */}
        <div className="p-6 sm:p-8 bg-background">
          {/* Query builder mock */}
          <div className="mb-6">
            <p className="text-text-muted text-sm mb-4">Welcome back, Doctor</p>
            <div className="font-mono text-base sm:text-lg leading-relaxed">
              <span className="text-foreground/60">Show me </span>
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1.2, duration: 0.3 }}
                className="px-2 py-0.5 rounded-lg bg-primary/10 text-primary font-semibold border border-primary/20"
              >
                detailed report
              </motion.span>
              <span className="text-foreground/60"> for patient </span>
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1.6, duration: 0.3 }}
                className="px-2 py-0.5 rounded-lg bg-primary/10 text-primary font-semibold border border-primary/20"
              >
                Ayse Yilmaz
              </motion.span>
              <span className="text-foreground/60"> in </span>
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 2.0, duration: 0.3 }}
                className="px-2 py-0.5 rounded-lg bg-primary/10 text-primary font-semibold border border-primary/20"
              >
                graphical
              </motion.span>
              <span className="text-foreground/60"> format.</span>
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: [0, 1, 0] }}
                transition={{ delay: 2.4, duration: 0.8, repeat: Infinity }}
                className="inline-block w-0.5 h-5 bg-primary ml-1 -mb-0.5"
              />
            </div>
          </div>

          {/* Results mock */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Hemoglobin", value: "14.2", status: "normal" },
              { label: "WBC", value: "11.8", status: "high" },
              { label: "Platelets", value: "245", status: "normal" },
            ].map((metric, i) => (
              <motion.div
                key={metric.label}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 2.6 + i * 0.15, duration: 0.4 }}
                className="rounded-xl border border-card-border bg-card p-3"
              >
                <p className="text-xs text-text-muted mb-1">{metric.label}</p>
                <div className="flex items-baseline gap-1">
                  <span className="text-lg font-semibold font-mono">{metric.value}</span>
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      metric.status === "normal" ? "bg-severity-low" : "bg-severity-high"
                    }`}
                  />
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      {/* Floating metric pills around the mockup */}
      <FloatingPill
        label="TSH"
        value="2.4"
        unit="mIU/L"
        severity="low"
        delay={1.8}
        className="-top-4 -left-8"
      />
      <FloatingPill
        label="Glucose"
        value="118"
        unit="mg/dL"
        severity="medium"
        delay={2.2}
        className="-top-2 -right-12"
      />
      <FloatingPill
        label="CRP"
        value="8.2"
        unit="mg/L"
        severity="high"
        delay={2.5}
        className="-bottom-3 -left-6"
      />
    </motion.div>
  );
}

// ── How it works section ─────────────────────────────────
function HowItWorks() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });

  const steps = [
    {
      icon: Mail,
      num: "01",
      title: "Connect Gmail",
      desc: "Sign in with Google and grant read-only access to your Gmail. We never send emails on your behalf.",
    },
    {
      icon: Search,
      num: "02",
      title: "Search & Extract",
      desc: "Type a patient name. We find lab emails, extract PDF attachments, and read blood metric values with AI.",
    },
    {
      icon: BarChart3,
      num: "03",
      title: "Get Your Report",
      desc: "Receive an AI-generated report with visualized metrics, trend alerts, attention points, and recommendations.",
    },
  ];

  return (
    <section ref={ref} className="max-w-5xl mx-auto px-8 py-24">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={isInView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.5 }}
        className="text-center mb-16"
      >
        <p className="text-sm font-semibold text-primary uppercase tracking-widest mb-3">
          How it works
        </p>
        <h2 className="text-3xl sm:text-4xl font-bold">
          From inbox to insight in minutes
        </h2>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
        {/* Connecting line */}
        <div className="hidden md:block absolute top-12 left-[20%] right-[20%] h-px bg-gradient-to-r from-card-border via-primary/20 to-card-border" />

        {steps.map((step, i) => (
          <motion.div
            key={step.num}
            initial={{ opacity: 0, y: 24 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ delay: 0.2 + i * 0.15, duration: 0.5 }}
            className="relative text-center"
          >
            <div className="relative inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-card border border-card-border shadow-sm mb-6 mx-auto">
              <step.icon className="w-7 h-7 text-primary" />
              <span className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-primary text-white text-xs font-bold flex items-center justify-center">
                {i + 1}
              </span>
            </div>
            <h3 className="font-semibold text-lg mb-2">{step.title}</h3>
            <p className="text-sm text-text-secondary leading-relaxed">
              {step.desc}
            </p>
          </motion.div>
        ))}
      </div>
    </section>
  );
}

// ── Features grid ────────────────────────────────────────
function Features() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });

  const features = [
    {
      icon: FlaskConical,
      title: "30+ Blood Metrics",
      desc: "Track hemoglobin, WBC, platelets, TSH, glucose, CRP, and many more with reference ranges.",
      color: "text-primary",
      bg: "bg-primary/10",
    },
    {
      icon: Zap,
      title: "AI-Powered Analysis",
      desc: "GPT-4o extracts values from PDFs and generates medical summaries with attention points.",
      color: "text-severity-medium",
      bg: "bg-severity-medium/10",
    },
    {
      icon: Activity,
      title: "Trend Alerts",
      desc: "Detect consecutive worsening, rapid changes, and persistent abnormal values automatically.",
      color: "text-severity-high",
      bg: "bg-severity-high/10",
    },
    {
      icon: Users,
      title: "Batch Generation",
      desc: "Generate reports for up to 20 patients at once. Track progress in real-time.",
      color: "text-severity-low",
      bg: "bg-severity-low/10",
    },
    {
      icon: Shield,
      title: "Secure & Private",
      desc: "Read-only Gmail access. Your data stays in your database. No emails are ever sent without consent.",
      color: "text-text-secondary",
      bg: "bg-card-hover",
    },
    {
      icon: Clock,
      title: "Multiple Formats",
      desc: "Summary, detailed, or graphical. Export as PDF or Excel. Compare results across dates.",
      color: "text-primary",
      bg: "bg-primary/10",
    },
  ];

  return (
    <section ref={ref} className="max-w-5xl mx-auto px-8 py-24">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={isInView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.5 }}
        className="text-center mb-16"
      >
        <p className="text-sm font-semibold text-primary uppercase tracking-widest mb-3">
          Features
        </p>
        <h2 className="text-3xl sm:text-4xl font-bold">
          Everything you need for lab analysis
        </h2>
      </motion.div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {features.map((f, i) => (
          <motion.div
            key={f.title}
            initial={{ opacity: 0, y: 16 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ delay: 0.1 + i * 0.08, duration: 0.4 }}
          >
            <GlassCard className="p-6 h-full" hover>
              <div className={`inline-flex p-2.5 rounded-xl ${f.bg} mb-4`}>
                <f.icon className={`w-5 h-5 ${f.color}`} />
              </div>
              <h3 className="font-semibold mb-2">{f.title}</h3>
              <p className="text-sm text-text-secondary leading-relaxed">{f.desc}</p>
            </GlassCard>
          </motion.div>
        ))}
      </div>
    </section>
  );
}

// ── Stats banner ─────────────────────────────────────────
function Stats() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-40px" });

  const stats = [
    { value: "30+", label: "Blood Metrics" },
    { value: "12", label: "Report Layouts" },
    { value: "4", label: "Export Formats" },
    { value: "<2min", label: "Report Generation" },
  ];

  return (
    <section ref={ref} className="max-w-5xl mx-auto px-8 py-12">
      <div className="rounded-2xl border border-card-border bg-card/50 backdrop-blur-sm p-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {stats.map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 12 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: i * 0.1, duration: 0.4 }}
              className="text-center"
            >
              <p className="text-2xl sm:text-3xl font-bold text-primary mb-1">
                {stat.value}
              </p>
              <p className="text-sm text-text-muted">{stat.label}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── Final CTA ────────────────────────────────────────────
function FinalCTA() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-60px" });

  return (
    <section ref={ref} className="max-w-3xl mx-auto px-8 py-24 text-center">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={isInView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.5 }}
      >
        <div className="inline-flex p-3 rounded-2xl bg-primary/10 mb-6">
          <Sparkles className="w-8 h-8 text-primary" />
        </div>
        <h2 className="text-3xl sm:text-4xl font-bold mb-4">
          Ready to transform your workflow?
        </h2>
        <p className="text-text-secondary text-lg mb-8 max-w-xl mx-auto">
          Start generating AI-powered patient reports from your lab emails in
          under two minutes. Free to use.
        </p>
        <Link href="/auth/signin">
          <Button size="lg" className="text-base">
            Get Started Free
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </Link>
      </motion.div>
    </section>
  );
}

// ── Footer ───────────────────────────────────────────────
function Footer() {
  return (
    <footer className="border-t border-card-border">
      <div className="max-w-5xl mx-auto px-8 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Mail className="w-4 h-4 text-primary" />
          <span className="text-sm font-semibold">EmailP</span>
        </div>
        <p className="text-xs text-text-muted">
          AI-powered laboratory email sorter & patient report generator
        </p>
      </div>
    </footer>
  );
}

// ── Main page ────────────────────────────────────────────
export default function LandingPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (session) router.replace("/dashboard");
  }, [session, router]);

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen relative">
      <BackgroundOrbs />

      <div className="relative z-10">
        {/* Nav */}
        <nav className="flex items-center justify-between px-8 py-6 max-w-6xl mx-auto">
          <div className="flex items-center gap-2">
            <Mail className="w-6 h-6 text-primary" />
            <span className="text-xl font-semibold tracking-tight">EmailP</span>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/demo">
              <Button variant="ghost" size="sm">
                Demo
              </Button>
            </Link>
            <Link href="/auth/signin">
              <Button size="sm">Sign In</Button>
            </Link>
          </div>
        </nav>

        {/* Hero */}
        <main className="max-w-4xl mx-auto px-8 pt-16 sm:pt-24 text-center">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-card-border bg-card/80 backdrop-blur-sm text-sm text-text-secondary mb-8"
          >
            <span className="w-2 h-2 rounded-full bg-severity-low animate-pulse" />
            AI-powered lab report analysis
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.5 }}
            className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight mb-6 leading-[1.1]"
          >
            Your lab emails,
            <br />
            <span className="text-primary">intelligently sorted.</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25, duration: 0.5 }}
            className="text-lg text-text-secondary max-w-2xl mx-auto mb-10"
          >
            Connect your Gmail, search for patients, and generate AI-powered
            medical reports with blood metric visualizations, trend detection,
            and clinical attention points — all in one place.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.5 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            <Link href="/auth/signin">
              <Button size="lg" className="text-base">
                <Sparkles className="w-4 h-4 mr-2" />
                Get Started Free
              </Button>
            </Link>
            <Link href="/demo">
              <Button variant="secondary" size="lg" className="text-base">
                <GraduationCap className="w-4 h-4 mr-2" />
                Demo
              </Button>
            </Link>
          </motion.div>

          {/* Product mockup */}
          <ProductMockup />
        </main>

        {/* Stats */}
        <Stats />

        {/* How it works */}
        <div id="how-it-works">
          <HowItWorks />
        </div>

        {/* Features */}
        <Features />

        {/* Final CTA */}
        <FinalCTA />

        {/* Footer */}
        <Footer />
      </div>
    </div>
  );
}
