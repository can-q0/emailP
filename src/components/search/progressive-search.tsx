"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useProgressiveSearch } from "@/hooks/useProgressiveSearch";
import { SearchBar } from "@/components/search/search-bar";
import { SearchResults } from "@/components/search/search-results";
import { GlassCard } from "@/components/ui/glass-card";
import {
  Search,
  ArrowRight,
  User,
  Calendar,
  FlaskConical,
  Activity,
} from "lucide-react";

const EXAMPLES = [
  {
    icon: User,
    label: "Hasta adi",
    query: "Ahmet Yilmaz",
    color: "text-blue-500",
    bg: "bg-blue-500/10",
  },
  {
    icon: Calendar,
    label: "Tarih filtresi",
    query: "Ahmet Yilmaz 2024 03",
    color: "text-amber-500",
    bg: "bg-amber-500/10",
  },
  {
    icon: FlaskConical,
    label: "Lab & cinsiyet",
    query: "Ahmet Yilmaz 2024 lb e 1985",
    color: "text-purple-500",
    bg: "bg-purple-500/10",
  },
  {
    icon: Activity,
    label: "Metrik sorgusu",
    query: "Ahmet Yilmaz hemoglobin > 15",
    color: "text-primary",
    bg: "bg-primary/10",
  },
];

export function ProgressiveSearch() {
  const { query, setQuery, tokenLabels, results, isLoading, error } = useProgressiveSearch();

  const hasQuery = query.trim().length > 0;
  const hasResults = results.patients.length > 0 || results.emails.length > 0 || results.metrics.length > 0;

  return (
    <div className="space-y-8">
      <SearchBar
        query={query}
        onChange={setQuery}
        tokenLabels={tokenLabels}
        isLoading={isLoading}
      />

      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="text-center text-sm text-severity-high"
          >
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        {/* Empty state — no query yet */}
        {!hasQuery && (
          <motion.div
            key="empty"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.3 }}
          >
            {/* Visual hero */}
            <div className="text-center mb-10">
              <motion.div
                animate={{ y: [0, -6, 0] }}
                transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                className="inline-flex p-4 rounded-2xl bg-primary/5 mb-5"
              >
                <Search className="w-10 h-10 text-primary/30" />
              </motion.div>
              <p className="text-text-secondary text-sm max-w-md mx-auto">
                Boşluklarla ayrılan tokenlar ekledikçe sonuçlar otomatik olarak daralır.
                Her token farklı bir filtreye karşılık gelir.
              </p>
            </div>

            {/* Syntax guide cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-2xl mx-auto">
              {EXAMPLES.map((ex, i) => (
                <motion.div
                  key={ex.label}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 + i * 0.08, duration: 0.35 }}
                >
                  <GlassCard
                    className="p-4 cursor-pointer transition-all hover:border-primary/20"
                    hover
                    onClick={() => setQuery(ex.query)}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`p-2 rounded-xl ${ex.bg} shrink-0`}>
                        <ex.icon className={`w-4 h-4 ${ex.color}`} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium mb-1">{ex.label}</p>
                        <div className="flex items-center gap-2">
                          <code className="text-xs font-mono px-2 py-1 rounded-lg bg-background border border-card-border text-text-secondary truncate">
                            {ex.query}
                          </code>
                          <ArrowRight className="w-3 h-3 text-text-faint shrink-0" />
                        </div>
                      </div>
                    </div>
                  </GlassCard>
                </motion.div>
              ))}
            </div>

            {/* Token legend */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5, duration: 0.4 }}
              className="flex flex-wrap justify-center gap-3 mt-8 text-xs text-text-muted"
            >
              {[
                { label: "isim", color: "bg-blue-500" },
                { label: "yil/ay", color: "bg-amber-500" },
                { label: "lab", color: "bg-purple-500" },
                { label: "cinsiyet", color: "bg-pink-500" },
                { label: "metrik", color: "bg-orange-500" },
              ].map((t) => (
                <span key={t.label} className="flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full ${t.color}`} />
                  {t.label}
                </span>
              ))}
            </motion.div>
          </motion.div>
        )}

        {/* No results after search */}
        {hasQuery && !hasResults && !isLoading && (
          <motion.div
            key="no-results"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="text-center py-16"
          >
            <div className="animate-float inline-block mb-4">
              <div className="p-4 rounded-2xl bg-text-muted/5">
                <Search className="w-8 h-8 text-text-faint" />
              </div>
            </div>
            <p className="text-text-muted text-sm font-medium mb-1">
              Sonuç bulunamadı
            </p>
            <p className="text-text-faint text-xs">
              Farklı bir arama deneyin veya daha az filtre kullanın.
            </p>
          </motion.div>
        )}

        {/* Results */}
        {(hasResults || (hasQuery && isLoading)) && (
          <motion.div
            key="results"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <SearchResults results={results} isLoading={isLoading} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
