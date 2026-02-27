"use client";

import { useState, useCallback } from "react";
import { EmailData } from "@/types";

export function useGmailSearch() {
  const [isSearching, setIsSearching] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [emails, setEmails] = useState<EmailData[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isTokenExpired, setIsTokenExpired] = useState(false);

  const searchAndSync = useCallback(
    async (patientName: string, dateFrom?: string, dateTo?: string) => {
      setIsSearching(true);
      setError(null);
      setIsTokenExpired(false);

      try {
        // Build Gmail query
        let query = patientName;
        if (dateFrom) query += ` after:${dateFrom}`;
        if (dateTo) query += ` before:${dateTo}`;

        // Sync emails
        setIsSyncing(true);
        const syncRes = await fetch("/api/gmail/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query, patientName }),
        });

        const syncData = await syncRes.json();

        if (syncData.error === "gmail_token_expired") {
          setIsTokenExpired(true);
          setIsSearching(false);
          setIsSyncing(false);
          return null;
        }

        if (!syncRes.ok) throw new Error("Failed to sync emails");

        setEmails(syncData.emails || []);
        setIsSyncing(false);
        setIsSearching(false);

        return syncData;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Search failed");
        setIsSearching(false);
        setIsSyncing(false);
        return null;
      }
    },
    []
  );

  return {
    isSearching,
    isSyncing,
    emails,
    error,
    isTokenExpired,
    searchAndSync,
  };
}
