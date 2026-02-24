"use client";

import { cn } from "@/lib/utils";
import { forwardRef } from "react";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={cn(
          "w-full rounded-xl border border-glass-border bg-glass px-4 py-2.5 text-foreground placeholder:text-foreground/40 focus:outline-none focus:border-sky-accent/50 focus:ring-1 focus:ring-sky-accent/30 transition-all",
          className
        )}
        {...props}
      />
    );
  }
);

Input.displayName = "Input";
