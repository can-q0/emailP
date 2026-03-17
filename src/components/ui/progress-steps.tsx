"use client";

import { motion } from "framer-motion";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface Step {
  label: string;
  description?: string;
}

interface ProgressStepsProps {
  steps: Step[];
  currentStep: number; // 0-indexed
  className?: string;
}

export function ProgressSteps({ steps, currentStep, className }: ProgressStepsProps) {
  return (
    <div className={cn("w-full max-w-md mx-auto", className)}>
      {/* Progress bar */}
      <div className="relative h-1.5 bg-card-border rounded-full overflow-hidden mb-6">
        <motion.div
          className="absolute inset-y-0 left-0 bg-primary rounded-full"
          initial={{ width: "0%" }}
          animate={{
            width: `${Math.min(((currentStep + 1) / steps.length) * 100, 100)}%`,
          }}
          transition={{ duration: 0.6, ease: [0.25, 0.1, 0.25, 1] }}
        />
      </div>

      {/* Step indicators */}
      <div className="flex justify-between">
        {steps.map((step, i) => {
          const isCompleted = i < currentStep;
          const isCurrent = i === currentStep;

          return (
            <div key={i} className="flex flex-col items-center gap-2">
              <motion.div
                className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold border-2 transition-colors",
                  isCompleted && "bg-primary border-primary text-white",
                  isCurrent && "border-primary text-primary bg-primary/10",
                  !isCompleted && !isCurrent && "border-card-border text-text-muted"
                )}
                animate={isCurrent ? { scale: [1, 1.08, 1] } : {}}
                transition={isCurrent ? { duration: 1.5, repeat: Infinity, ease: "easeInOut" } : {}}
              >
                {isCompleted ? (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 300, damping: 20 }}
                  >
                    <Check className="w-4 h-4" />
                  </motion.div>
                ) : (
                  i + 1
                )}
              </motion.div>
              <span
                className={cn(
                  "text-xs text-center max-w-[80px]",
                  isCurrent ? "text-primary font-medium" : "text-text-muted"
                )}
              >
                {step.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
