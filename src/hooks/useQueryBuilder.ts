"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { QueryTemplate, QueryValues } from "@/types";

type Phase = "hidden" | "typing" | "waiting_input" | "completed";

interface SegmentState {
  phase: Phase;
  typedText: string;
}

export function useQueryBuilder(template: QueryTemplate) {
  const [segmentStates, setSegmentStates] = useState<SegmentState[]>(() =>
    template.segments.map(() => ({
      phase: "hidden" as Phase,
      typedText: "",
    }))
  );
  const [activeIndex, setActiveIndex] = useState(-1);
  const [values, setValues] = useState<QueryValues>({});
  const [isAllComplete, setIsAllComplete] = useState(false);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const activeRef = useRef(activeIndex);
  activeRef.current = activeIndex;

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const processSegment = useCallback(
    (index: number) => {
      if (index >= template.segments.length) {
        setIsAllComplete(true);
        return;
      }

      const segment = template.segments[index];
      setActiveIndex(index);

      if (segment.type === "text") {
        const text = segment.value;
        let charIdx = 0;

        setSegmentStates((prev) => {
          const next = [...prev];
          next[index] = { phase: "typing", typedText: "" };
          return next;
        });

        timerRef.current = setInterval(() => {
          charIdx++;
          const currentText = text.slice(0, charIdx);

          setSegmentStates((prev) => {
            const next = [...prev];
            next[index] = { phase: "typing", typedText: currentText };
            return next;
          });

          if (charIdx >= text.length) {
            if (timerRef.current) clearInterval(timerRef.current);
            timerRef.current = null;

            setSegmentStates((prev) => {
              const next = [...prev];
              next[index] = { phase: "completed", typedText: text };
              return next;
            });

            // Move to next segment
            processSegment(index + 1);
          }
        }, 30);
      } else {
        // blank or choice — wait for user input
        setSegmentStates((prev) => {
          const next = [...prev];
          next[index] = { phase: "waiting_input", typedText: "" };
          return next;
        });
      }
    },
    [template.segments]
  );

  const start = useCallback(
    (prefill?: Partial<QueryValues>) => {
      // Apply prefills
      if (prefill) {
        const defined = Object.fromEntries(
          Object.entries(prefill).filter(([, v]) => v !== undefined)
        ) as QueryValues;
        setValues((prev) => ({ ...prev, ...defined }));
      }

      // Find the first segment that isn't prefilled
      let startIdx = 0;
      const newStates = template.segments.map(() => ({
        phase: "hidden" as Phase,
        typedText: "",
      }));

      if (prefill) {
        for (let i = 0; i < template.segments.length; i++) {
          const seg = template.segments[i];
          if (seg.type === "text") {
            newStates[i] = { phase: "completed", typedText: seg.value };
            startIdx = i + 1;
          } else if (
            (seg.type === "blank" || seg.type === "choice") &&
            prefill[seg.id]
          ) {
            newStates[i] = {
              phase: "completed",
              typedText: prefill[seg.id]!,
            };
            startIdx = i + 1;
          } else {
            break;
          }
        }
      }

      setSegmentStates(newStates);
      processSegment(startIdx);
    },
    [template.segments, processSegment]
  );

  const fillValue = useCallback(
    (id: string, value: string) => {
      setValues((prev) => ({ ...prev, [id]: value }));

      const currentIdx = activeRef.current;
      setSegmentStates((prev) => {
        const next = [...prev];
        next[currentIdx] = { phase: "completed", typedText: value };
        return next;
      });

      // Continue to next segment
      processSegment(currentIdx + 1);
    },
    [processSegment]
  );

  const isAnimating =
    !isAllComplete &&
    activeIndex >= 0 &&
    activeIndex < template.segments.length &&
    template.segments[activeIndex]?.type === "text";

  return {
    segments: template.segments,
    segmentStates,
    activeIndex,
    values,
    isAnimating,
    isAllComplete,
    fillValue,
    start,
  };
}
