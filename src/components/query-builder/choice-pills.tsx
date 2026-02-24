"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface ChoicePillsProps {
  options: string[];
  isActive: boolean;
  selectedValue?: string;
  onSelect: (value: string) => void;
}

export function ChoicePills({
  options,
  isActive,
  selectedValue,
  onSelect,
}: ChoicePillsProps) {
  // Filled state - show selected value inline
  if (selectedValue && !isActive) {
    return (
      <motion.span
        initial={{ scale: 0.95 }}
        animate={{ scale: 1 }}
        className="inline-block px-2 py-0.5 font-bold text-primary"
      >
        {selectedValue}
      </motion.span>
    );
  }

  if (!isActive) {
    return (
      <span className="inline-block px-1 py-0.5 text-text-faint font-mono">
        [...]
      </span>
    );
  }

  return (
    <span className="inline-flex gap-2 mx-1">
      {options.map((option, i) => (
        <motion.button
          key={option}
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 0.1 }}
          onClick={() => onSelect(option)}
          className={cn(
            "px-3 py-1 rounded-full text-sm font-medium transition-all cursor-pointer",
            "border border-primary/30 text-primary hover:bg-primary/10 hover:border-primary/60",
            "shadow-[0_0_10px_rgba(217,119,87,0.1)]"
          )}
        >
          {option}
        </motion.button>
      ))}
    </span>
  );
}
