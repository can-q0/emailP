"use client";

import { useState, useEffect, useRef } from "react";

export interface PatientSuggestion {
  id: string;
  name: string;
  governmentId?: string;
  gender?: string;
  birthYear?: number;
  emailCount: number;
  metricCount: number;
}

export function usePatientSuggestions(query: string) {
  const [suggestions, setSuggestions] = useState<PatientSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);

    if (!query || query.trim().length < 1) {
      setSuggestions([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    timerRef.current = setTimeout(async () => {
      // Cancel previous request
      if (abortRef.current) abortRef.current.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      try {
        // Split query into firstName / lastName tokens for the search API
        const parts = query.trim().split(/\s+/);
        const params = new URLSearchParams();
        if (parts[0]) params.set("firstName", parts[0]);
        if (parts[1]) params.set("lastName", parts.slice(1).join(" "));

        const res = await fetch(`/api/search?${params.toString()}`, {
          signal: controller.signal,
        });

        if (!res.ok || controller.signal.aborted) {
          if (!controller.signal.aborted) setSuggestions([]);
          return;
        }

        const data = await res.json();

        if (controller.signal.aborted) return;

        // Map search API patient results to our format
        const patients: PatientSuggestion[] = (data.patients || []).map(
          (p: {
            id: string;
            name: string;
            governmentId?: string;
            gender?: string;
            birthYear?: number;
            emailCount: number;
            metricCount: number;
          }) => ({
            id: p.id,
            name: p.name,
            governmentId: p.governmentId,
            gender: p.gender,
            birthYear: p.birthYear,
            emailCount: p.emailCount || 0,
            metricCount: p.metricCount || 0,
          })
        );

        setSuggestions(patients);
      } catch (err: unknown) {
        if (err instanceof Error && err.name === "AbortError") return;
        setSuggestions([]);
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    }, 250);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [query]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortRef.current) abortRef.current.abort();
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return { suggestions, isLoading };
}
