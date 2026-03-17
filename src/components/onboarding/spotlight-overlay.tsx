"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { TourStep } from "./tour-steps";

interface SpotlightOverlayProps {
  steps: TourStep[];
  onComplete: () => void;
  onSkip: () => void;
}

interface TargetRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

const PADDING = 8;
const TOOLTIP_GAP = 12;

function getTargetRect(target: string): TargetRect | null {
  const el = document.querySelector(`[data-tour="${target}"]`);
  if (!el) return null;
  const rect = el.getBoundingClientRect();
  return {
    top: rect.top + window.scrollY,
    left: rect.left + window.scrollX,
    width: rect.width,
    height: rect.height,
  };
}

function getTooltipStyle(
  rect: TargetRect,
  placement: TourStep["placement"],
  tooltipWidth: number,
  tooltipHeight: number
): React.CSSProperties {
  const viewportW = window.innerWidth;

  switch (placement) {
    case "bottom": {
      let left = rect.left + rect.width / 2 - tooltipWidth / 2;
      left = Math.max(16, Math.min(left, viewportW - tooltipWidth - 16));
      return {
        position: "absolute",
        top: rect.top + rect.height + PADDING + TOOLTIP_GAP,
        left,
      };
    }
    case "top": {
      let left = rect.left + rect.width / 2 - tooltipWidth / 2;
      left = Math.max(16, Math.min(left, viewportW - tooltipWidth - 16));
      return {
        position: "absolute",
        top: rect.top - PADDING - TOOLTIP_GAP - tooltipHeight,
        left,
      };
    }
    case "left":
      return {
        position: "absolute",
        top: rect.top + rect.height / 2 - tooltipHeight / 2,
        left: rect.left - PADDING - TOOLTIP_GAP - tooltipWidth,
      };
    case "right":
      return {
        position: "absolute",
        top: rect.top + rect.height / 2 - tooltipHeight / 2,
        left: rect.left + rect.width + PADDING + TOOLTIP_GAP,
      };
  }
}

export function SpotlightOverlay({ steps, onComplete, onSkip }: SpotlightOverlayProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [targetRect, setTargetRect] = useState<TargetRect | null>(null);
  const [tooltipSize, setTooltipSize] = useState({ width: 340, height: 200 });
  const tooltipRef = useRef<HTMLDivElement>(null);
  const step = steps[currentStep];

  const updateRect = useCallback(() => {
    if (!step) return;
    const rect = getTargetRect(step.target);
    if (rect) {
      setTargetRect(rect);
      // Scroll element into view if needed
      const el = document.querySelector(`[data-tour="${step.target}"]`);
      if (el) {
        const viewRect = el.getBoundingClientRect();
        if (viewRect.top < 80 || viewRect.bottom > window.innerHeight - 80) {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
          // Re-measure after scroll
          setTimeout(() => {
            const newRect = getTargetRect(step.target);
            if (newRect) setTargetRect(newRect);
          }, 400);
        }
      }
    }
  }, [step]);

  useEffect(() => {
    updateRect();
    window.addEventListener("resize", updateRect);
    window.addEventListener("scroll", updateRect, true);
    return () => {
      window.removeEventListener("resize", updateRect);
      window.removeEventListener("scroll", updateRect, true);
    };
  }, [updateRect]);

  useEffect(() => {
    if (tooltipRef.current) {
      const { offsetWidth, offsetHeight } = tooltipRef.current;
      setTooltipSize({ width: offsetWidth, height: offsetHeight });
    }
  }, [currentStep]);

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep((s) => s + 1);
    } else {
      onComplete();
    }
  };

  const handleBack = () => {
    if (currentStep > 0) setCurrentStep((s) => s - 1);
  };

  if (!step || !targetRect) return null;

  const tooltipStyle = getTooltipStyle(targetRect, step.placement, tooltipSize.width, tooltipSize.height);

  // SVG mask path: full screen rect with a rounded-rect hole
  const hx = targetRect.left - PADDING;
  const hy = targetRect.top - PADDING;
  const hw = targetRect.width + PADDING * 2;
  const hh = targetRect.height + PADDING * 2;
  const r = 12;

  const holePath = `M${hx + r},${hy}
    L${hx + hw - r},${hy} Q${hx + hw},${hy} ${hx + hw},${hy + r}
    L${hx + hw},${hy + hh - r} Q${hx + hw},${hy + hh} ${hx + hw - r},${hy + hh}
    L${hx + r},${hy + hh} Q${hx},${hy + hh} ${hx},${hy + hh - r}
    L${hx},${hy + r} Q${hx},${hy} ${hx + r},${hy} Z`;

  // Full-screen path needs to account for full document height
  const docW = Math.max(document.documentElement.scrollWidth, window.innerWidth);
  const docH = Math.max(document.documentElement.scrollHeight, window.innerHeight);

  return (
    <div className="fixed inset-0 z-[200]" style={{ pointerEvents: "none" }}>
      {/* Overlay SVG */}
      <svg
        className="absolute top-0 left-0"
        style={{
          width: docW,
          height: docH,
          pointerEvents: "auto",
        }}
      >
        <defs>
          <mask id="spotlight-mask">
            <rect x="0" y="0" width={docW} height={docH} fill="white" />
            <path d={holePath} fill="black" />
          </mask>
        </defs>
        <rect
          x="0"
          y="0"
          width={docW}
          height={docH}
          fill="rgba(0,0,0,0.55)"
          mask="url(#spotlight-mask)"
        />
      </svg>

      {/* Spotlight ring animation */}
      <motion.div
        key={step.id}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
        className="absolute rounded-xl ring-2 ring-primary/50 ring-offset-2 ring-offset-transparent"
        style={{
          top: targetRect.top - PADDING,
          left: targetRect.left - PADDING,
          width: targetRect.width + PADDING * 2,
          height: targetRect.height + PADDING * 2,
          pointerEvents: "none",
        }}
      />

      {/* Tooltip */}
      <AnimatePresence mode="wait">
        <motion.div
          key={step.id}
          ref={tooltipRef}
          initial={{ opacity: 0, y: step.placement === "top" ? 8 : -8, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, scale: 0.97 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          style={{ ...tooltipStyle, pointerEvents: "auto" }}
          className="w-[340px] bg-card border border-card-border rounded-2xl shadow-2xl overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 pt-4 pb-1">
            <h3 className="font-semibold text-base">{step.title}</h3>
            <button
              onClick={onSkip}
              className="p-1 rounded-lg hover:bg-card-hover text-text-muted transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Body */}
          <div className="px-5 py-3">
            <p className="text-sm text-text-secondary leading-relaxed">
              {step.description}
            </p>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-5 py-3 border-t border-card-border bg-card-hover/30">
            <span className="text-xs text-text-muted">
              {currentStep + 1} / {steps.length}
            </span>
            <div className="flex items-center gap-2">
              {currentStep > 0 && (
                <Button variant="ghost" size="sm" onClick={handleBack}>
                  <ChevronLeft className="w-4 h-4 mr-0.5" />
                  Geri
                </Button>
              )}
              <Button size="sm" onClick={handleNext}>
                {currentStep < steps.length - 1 ? (
                  <>
                    İleri
                    <ChevronRight className="w-4 h-4 ml-0.5" />
                  </>
                ) : (
                  "Tamamla"
                )}
              </Button>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
