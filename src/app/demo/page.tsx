"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { signIn } from "next-auth/react";
import { GlassCard } from "@/components/ui/glass-card";
import { Button } from "@/components/ui/button";
import { SpotlightOverlay } from "@/components/onboarding/spotlight-overlay";
import {
  Mail,
  Search,
  Activity,
  Sparkles,
  ArrowRight,
  User,
  FileText,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Download,
  FileSpreadsheet,
  Send,
  GraduationCap,
  BarChart3,
  ChevronRight,
} from "lucide-react";
import type { TourStep } from "@/components/onboarding/tour-steps";

// ── Demo tour steps ──────────────────────────────────────
const DEMO_TOUR: TourStep[] = [
  {
    id: "demo-search",
    target: "demo-search",
    title: "Hasta Arama",
    description:
      "Arama cubugundan hasta adini yazarak lab sonuclarini bulabilirsiniz. Sistem e-postalarinizi tarar ve eslesenleri getirir.",
    placement: "bottom",
  },
  {
    id: "demo-patients",
    target: "demo-patients",
    title: "Hasta Sonuclari",
    description:
      "Bulunan hastalar kartlar halinde goruntulenir. E-posta sayisi ve olculen metrik sayisi her kartta gosterilir.",
    placement: "bottom",
  },
  {
    id: "demo-report-config",
    target: "demo-report-config",
    title: "Rapor Ayarlari",
    description:
      "Hasta secildikten sonra rapor tipi ve formati belirlenir. Detayli, ozet veya grafiksel formatlar mevcuttur.",
    placement: "top",
  },
  {
    id: "demo-ai-summary",
    target: "demo-ai-summary",
    title: "AI Analizi",
    description:
      "Yapay zeka, kan degerlerini analiz ederek onemli bulgulari ozetler. Her rapor icin kisisellestirilmis degerlendirme sunar.",
    placement: "bottom",
  },
  {
    id: "demo-metrics",
    target: "demo-metrics",
    title: "Kan Degerleri",
    description:
      "30'dan fazla kan degeri otomatik cikarilir. Referans disindakiler isaretlenir, trendler gosterilir.",
    placement: "top",
  },
  {
    id: "demo-attention",
    target: "demo-attention",
    title: "Dikkat Noktalari",
    description:
      "AI, onem derecesine gore dikkat noktalarini siralar. Yuksek, orta ve dusuk oncelikli uyarilar gorursunuz.",
    placement: "top",
  },
  {
    id: "demo-export",
    target: "demo-export",
    title: "Disa Aktarim",
    description:
      "Raporlarinizi PDF veya Excel olarak indirin, e-posta ile gonderin.",
    placement: "bottom",
  },
];

// ── Demo data ────────────────────────────────────────────
const DEMO_PATIENTS = [
  { name: "Ayse Yilmaz", gender: "Kadin", birthYear: 1985, emailCount: 4, metricCount: 16, govId: "123...901" },
  { name: "Mehmet Kaya", gender: "Erkek", birthYear: 1978, emailCount: 2, metricCount: 7, govId: "987...109" },
  { name: "Fatma Demir", gender: "Kadin", birthYear: 1990, emailCount: 1, metricCount: 7, govId: "555...788" },
];

const DEMO_METRICS = [
  { name: "Hemoglobin", value: 12.5, unit: "g/dL", min: 12.0, max: 15.5, isAbnormal: false },
  { name: "Total Kolesterol", value: 220, unit: "mg/dL", min: 0, max: 200, isAbnormal: true },
  { name: "LDL Kolesterol", value: 145, unit: "mg/dL", min: 0, max: 130, isAbnormal: true },
  { name: "TSH", value: 0.3, unit: "mIU/L", min: 0.4, max: 4.0, isAbnormal: true },
  { name: "HDL Kolesterol", value: 55, unit: "mg/dL", min: 40, max: 60, isAbnormal: false },
  { name: "Aclik Kan Sekeri", value: 95, unit: "mg/dL", min: 70, max: 100, isAbnormal: false },
  { name: "Trigliserit", value: 160, unit: "mg/dL", min: 0, max: 150, isAbnormal: true },
  { name: "Serbest T4", value: 1.8, unit: "ng/dL", min: 0.8, max: 1.8, isAbnormal: false },
];

