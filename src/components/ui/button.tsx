"use client";

import { cn } from "@/lib/utils";
import { forwardRef } from "react";
import { motion } from "framer-motion";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", disabled, ...props }, ref) => {
    return (
      <motion.div
        whileTap={disabled ? undefined : { scale: 0.97 }}
        whileHover={disabled ? undefined : { scale: 1.01 }}
        transition={{ type: "spring", stiffness: 400, damping: 25 }}
        className="inline-flex"
      >
        <button
          ref={ref}
          disabled={disabled}
          className={cn(
            "inline-flex items-center justify-center rounded-xl font-medium transition-all duration-200 disabled:opacity-50 disabled:pointer-events-none cursor-pointer",
            {
              "bg-primary text-white hover:bg-primary-hover shadow-lg shadow-primary/20":
                variant === "primary",
              "border border-card-border bg-card text-foreground hover:bg-card-hover":
                variant === "secondary",
              "text-foreground/70 hover:text-foreground hover:bg-card-hover":
                variant === "ghost",
              "bg-severity-high/10 text-severity-high border border-severity-high/30 hover:bg-severity-high/20":
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
      </motion.div>
    );
  }
);

Button.displayName = "Button";
