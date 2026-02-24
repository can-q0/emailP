"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

interface BlankInputProps {
  placeholder: string;
  isActive: boolean;
  value?: string;
  onSubmit: (value: string) => void;
}

export function BlankInput({
  placeholder,
  isActive,
  value,
  onSubmit,
}: BlankInputProps) {
  const [inputValue, setInputValue] = useState(value || "");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isActive && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isActive]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
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
        className="inline-block px-2 py-0.5 font-bold text-sky-accent"
      >
        {value}
      </motion.span>
    );
  }

  return (
    <AnimatePresence mode="wait">
      {isActive ? (
        <motion.span
          initial={{ opacity: 0, width: 0 }}
          animate={{ opacity: 1, width: "auto" }}
          className="inline-block relative"
        >
          <input
            ref={inputRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className={cn(
              "bg-transparent border-b-2 border-sky-accent outline-none px-1 py-0.5 min-w-[100px] font-mono text-sky-accent placeholder:text-sky-accent/30",
              "shadow-[0_2px_10px_rgba(56,189,248,0.3)]"
            )}
            style={{ width: `${Math.max(inputValue.length, placeholder.length) * 0.6 + 2}em` }}
          />
        </motion.span>
      ) : (
        <motion.span
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.4 }}
          className="inline-block border-b-2 border-dashed border-foreground/30 px-1 py-0.5 min-w-[100px] text-foreground/30 font-mono"
        >
          {placeholder}
        </motion.span>
      )}
    </AnimatePresence>
  );
}
