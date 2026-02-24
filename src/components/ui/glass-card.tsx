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
        "rounded-2xl border border-card-border bg-card shadow-sm",
        hover && "transition-all hover:shadow-md hover:border-primary/20",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
