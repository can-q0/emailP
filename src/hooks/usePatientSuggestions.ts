"use client";

import { useState, useEffect, useRef } from "react";

interface PatientSuggestion {
  id: string;
  name: string;
  governmentId?: string;
  reportCount: number;
}

export function usePatientSuggestions(query: string) {
  const [suggestions, setSuggestions] = useState<PatientSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(null);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);

    if (!query || query.length < 1) {
      setSuggestions([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    timerRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/patients?q=${encodeURIComponent(query)}`);
        if (!res.ok) {
          setSuggestions([]);
          return;
        }
        const data = await res.json();
        setSuggestions(
          data.map((p: Record<string, unknown>) => ({
            id: p.id as string,
            name: p.name as string,
            governmentId: p.governmentId as string | undefined,
            reportCount: (p.reportCount as number) || 0,
          }))
        );
      } catch {
        setSuggestions([]);
      } finally {
        setIsLoading(false);
      }
    }, 200);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [query]);

  return { suggestions, isLoading };
}
