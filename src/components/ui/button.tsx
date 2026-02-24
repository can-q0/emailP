"use client";

import { cn } from "@/lib/utils";
import { forwardRef } from "react";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center rounded-xl font-medium transition-all duration-200 disabled:opacity-50 disabled:pointer-events-none cursor-pointer",
          {
            "bg-sky-accent text-slate-900 hover:bg-sky-accent-dim shadow-lg shadow-sky-accent/20":
              variant === "primary",
            "border border-glass-border bg-glass text-foreground hover:bg-glass-hover":
              variant === "secondary",
            "text-foreground/70 hover:text-foreground hover:bg-glass":
              variant === "ghost",
            "bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30":
              variant === "danger",
          },
          {
            "px-3 py-1.5 text-sm": size === "sm",
            "px-4 py-2 text-sm": size === "md",
            "px-6 py-3 text-base": size === "lg",
          },
          className
        )}
        {...props}
      />
    );
  }
);

Button.displayName = "Button";
