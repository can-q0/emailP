"use client";

import { useState, useEffect, useRef } from "react";

export interface PatientSuggestion {
  name: string;
  emailCount: number;
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
        const res = await fetch(`/api/patients/suggest?q=${encodeURIComponent(query)}`);
        if (!res.ok) {
          setSuggestions([]);
          return;
        }
        const data = await res.json();
        setSuggestions(
          data.map((p: Record<string, unknown>) => ({
            name: p.name as string,
            emailCount: (p.emailCount as number) || 0,
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
