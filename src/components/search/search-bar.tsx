"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TokenLabel } from "@/lib/search-parser";

interface SearchBarProps {
  query: string;
  onChange: (value: string) => void;
  tokenLabels: TokenLabel[];
  isLoading: boolean;
  placeholder?: string;
}

const TOKEN_COLORS: Record<TokenLabel["type"], string> = {
  firstName: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
  lastName: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
  year: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
  month: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
  labCode: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20",
  gender: "bg-pink-500/10 text-pink-600 dark:text-pink-400 border-pink-500/20",
  birthYear: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
  metric: "bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20",
  operator: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20",
  metricValue: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20",
};

const TOKEN_LABELS_TR: Record<TokenLabel["type"], string> = {
  firstName: "İsim",
  lastName: "Soyisim",
  year: "Yıl",
  month: "Ay",
  labCode: "Lab",
  gender: "Cinsiyet",
  birthYear: "Doğum yılı",
  metric: "Metrik",
  operator: "Operatör",
  metricValue: "Değer",
};

export function SearchBar({ query, onChange, tokenLabels, isLoading, placeholder: placeholderProp }: SearchBarProps) {
  const [focused, setFocused] = useState(false);

  return (
    <div className="space-y-3">
      {/* Search input with glow effect */}
      <div
        className={cn(
          "relative rounded-2xl border bg-card shadow-sm transition-all duration-300",
          focused
            ? "border-primary/40 shadow-lg shadow-primary/10 ring-4 ring-primary/5"
            : "border-card-border hover:border-card-border/80"
        )}
      >
        {/* Animated search icon */}
        <div className="absolute left-5 top-1/2 -translate-y-1/2">
          {isLoading ? (
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            >
              <Search className="w-5 h-5 text-primary" />
            </motion.div>
          ) : (
            <Search
              className={cn(
                "w-5 h-5 transition-colors duration-200",
                focused ? "text-primary" : "text-text-muted"
              )}
            />
          )}
        </div>

        <input
          type="text"
          value={query}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={placeholderProp || "Hasta adı yazarak aramaya başlayın..."}
          autoFocus
          className="w-full pl-14 pr-5 py-4 bg-transparent text-foreground placeholder:text-text-muted focus:outline-none text-base rounded-2xl"
        />

        {/* Loading indicator */}
        <AnimatePresence>
          {isLoading && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="absolute right-4 top-1/2 -translate-y-1/2"
            >
              <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Bottom progress bar when loading */}
        <AnimatePresence>
          {isLoading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute bottom-0 left-0 right-0 h-0.5 rounded-b-2xl overflow-hidden"
            >
              <motion.div
                className="h-full bg-primary/60 rounded-full"
                animate={{ x: ["-100%", "100%"] }}
                transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
                style={{ width: "40%" }}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Token pills */}
      <AnimatePresence mode="popLayout">
        {tokenLabels.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="flex flex-wrap gap-1.5"
          >
            {tokenLabels.map((label, i) => (
              <motion.span
                key={`${label.type}-${i}`}
                initial={{ opacity: 0, scale: 0.8, y: -4 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ delay: i * 0.04, type: "spring", stiffness: 300, damping: 20 }}
                className={cn(
                  "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border",
                  TOKEN_COLORS[label.type]
                )}
              >
                <span>{String(label.value)}</span>
                <span className="opacity-50">{TOKEN_LABELS_TR[label.type]}</span>
              </motion.span>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
