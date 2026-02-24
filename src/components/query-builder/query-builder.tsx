"use client";

import { useEffect, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import { useQueryBuilder } from "@/hooks/useQueryBuilder";
import { TypewriterText } from "./typewriter-text";
import { BlankInput } from "./blank-input";
import { ChoicePills } from "./choice-pills";
import { QueryTemplate, QueryValues } from "@/types";
import { GlassCard } from "@/components/ui/glass-card";
import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";

interface QueryBuilderProps {
  template: QueryTemplate;
  initialValues?: Partial<QueryValues>;
  onSubmit: (values: QueryValues) => void;
}

export function QueryBuilder({
  template,
  initialValues,
  onSubmit,
}: QueryBuilderProps) {
  const {
    segmentStates,
    activeSegmentIndex,
    values,
    isAnimating,
    isAllComplete,
    fillValue,
    startAnimation,
  } = useQueryBuilder(template);

  const hasStarted = useRef(false);

  useEffect(() => {
    if (!hasStarted.current) {
      hasStarted.current = true;
      // Pre-fill initial values (e.g. patient name from URL)
      if (initialValues) {
        Object.entries(initialValues).forEach(([key, val]) => {
          if (val) fillValue(key, val);
        });
      }
      startAnimation();
    }
  }, [startAnimation, fillValue, initialValues]);

  // Restart animation when activeSegmentIndex changes
  useEffect(() => {
    if (hasStarted.current && isAnimating) {
      startAnimation();
    }
  }, [activeSegmentIndex, isAnimating, startAnimation]);

  const handleSubmit = useCallback(() => {
    onSubmit(values);
  }, [values, onSubmit]);

  return (
    <GlassCard className="p-8 md:p-12 max-w-3xl mx-auto">
      <div className="font-mono text-lg md:text-xl leading-relaxed">
        {segmentStates.map((state, i) => {
          const { segment, phase, typedText } = state;
          const isCurrent = i === activeSegmentIndex;
          const isPast = i < activeSegmentIndex;

          if (segment.type === "text") {
            if (!typedText && !isPast) return null;
            return (
              <TypewriterText
                key={i}
                text={isPast ? segment.value : typedText}
                className="text-foreground/80"
              />
            );
          }

          if (segment.type === "blank") {
            return (
              <BlankInput
                key={i}
                placeholder={segment.placeholder}
                isActive={isCurrent && phase === "waiting_input"}
                value={values[segment.id]}
                onSubmit={(val) => fillValue(segment.id, val)}
              />
            );
          }

          if (segment.type === "choice") {
            return (
              <ChoicePills
                key={i}
                options={segment.options}
                isActive={isCurrent && phase === "waiting_input"}
                selectedValue={values[segment.id]}
                onSelect={(val) => fillValue(segment.id, val)}
              />
            );
          }

          return null;
        })}

        {/* Blinking cursor */}
        {isAnimating && (
          <motion.span
            animate={{ opacity: [1, 0] }}
            transition={{ duration: 0.6, repeat: Infinity }}
            className="inline-block w-0.5 h-5 bg-sky-accent ml-0.5 align-middle"
          />
        )}
      </div>

      {/* Submit button */}
      {isAllComplete && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mt-8 flex justify-end"
        >
          <Button onClick={handleSubmit} size="lg">
            <Sparkles className="w-4 h-4 mr-2" />
            Generate Report
          </Button>
        </motion.div>
      )}
    </GlassCard>
  );
}
