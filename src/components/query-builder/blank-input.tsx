"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

interface Suggestion {
  id: string;
  name: string;
  reportCount?: number;
}

interface BlankInputProps {
  placeholder: string;
  isActive: boolean;
  value?: string;
  onSubmit: (value: string) => void;
  suggestions?: Suggestion[];
  onInputChange?: (value: string) => void;
}

export function BlankInput({
  placeholder,
  isActive,
  value,
  onSubmit,
  suggestions,
  onInputChange,
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

          {/* Suggestions dropdown */}
          {showDropdown && suggestions && suggestions.length > 0 && (
            <div className="absolute z-50 top-full left-0 mt-1 min-w-[200px] rounded-lg border border-card-border bg-card-bg/95 backdrop-blur-sm shadow-lg overflow-hidden">
              {suggestions.map((s, i) => (
                <button
                  key={s.id}
                  type="button"
                  className={`w-full px-3 py-2 flex items-center justify-between text-left text-sm transition-colors ${
                    i === highlightedIndex
                      ? "bg-primary/10 text-primary"
                      : "hover:bg-card-hover"
                  }`}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    pickSuggestion(s.name);
                  }}
                  onMouseEnter={() => setHighlightedIndex(i)}
                >
                  <span className="font-medium">{s.name}</span>
                  {s.reportCount != null && s.reportCount > 0 && (
                    <span className="text-xs text-text-muted bg-card-hover px-2 py-0.5 rounded-full ml-3">
                      {s.reportCount}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
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
