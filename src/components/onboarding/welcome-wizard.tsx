"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import {
  Sparkles,
  Search,
  BarChart3,
  FileText,
  ChevronRight,
  ChevronLeft,
  Play,
  SkipForward,
  RotateCcw,
} from "lucide-react";

interface WelcomeWizardProps {
  userName: string;
  isRestart?: boolean;
  onStartDemo: () => void;
  onStartTourOnly: () => void;
  onSkip: () => void;
}

const FEATURES = [
  {
    icon: Search,
    title: "Hasta Arama",
    desc: "E-postalarınızdaki lab sonuçlarını hasta adıyla arayın",
    color: "text-blue-500",
    bg: "bg-blue-500/10",
  },
  {
    icon: BarChart3,
    title: "AI Analiz",
    desc: "Yapay zeka kan değerlerini analiz edip özetlesin",
    color: "text-primary",
    bg: "bg-primary/10",
  },
  {
    icon: FileText,
    title: "Rapor Oluşturma",
    desc: "PDF, Excel veya grafiksel raporlar oluşturun",
    color: "text-emerald-500",
    bg: "bg-emerald-500/10",
  },
];

export function WelcomeWizard({ userName, isRestart = false, onStartDemo, onStartTourOnly, onSkip }: WelcomeWizardProps) {
  const [step, setStep] = useState(0);

  // Step 0: Welcome (different text for restart)
  const welcomeStep = (
    <motion.div
      key="welcome"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      className="text-center"
    >
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", stiffness: 200, damping: 12, delay: 0.1 }}
        className={`inline-flex p-4 rounded-2xl mb-5 ${isRestart ? "bg-amber-500/10" : "bg-primary/10"}`}
      >
        {isRestart ? (
          <RotateCcw className="w-10 h-10 text-amber-600" />
        ) : (
          <Sparkles className="w-10 h-10 text-primary" />
        )}
      </motion.div>
      <h2 className="text-2xl font-bold mb-2">
        {isRestart ? `Tekrar hoşgeldiniz, ${userName}!` : `Hoş geldiniz, ${userName}!`}
      </h2>
      <p className="text-text-secondary text-sm max-w-sm mx-auto leading-relaxed">
        {isRestart
          ? "Eğitici turu tekrar başlatalım. Uygulamanın özelliklerini adım adım göstereceğiz."
          : "EmailP, e-postalarınızdaki laboratuvar sonuçlarını yapay zeka ile analiz ederek hasta raporları oluşturur. Hadi nasıl çalıştığını görelim."}
      </p>
    </motion.div>
  );

  // Step 1: Features
  const featuresStep = (
    <motion.div
      key="features"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      className="text-center"
    >
      <h2 className="text-xl font-bold mb-1">Neler Yapabilirsiniz?</h2>
      <p className="text-text-muted text-sm mb-5">
        Üç basit adımda lab sonuçlarına hakim olun
      </p>
      <div className="space-y-3">
        {FEATURES.map((f, i) => (
          <motion.div
            key={f.title}
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 + i * 0.1 }}
            className="flex items-center gap-4 p-3 rounded-xl border border-card-border bg-card-hover/30 text-left"
          >
            <div className={`p-2.5 rounded-xl ${f.bg} shrink-0`}>
              <f.icon className={`w-5 h-5 ${f.color}`} />
            </div>
            <div>
              <h3 className="font-semibold text-sm">{f.title}</h3>
              <p className="text-xs text-text-muted">{f.desc}</p>
            </div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );

  // Step 2: Start — different for restart vs first-time
  const startStep = (
    <motion.div
      key="start"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      className="text-center"
    >
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", stiffness: 200, damping: 12, delay: 0.1 }}
        className="inline-flex p-4 rounded-2xl bg-emerald-500/10 mb-5"
      >
        <Play className="w-10 h-10 text-emerald-500" />
      </motion.div>
      <h2 className="text-xl font-bold mb-2">
        {isRestart ? "Nasıl başlamak istersiniz?" : "Hazır mısınız?"}
      </h2>
      <p className="text-text-secondary text-sm max-w-sm mx-auto leading-relaxed mb-6">
        {isRestart
          ? "Demo verilerle mi yoksa mevcut verilerinizle mi tur başlatalım?"
          : "Demo verilerle uygulamayı deneyimleyin. Hazır hasta ve lab sonuçlarıyla tüm özellikleri keşfedebilirsiniz."}
      </p>
      <div className="flex flex-col gap-3 max-w-xs mx-auto">
        <Button size="lg" onClick={onStartDemo} className="w-full">
          <Play className="w-4 h-4 mr-2" />
          Demo Verilerle Başla
        </Button>
        {isRestart ? (
          <Button variant="secondary" size="lg" onClick={onStartTourOnly} className="w-full">
            <RotateCcw className="w-4 h-4 mr-2" />
            Sadece Turu Başlat
          </Button>
        ) : null}
        <Button variant="ghost" size="sm" onClick={onSkip} className="text-text-muted">
          <SkipForward className="w-4 h-4 mr-1" />
          {isRestart ? "Vazgeç" : "Atla, kendim keşfedeceğim"}
        </Button>
      </div>
    </motion.div>
  );

  const steps = [welcomeStep, featuresStep, startStep];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[300] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 12 }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        className="bg-card border border-card-border rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
      >
        {/* Content */}
        <div className="p-6 min-h-[320px] flex items-center justify-center">
          <AnimatePresence mode="wait">
            {steps[step]}
          </AnimatePresence>
        </div>

        {/* Footer — only on non-final steps */}
        {step < 2 && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-card-border bg-card-hover/30">
            {/* Dots */}
            <div className="flex items-center gap-1.5">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className={`w-2 h-2 rounded-full transition-all ${
                    i === step ? "bg-primary w-5" : "bg-card-border"
                  }`}
                />
              ))}
            </div>

            {/* Nav */}
            <div className="flex items-center gap-2">
              {step > 0 && (
                <Button variant="ghost" size="sm" onClick={() => setStep((s) => s - 1)}>
                  <ChevronLeft className="w-4 h-4 mr-0.5" />
                  Geri
                </Button>
              )}
              <Button size="sm" onClick={() => setStep((s) => s + 1)}>
                Ileri
                <ChevronRight className="w-4 h-4 ml-0.5" />
              </Button>
            </div>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}
