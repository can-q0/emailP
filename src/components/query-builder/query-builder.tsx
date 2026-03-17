"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import { useQueryBuilder } from "@/hooks/useQueryBuilder";
import { usePatientSuggestions } from "@/hooks/usePatientSuggestions";
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
    segments,
    segmentStates,
    activeIndex,
    values,
    isAnimating,
    isAllComplete,
    fillValue,
    start,
  } = useQueryBuilder(template);

  const [patientInput, setPatientInput] = useState("");
  const { suggestions: patientSuggestions, isLoading: suggestionsLoading } = usePatientSuggestions(patientInput);

  const hasStarted = useRef(false);

  useEffect(() => {
    if (!hasStarted.current) {
      hasStarted.current = true;
      start(initialValues);
    }
  }, [start, initialValues]);

  // Reset on unmount so re-mount triggers start again
  useEffect(() => {
    return () => {
      hasStarted.current = false;
    };
  }, []);

  // Auto-fill format when "plain PDF" is selected (no format needed)
  const autoFilledRef = useRef(false);
  useEffect(() => {
    if (
      values.reportType === "plain PDF" &&
      !values.format &&
      !autoFilledRef.current
    ) {
      const formatSegmentIndex = segments.findIndex(
        (s) => s.type === "choice" && s.id === "format"
      );
      const formatState = segmentStates[formatSegmentIndex];
      if (formatState?.phase === "waiting_input") {
        autoFilledRef.current = true;
        fillValue("format", "detailed");
      }
    }
    if (values.reportType !== "plain PDF") {
      autoFilledRef.current = false;
    }
  }, [values, segments, segmentStates, fillValue]);

  const handleSubmit = useCallback(() => {
    onSubmit(values);
  }, [values, onSubmit]);

  return (
    <GlassCard className="p-8 md:p-12 max-w-3xl mx-auto">
      <div className="font-mono text-lg md:text-xl leading-relaxed tracking-wide">
        {segments.map((segment, i) => {
          const state = segmentStates[i];
          if (!state || state.phase === "hidden") return null;

          if (segment.type === "text") {
            return (
              <span key={i} className="text-foreground/80">
                {state.typedText}
              </span>
            );
          }

          if (segment.type === "blank") {
            const isPatientName = segment.id === "patientName";
            return (
              <BlankInput
                key={i}
                placeholder={segment.placeholder}
                isActive={state.phase === "waiting_input"}
                value={
                  state.phase === "completed" ? values[segment.id] : undefined
                }
                onSubmit={(val) => fillValue(segment.id, val)}
                suggestions={isPatientName ? patientSuggestions : undefined}
                onInputChange={isPatientName ? setPatientInput : undefined}
                suggestionsLoading={isPatientName ? suggestionsLoading : undefined}
              />
            );
          }

          if (segment.type === "choice") {
            return (
              <ChoicePills
                key={i}
                options={segment.options}
                isActive={state.phase === "waiting_input"}
                selectedValue={
                  state.phase === "completed" ? values[segment.id] : undefined
                }
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
            className="inline-block w-0.5 h-5 bg-primary ml-0.5 align-middle"
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
