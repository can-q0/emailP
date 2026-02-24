"use client";

import { cn } from "@/lib/utils";

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
  return (
    <div
      className={cn(
        "rounded-2xl border border-glass-border bg-glass backdrop-blur-xl",
        hover && "transition-colors hover:bg-glass-hover",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