const DEMO_ATTENTION = [
  { metric: "TSH", value: "0.3 mIU/L", severity: "high" as const, message: "TSH dusuk — subklinik hipertiroidizm olabilir. Tiroid fonksiyon testleri tekrarlanmali." },
  { metric: "Total Kolesterol", value: "220 mg/dL", severity: "medium" as const, message: "Referans araligin ustunde. Diyet ve egzersiz oneriyorum." },
  { metric: "LDL Kolesterol", value: "145 mg/dL", severity: "medium" as const, message: "LDL yuksek. Kardiyovaskuler risk degerlendirmesi yapilmali." },
  { metric: "Trigliserit", value: "160 mg/dL", severity: "low" as const, message: "Hafif yuksek. Karbonhidrat kisitlamasi faydali olabilir." },
];

// ── Components ───────────────────────────────────────────

function InitialsAvatar({ name }: { name: string }) {
  const initials = name.split(" ").slice(0, 2).map((w) => w[0]).join("");
  return (
    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-sm font-semibold text-primary shrink-0">
      {initials}
    </div>
  );
}

function MetricBar({ name, value, unit, min, max, isAbnormal }: typeof DEMO_METRICS[0]) {
  const range = max - min;
  const pos = range > 0 ? Math.min(Math.max(((value - min) / range) * 100, 0), 100) : 50;

  return (
    <div className="flex items-center gap-4 py-2.5">
      <div className="w-36 shrink-0">
        <p className="text-sm font-medium truncate">{name}</p>
        <p className="text-xs text-text-muted">{min}–{max} {unit}</p>
      </div>
      <div className="flex-1 relative h-2 rounded-full bg-card-border/50 overflow-hidden">
        <div className="absolute inset-y-0 left-0 right-0 bg-severity-low/15 rounded-full" />
        <motion.div
          initial={{ left: "50%" }}
          animate={{ left: `${pos}%` }}
          transition={{ delay: 0.5, duration: 0.8, ease: "easeOut" }}
          className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 rounded-full border-2 border-white shadow-sm ${
            isAbnormal ? "bg-severity-high" : "bg-severity-low"
          }`}
        />
      </div>
      <div className="w-20 text-right shrink-0">
        <span className={`text-sm font-mono font-semibold ${isAbnormal ? "text-severity-high" : "text-foreground"}`}>
          {value}
        </span>
        <span className="text-xs text-text-muted ml-1">{unit}</span>
      </div>
    </div>
  );
}

const severityColors = {
  high: "bg-severity-high/10 text-severity-high border-severity-high/20",
  medium: "bg-severity-medium/10 text-severity-medium border-severity-medium/20",
  low: "bg-severity-low/10 text-severity-low border-severity-low/20",
};

const severityLabels = { high: "Yuksek", medium: "Orta", low: "Dusuk" };

// ── Main Page ────────────────────────────────────────────

export default function DemoPage() {
  const [tourActive, setTourActive] = useState(false);
  const [searchValue] = useState("Ayse");

  // Auto-start tour after mount
  useEffect(() => {
    const timer = setTimeout(() => setTourActive(true), 800);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="min-h-screen bg-background">
      {/* Demo Navbar */}
      <nav className="sticky top-0 z-50 border-b border-card-border bg-background/90 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <Mail className="w-5 h-5 text-primary" />
              <span className="font-semibold tracking-tight">EmailP</span>
            </div>
            <div data-tour="nav-links" className="hidden md:flex items-center gap-1 text-sm text-text-muted">
              <span className="px-3 py-1.5 rounded-lg bg-card-hover font-medium text-foreground">Dashboard</span>
              <span className="px-3 py-1.5 rounded-lg hover:bg-card-hover transition-colors">Search</span>
              <span className="px-3 py-1.5 rounded-lg hover:bg-card-hover transition-colors">Patients</span>
              <span className="px-3 py-1.5 rounded-lg hover:bg-card-hover transition-colors">Reports</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/20">
              <GraduationCap className="w-3.5 h-3.5 text-amber-600" />
              <span className="text-xs font-medium text-amber-600">Demo</span>
            </div>
            <Button size="sm" onClick={() => signIn("google", { callbackUrl: "/dashboard" })}>
              Gmail ile Giris Yap
            </Button>
          </div>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        {/* Welcome */}
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-1">
            <div className="p-3 rounded-2xl bg-primary/10">
              <Sparkles className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold">Hos geldiniz!</h1>
              <p className="text-text-secondary text-sm">
                Bu bir demo goruntusudur. Uygulamanin nasil calistigini kesfedelim.
              </p>
            </div>
          </div>
        </div>

        {/* ── DASHBOARD SECTION ── */}

        {/* Search bar */}
        <div data-tour="demo-search" className="mb-6">
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-card-border bg-card">
            <Search className="w-5 h-5 text-text-muted" />
            <span className="text-foreground">{searchValue}</span>
            <span className="ml-1 w-0.5 h-5 bg-primary animate-pulse" />
          </div>
        </div>

        {/* Patient results */}
        <div data-tour="demo-patients" className="mb-8">
          <div className="flex items-center gap-2 mb-3">
            <User className="w-4 h-4 text-text-muted" />
            <span className="text-sm text-text-muted font-medium">3 hasta bulundu</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {DEMO_PATIENTS.map((p, i) => (
              <motion.div
                key={p.name}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 + i * 0.1 }}
              >
                <GlassCard className={`p-4 ${i === 0 ? "ring-2 ring-primary/20 border-primary/30" : ""}`}>
                  <div className="flex items-center gap-3">
                    <InitialsAvatar name={p.name} />
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold truncate">{p.name}</h3>
                      <div className="flex items-center gap-2 mt-0.5 text-xs text-text-muted">
                        <span className="px-1.5 py-0.5 rounded bg-card-hover border border-card-border font-mono">
                          TC: {p.govId}
                        </span>
                        <span>{p.gender}</span>
                        <span>{p.birthYear}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="flex items-center gap-1 text-xs text-text-muted">
                        <Mail className="w-3.5 h-3.5" /> {p.emailCount}
                      </span>
                      <span className="flex items-center gap-1 text-xs text-text-muted">
                        <Activity className="w-3.5 h-3.5" /> {p.metricCount}
                      </span>
                      <ArrowRight className="w-4 h-4 text-text-faint" />
                    </div>
                  </div>
                </GlassCard>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Report config mock */}
        <div data-tour="demo-report-config" className="mb-12">
          <GlassCard className="p-5">
            <div className="flex items-center gap-3 mb-4">
              <InitialsAvatar name="Ayse Yilmaz" />
              <div>
                <h3 className="font-semibold">Ayse Yilmaz</h3>
                <p className="text-xs text-text-muted">4 e-posta, 16 metrik</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 mb-3">
              {[
                { label: "Detayli Rapor", icon: FileText, active: true },
                { label: "Tum E-postalar", icon: Mail, active: false },
                { label: "Karsilastirma", icon: Activity, active: false },
                { label: "Duz PDF", icon: FileText, active: false },
              ].map((t) => (
                <div
                  key={t.label}
                  className={`flex items-center gap-2 p-3 rounded-xl border text-sm ${
                    t.active
                      ? "border-primary/40 bg-primary/5 text-primary font-medium"
                      : "border-card-border text-text-muted"
                  }`}
                >
                  <t.icon className="w-4 h-4" />
                  {t.label}
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              {["Ozet", "Detayli", "Grafiksel"].map((f, i) => (
                <span
                  key={f}
                  className={`px-4 py-2 rounded-xl text-sm font-medium ${
                    i === 2 ? "bg-primary text-white" : "border border-card-border text-text-secondary"
                  }`}
                >
                  {f}
                </span>
              ))}
            </div>
          </GlassCard>
        </div>

        {/* ── REPORT SECTION ── */}

        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-primary/10">
              <User className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-bold">Ayse Yilmaz</h2>
              <p className="text-sm text-text-muted">TC: 12345678901 · 15 Ocak 2026</p>
            </div>
          </div>
          <div data-tour="demo-export" className="flex items-center gap-2">
            <Button variant="ghost" size="sm"><Download className="w-4 h-4 mr-1" /> PDF</Button>
            <Button variant="ghost" size="sm"><FileSpreadsheet className="w-4 h-4 mr-1" /> Excel</Button>
            <Button size="sm"><Send className="w-4 h-4 mr-1" /> Gonder</Button>
          </div>
        </div>

        {/* AI Summary */}
        <div data-tour="demo-ai-summary" className="mb-8">
          <GlassCard className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="w-5 h-5 text-primary" />
              <h3 className="font-semibold">AI Degerlendirmesi</h3>
            </div>
            <div className="prose prose-sm max-w-none text-text-secondary space-y-3">
              <p>
                <strong>Lipid Profili:</strong> Total Kolesterol 220 mg/dL ile referans araligin ustunde.
                Onceki tetkikte 235 idi, hafif iyilesme gorulmektedir. LDL Kolesterol 145 mg/dL ile yuksek sinirda.
              </p>
              <p>
                <strong>Tiroid Fonksiyonlari:</strong> TSH 0.3 mIU/L ile referansin altinda.
                Bu durum subklinik hipertiroidi dusundurmektedir. Serbest T4 ust sinirda ancak normal.
              </p>
              <p>
                <strong>Oneri:</strong> Lipid profili icin diyet ve yasam tarzi duzenlemesi,
                TSH takibi 6-8 hafta sonra, 3 ay sonra kontrol kan tetkiki.
              </p>
            </div>
          </GlassCard>
        </div>

        {/* Blood Metrics */}
        <div data-tour="demo-metrics" className="mb-8">
          <GlassCard className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <BarChart3 className="w-5 h-5 text-primary" />
              <h3 className="font-semibold">Kan Degerleri</h3>
              <span className="text-xs text-text-muted ml-auto">{DEMO_METRICS.length} metrik</span>
            </div>
            <div className="divide-y divide-card-border">
              {DEMO_METRICS.map((m) => (
                <MetricBar key={m.name} {...m} />
              ))}
            </div>
          </GlassCard>
        </div>

        {/* Attention Points */}
        <div data-tour="demo-attention" className="mb-12">
          <GlassCard className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <AlertTriangle className="w-5 h-5 text-severity-medium" />
              <h3 className="font-semibold">Dikkat Noktalari</h3>
              <span className="text-xs text-text-muted ml-auto">{DEMO_ATTENTION.length} uyari</span>
            </div>
            <div className="space-y-3">
              {DEMO_ATTENTION.map((a, i) => (
                <motion.div
                  key={a.metric}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3 + i * 0.1 }}
                  className={`flex items-start gap-3 p-3 rounded-xl border ${severityColors[a.severity]}`}
                >
                  <div className="shrink-0 mt-0.5">
                    {a.severity === "high" ? (
                      <TrendingDown className="w-4 h-4" />
                    ) : (
                      <TrendingUp className="w-4 h-4" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-sm font-semibold">{a.metric}</span>
                      <span className="text-xs font-mono">{a.value}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${severityColors[a.severity]}`}>
                        {severityLabels[a.severity]}
                      </span>
                    </div>
                    <p className="text-xs opacity-80">{a.message}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </GlassCard>
        </div>

        {/* ── SIGN IN CTA ── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1 }}
          className="text-center py-12"
        >
          <div className="inline-flex p-4 rounded-2xl bg-primary/10 mb-5">
            <Mail className="w-10 h-10 text-primary" />
          </div>
          <h2 className="text-2xl font-bold mb-2">Etkileyici, degil mi?</h2>
          <p className="text-text-secondary text-sm max-w-md mx-auto mb-6 leading-relaxed">
            Gmail hesabinizi baglayarak kendi lab e-postalarinizdan
            hasta raporlari olusturabilirsiniz. Sadece okuma erisimi, verileriniz guvendedir.
          </p>
          <Button
            size="lg"
            className="text-base"
            onClick={() => signIn("google", { callbackUrl: "/dashboard" })}
          >
            <Mail className="w-4 h-4 mr-2" />
            Gmail ile Giris Yap
            <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        </motion.div>
      </div>

      {/* Spotlight Tour */}
      <AnimatePresence>
        {tourActive && (
          <SpotlightOverlay
            steps={DEMO_TOUR}
            onComplete={() => setTourActive(false)}
            onSkip={() => setTourActive(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
