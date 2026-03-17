"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { Mail, Activity, Loader2 } from "lucide-react";
import type { PatientSuggestion } from "@/hooks/usePatientSuggestions";

interface BlankInputProps {
  placeholder: string;
  isActive: boolean;
  value?: string;
  onSubmit: (value: string) => void;
  suggestions?: PatientSuggestion[];
  onInputChange?: (value: string) => void;
  suggestionsLoading?: boolean;
}

function InitialsAvatar({ name }: { name: string }) {
  const initials = name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toLocaleUpperCase("tr-TR"))
    .join("");

  return (
    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary shrink-0">
      {initials}
    </div>
  );
}

export function BlankInput({
  placeholder,
  isActive,
  value,
  onSubmit,
  suggestions,
  onInputChange,
  suggestionsLoading,
}: BlankInputProps) {
  const [inputValue, setInputValue] = useState(value || "");
  const [showDropdown, setShowDropdown] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapperRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (isActive && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isActive]);

  useEffect(() => {
    if (suggestions && suggestions.length > 0 && isActive && inputValue) {
      setShowDropdown(true);
    } else {
      setShowDropdown(false);
    }
    setHighlightedIndex(-1);
  }, [suggestions, isActive, inputValue]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInputValue(val);
    onInputChange?.(val);
  };

  const pickSuggestion = (name: string) => {
    setInputValue(name);
    setShowDropdown(false);
    onSubmit(name);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (showDropdown && suggestions && suggestions.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setHighlightedIndex((prev) =>
          prev < suggestions.length - 1 ? prev + 1 : 0
        );
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlightedIndex((prev) =>
          prev > 0 ? prev - 1 : suggestions.length - 1
        );
        return;
      }
      if (e.key === "Enter" && highlightedIndex >= 0) {
        e.preventDefault();
        pickSuggestion(suggestions[highlightedIndex].name);
        return;
      }
      if (e.key === "Escape") {
        setShowDropdown(false);
        return;
      }
    }

    if (e.key === "Enter" && inputValue.trim()) {
      onSubmit(inputValue.trim());
    }
  };

  // Filled state
  if (value && !isActive) {
    return (
      <motion.span
        initial={{ scale: 0.95 }}
        animate={{ scale: 1 }}
        className="inline-block px-2 py-0.5 font-bold text-primary"
      >
        {value}
      </motion.span>
    );
  }

  return (
    <AnimatePresence mode="wait">
      {isActive ? (
        <motion.span
          ref={wrapperRef}
          initial={{ opacity: 0, width: 0 }}
          animate={{ opacity: 1, width: "auto" }}
          className="inline-block relative"
          onBlur={(e) => {
            if (!wrapperRef.current?.contains(e.relatedTarget as Node)) {
              setShowDropdown(false);
            }
          }}
        >
          <input
            ref={inputRef}
            value={inputValue}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            onFocus={() => {
              if (suggestions && suggestions.length > 0 && inputValue) {
                setShowDropdown(true);
              }
            }}
            placeholder={placeholder}
            className={cn(
              "bg-transparent border-b-2 border-primary outline-none px-1 py-0.5 min-w-[100px] font-mono text-primary placeholder:text-primary/30",
              "shadow-[0_2px_10px_rgba(217,119,87,0.3)]"
            )}
            style={{ width: `${Math.max(inputValue.length, placeholder.length) * 0.6 + 2}em` }}
          />

          {/* Loading indicator next to input */}
          {suggestionsLoading && inputValue && (
            <span className="absolute -right-6 top-1/2 -translate-y-1/2">
              <Loader2 className="w-4 h-4 text-primary animate-spin" />
            </span>
          )}

          {/* Suggestions dropdown */}
          <AnimatePresence>
            {showDropdown && suggestions && suggestions.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: -4, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -4, scale: 0.98 }}
                transition={{ duration: 0.15 }}
                className="absolute z-50 top-full left-0 mt-2 w-[340px] rounded-xl border border-card-border bg-card shadow-xl overflow-hidden"
              >
                {/* Header */}
                <div className="px-3 py-2 border-b border-card-border bg-card-hover/50">
                  <p className="text-xs text-text-muted font-medium">
                    {suggestions.length} patient{suggestions.length !== 1 ? "s" : ""} found
                  </p>
                </div>

                {/* Patient list */}
                <div className="max-h-[280px] overflow-y-auto">
                  {suggestions.map((s, i) => (
                    <motion.button
                      key={s.id || s.name}
                      type="button"
                      initial={{ opacity: 0, x: -6 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.03, duration: 0.2 }}
                      className={cn(
                        "w-full px-3 py-2.5 flex items-center gap-3 text-left transition-colors cursor-pointer",
                        i === highlightedIndex
                          ? "bg-primary/10"
                          : "hover:bg-card-hover"
                      )}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        pickSuggestion(s.name);
                      }}
                      onMouseEnter={() => setHighlightedIndex(i)}
                    >
                      <InitialsAvatar name={s.name} />
                      <div className="flex-1 min-w-0">
                        <p className={cn(
                          "text-sm font-medium truncate",
                          i === highlightedIndex ? "text-primary" : "text-foreground"
                        )}>
                          {s.name}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          {s.governmentId && (
                            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-card-hover border border-card-border text-text-muted">
                              TC: {s.governmentId}
                            </span>
                          )}
                          {s.gender && (
                            <span className="text-[10px] text-text-muted">
                              {s.gender === "Male" ? "E" : "K"}
                            </span>
                          )}
                          {s.birthYear && (
                            <span className="text-[10px] text-text-muted">
                              {s.birthYear}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="flex items-center gap-1 text-[10px] text-text-muted">
                          <Mail className="w-3 h-3" />
                          {s.emailCount}
                        </span>
                        <span className="flex items-center gap-1 text-[10px] text-text-muted">
                          <Activity className="w-3 h-3" />
                          {s.metricCount}
                        </span>
                      </div>
                    </motion.button>
                  ))}
                </div>

                {/* Footer hint */}
                <div className="px-3 py-2 border-t border-card-border bg-card-hover/30">
                  <p className="text-[10px] text-text-faint">
                    <kbd className="px-1 py-0.5 rounded border border-card-border bg-card text-text-muted">↑↓</kbd> navigate
                    {" "}
                    <kbd className="px-1 py-0.5 rounded border border-card-border bg-card text-text-muted">Enter</kbd> select
                    {" "}
                    <kbd className="px-1 py-0.5 rounded border border-card-border bg-card text-text-muted">Esc</kbd> close
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.span>
      ) : (
        <motion.span
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.4 }}
          className="inline-block border-b-2 border-dashed border-card-border px-1 py-0.5 min-w-[100px] text-text-faint font-mono"
        >
          {placeholder}
        </motion.span>
      )}
    </AnimatePresence>
  );
}
