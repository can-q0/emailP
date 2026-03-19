"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { parseSearchTokens, getTokenLabels, type TokenLabel } from "@/lib/search-parser";
import type { SearchFilters, SearchResult } from "@/types";

const DEBOUNCE_MS = 250;
const SYNC_DEBOUNCE_MS = 800;

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

function buildPatientName(filters: SearchFilters): string | null {
  const parts = [filters.firstName, filters.lastName].filter(Boolean);
  return parts.length > 0 ? parts.join(" ") : null;
}

export function useProgressiveSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult>(EMPTY_RESULT);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const syncAbortRef = useRef<AbortController | null>(null);
  const lastSyncedQueryRef = useRef<string>("");

  // Parse tokens instantly (no debounce)
  const filters = useMemo(() => parseSearchTokens(query), [query]);
  const tokenLabels: TokenLabel[] = useMemo(() => getTokenLabels(filters), [filters]);

  const fetchResults = useCallback(async (f: SearchFilters, signal?: AbortSignal) => {
    // Need at least firstName
    if (!f.firstName) {
      setResults(EMPTY_RESULT);
      setIsLoading(false);
      return;
    }

    try {
      const params = filtersToParams(f);
      const res = await fetch(`/api/search?${params.toString()}`, { signal });

      if (!res.ok) throw new Error("Search failed");

      const data: SearchResult = await res.json();
      if (!signal?.aborted) {
        setResults(data);
        setIsLoading(false);
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") return;
      if (!signal?.aborted) {
        setError("Search failed. Please try again.");
        setIsLoading(false);
      }
    }
  }, []);

  // Background Gmail sync — runs after DB search, re-fetches results when done
  const backgroundSync = useCallback(async (f: SearchFilters) => {
    const name = buildPatientName(f);
    if (!name || name.length < 3) return;

    // Don't re-sync the same query
    if (lastSyncedQueryRef.current === name) return;

    // Cancel previous sync
    if (syncAbortRef.current) syncAbortRef.current.abort();
    const controller = new AbortController();
    syncAbortRef.current = controller;

    try {
      const res = await fetch("/api/gmail/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: name }),
        signal: controller.signal,
      });

      if (!res.ok || controller.signal.aborted) return;

      const data = await res.json();
      lastSyncedQueryRef.current = name;

      // If sync found new emails, re-fetch DB results to include them
      if (data.synced > 0 && !controller.signal.aborted) {
        await fetchResults(f, controller.signal);
      }
    } catch {
      // Silently ignore sync errors — DB results are already shown
    }
  }, [fetchResults]);

  // Debounced DB search (fast) + background Gmail sync (slower debounce)
  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (syncTimerRef.current) clearTimeout(syncTimerRef.current);

    // Cancel previous requests
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    if (!filters.firstName) {
      setResults(EMPTY_RESULT);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    // Fast DB search
    timerRef.current = setTimeout(() => {
      fetchResults(filters, controller.signal);
    }, DEBOUNCE_MS);

    // Slower background Gmail sync
    syncTimerRef.current = setTimeout(() => {
      backgroundSync(filters);
    }, SYNC_DEBOUNCE_MS);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    };
  }, [filters, fetchResults, backgroundSync]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortRef.current) abortRef.current.abort();
      if (syncAbortRef.current) syncAbortRef.current.abort();
      if (timerRef.current) clearTimeout(timerRef.current);
      if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
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
