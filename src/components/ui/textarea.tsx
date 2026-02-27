"use client";

import { cn } from "@/lib/utils";
import { forwardRef } from "react";

interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        className={cn(
          "w-full rounded-xl border border-card-border bg-card px-4 py-2.5 text-foreground placeholder:text-text-muted focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/30 transition-all resize-y min-h-[80px]",
          className
        )}
        {...props}
      />
    );
  }
);

Textarea.displayName = "Textarea";
