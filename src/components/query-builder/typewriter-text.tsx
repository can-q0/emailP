"use client";

import { motion } from "framer-motion";

interface TypewriterTextProps {
  text: string;
  className?: string;
}

export function TypewriterText({ text, className }: TypewriterTextProps) {
  return (
    <span className={className}>
      {text.split("").map((char, i) => (
        <motion.span
          key={i}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.02 }}
        >
          {char}
        </motion.span>
      ))}
    </span>
  );
}
