"use client";

import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  hover?: boolean;
}

export function GlassCard({
  children,
  className,
  hover = false,
  ...props
}: GlassCardProps) {
  if (hover) {
    return (
      <motion.div
        whileHover={{ y: -2, transition: { type: "spring", stiffness: 300, damping: 20 } }}
        className={cn(
          "rounded-2xl border border-card-border bg-card shadow-sm transition-all hover:shadow-md hover:border-primary/20",
          className
        )}
        {...(props as React.ComponentProps<typeof motion.div>)}
      >
        {children}
      </motion.div>
    );
  }

  return (
    <div
      className={cn(
        "rounded-2xl border border-card-border bg-card shadow-sm",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
