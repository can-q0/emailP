"use client";

import { useState, useCallback, useRef } from "react";
import { QueryTemplate, QuerySegment, QueryValues } from "@/types";

type Phase = "typing" | "waiting_input" | "completed";

interface SegmentState {
  segment: QuerySegment;
  phase: Phase;
  typedText: string;
}

export function useQueryBuilder(template: QueryTemplate) {
  const [segmentStates, setSegmentStates] = useState<SegmentState[]>(() =>
    template.segments.map((segment) => ({
      segment,
      phase: "typing",
      typedText: "",
    }))
  );
  const [activeSegmentIndex, setActiveSegmentIndex] = useState(0);
  const [values, setValues] = useState<QueryValues>({});
  const [isAnimating, setIsAnimating] = useState(true);
  const [isAllComplete, setIsAllComplete] = useState(false);
  const typingTimerRef = useRef<NodeJS.Timeout | null>(null);

  const getCurrentSegment = useCallback(() => {
    return segmentStates[activeSegmentIndex];
  }, [segmentStates, activeSegmentIndex]);

  const advanceToNextSegment = useCallback(() => {
    const nextIndex = activeSegmentIndex + 1;
    if (nextIndex >= segmentStates.length) {
      setIsAnimating(false);
      setIsAllComplete(true);
      return;
    }
    setActiveSegmentIndex(nextIndex);
  }, [activeSegmentIndex, segmentStates.length]);

  const startTypingSegment = useCallback(
    (index: number) => {
      const state = segmentStates[index];
      if (!state) return;

      if (state.segment.type === "text") {
        const text = state.segment.value;
        let charIndex = 0;

        typingTimerRef.current = setInterval(() => {
          charIndex++;
          setSegmentStates((prev) => {
            const updated = [...prev];
            updated[index] = {
              ...updated[index],
              typedText: text.slice(0, charIndex),
            };
            return updated;
          });

          if (charIndex >= text.length) {
            if (typingTimerRef.current) clearInterval(typingTimerRef.current);
            // Move to next segment after text finishes typing
            const nextIdx = index + 1;
            if (nextIdx >= segmentStates.length) {
              setIsAnimating(false);
              setIsAllComplete(true);
            } else {
              setActiveSegmentIndex(nextIdx);
            }
          }
        }, 30);
      } else {
        // For blanks and choices, mark as waiting for input
        setSegmentStates((prev) => {
          const updated = [...prev];
          updated[index] = { ...updated[index], phase: "waiting_input" };
          return updated;
        });
        setIsAnimating(false);
      }
    },
    [segmentStates]
  );

  const fillValue = useCallback(
    (id: string, value: string) => {
      setValues((prev) => ({ ...prev, [id]: value }));

      // Mark current segment as completed
      setSegmentStates((prev) => {
        const updated = [...prev];
        const idx = updated.findIndex(
          (s) =>
            (s.segment.type === "blank" || s.segment.type === "choice") &&
            s.segment.id === id
        );
        if (idx !== -1) {
          updated[idx] = { ...updated[idx], phase: "completed", typedText: value };
        }
        return updated;
      });

      // Resume animation with next segment
      setIsAnimating(true);
      advanceToNextSegment();
    },
    [advanceToNextSegment]
  );

  // Start typing when activeSegmentIndex changes and we're animating
  const startAnimation = useCallback(() => {
    startTypingSegment(activeSegmentIndex);
  }, [activeSegmentIndex, startTypingSegment]);

  const reset = useCallback(() => {
    if (typingTimerRef.current) clearInterval(typingTimerRef.current);
    setSegmentStates(
      template.segments.map((segment) => ({
        segment,
        phase: "typing",
        typedText: "",
      }))
    );
    setActiveSegmentIndex(0);
    setValues({});
    setIsAnimating(true);
    setIsAllComplete(false);
  }, [template]);

  return {
    segmentStates,
    activeSegmentIndex,
    values,
    isAnimating,
    isAllComplete,
    getCurrentSegment,
    fillValue,
    startAnimation,
    reset,
  };
}
