"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Mail, Trash2, Loader2, CheckCircle, ArrowRight } from "lucide-react";

interface GoLiveModalProps {
  onGoLive: (cleanDemo: boolean) => Promise<void>;
  onDismiss: () => void;
}

export function GoLiveModal({ onGoLive, onDismiss }: GoLiveModalProps) {
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const handleGoLive = async (cleanDemo: boolean) => {
    setLoading(true);
    await onGoLive(cleanDemo);
    setDone(true);
    setTimeout(() => onDismiss(), 1500);
  };

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
        <div className="p-6">
          {done ? (
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="flex flex-col items-center py-6"
            >
              <div className="p-3 rounded-full bg-emerald-500/10 mb-4">
                <CheckCircle className="w-10 h-10 text-emerald-500" />
              </div>
              <h2 className="text-xl font-bold mb-1">Hazırsınız!</h2>
              <p className="text-sm text-text-muted">
                Artık kendi e-postalarınızla çalışabilirsiniz.
              </p>
            </motion.div>
          ) : loading ? (
            <div className="flex flex-col items-center py-8">
              <Loader2 className="w-8 h-8 text-primary animate-spin mb-4" />
              <p className="text-sm text-text-muted">Demo verileri temizleniyor...</p>
            </div>
          ) : (
            <>
              <div className="text-center mb-6">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 200, damping: 12, delay: 0.1 }}
                  className="inline-flex p-4 rounded-2xl bg-primary/10 mb-4"
                >
                  <Mail className="w-10 h-10 text-primary" />
                </motion.div>
                <h2 className="text-xl font-bold mb-2">
                  Gerçek Verilere Geçin
                </h2>
                <p className="text-text-secondary text-sm leading-relaxed">
                  Turu tamamladınız! Gmail hesabınız zaten bağlı.
                  Artık kendi e-postalarınızdan hasta raporu oluşturabilirsiniz.
                </p>
              </div>

              <div className="space-y-3">
                <Button
                  size="lg"
                  className="w-full"
                  onClick={() => handleGoLive(true)}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Demo Verileri Temizle ve Başla
                </Button>
                <Button
                  variant="secondary"
                  size="lg"
                  className="w-full"
                  onClick={() => handleGoLive(false)}
                >
                  <ArrowRight className="w-4 h-4 mr-2" />
                  Demo Verileri Koru ve Başla
                </Button>
                <button
                  onClick={onDismiss}
                  className="w-full text-center text-sm text-text-muted hover:text-text-secondary transition-colors py-2 cursor-pointer"
                >
                  Şimdilik demo modda kal
                </button>
              </div>
            </>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
