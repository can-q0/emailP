"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { parseSearchTokens, getTokenLabels, type TokenLabel } from "@/lib/search-parser";
import type { SearchFilters, SearchResult } from "@/types";

const DEBOUNCE_MS = 250;

const EMPTY_RESULT: SearchResult = {
  patients: [],
  emails: [],
  metrics: [],
  stats: { totalEmails: 0, totalMetrics: 0, abnormalCount: 0, uniquePatients: 0 },
};

function filtersToParams(filters: SearchFilters): URLSearchParams {
  const params = new URLSearchParams();

  if (filters.firstName) params.set("firstName", filters.firstName);
  if (filters.lastName) params.set("lastName", filters.lastName);
  if (filters.year) params.set("year", String(filters.year));
  if (filters.month) params.set("month", String(filters.month));
  if (filters.labCode) params.set("labCode", filters.labCode);
  if (filters.gender) params.set("gender", filters.gender);
  if (filters.birthYear) params.set("birthYear", String(filters.birthYear));

  if (filters.metricQuery) {
    params.set("metricName", filters.metricQuery.metricName);
    if (filters.metricQuery.operator) {
      const opMap: Record<string, string> = {
        "<": "lt",
        ">": "gt",
        "<=": "lte",
        ">=": "gte",
        "=": "eq",
      };
      params.set("operator", opMap[filters.metricQuery.operator] || "eq");
    }
    if (filters.metricQuery.value !== undefined) {
      params.set("metricValue", String(filters.metricQuery.value));
    }
  }

  return params;
}

export function useProgressiveSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult>(EMPTY_RESULT);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Parse tokens instantly (no debounce)
  const filters = useMemo(() => parseSearchTokens(query), [query]);
  const tokenLabels: TokenLabel[] = useMemo(() => getTokenLabels(filters), [filters]);

  const fetchResults = useCallback(async (f: SearchFilters) => {
    // Cancel previous request
    if (abortRef.current) {
      abortRef.current.abort();
    }

    // Need at least firstName
    if (!f.firstName) {
      setResults(EMPTY_RESULT);
      setIsLoading(false);
      return;
    }

    const controller = new AbortController();
    abortRef.current = controller;
    setIsLoading(true);
    setError(null);

    try {
      const params = filtersToParams(f);
      const res = await fetch(`/api/search?${params.toString()}`, {
        signal: controller.signal,
      });

      if (!res.ok) {
        throw new Error("Search failed");
      }

      const data: SearchResult = await res.json();
      // Only update if this request wasn't aborted
      if (!controller.signal.aborted) {
        setResults(data);
        setIsLoading(false);
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") return;
      if (!controller.signal.aborted) {
        setError("Search failed. Please try again.");
        setIsLoading(false);
      }
    }
  }, []);

  // Debounced API call
  useEffect(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    timerRef.current = setTimeout(() => {
      fetchResults(filters);
    }, DEBOUNCE_MS);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [filters, fetchResults]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortRef.current) abortRef.current.abort();
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return {
    query,
    setQuery,
    filters,
    tokenLabels,
    results,
    isLoading,
    error,
  };
}
