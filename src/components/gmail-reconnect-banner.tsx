"use client";

import { signIn } from "next-auth/react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export function GmailReconnectBanner() {
  return (
    <div className="rounded-xl border border-severity-high/30 bg-severity-high/5 p-4 flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4 mb-6">
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <AlertTriangle className="w-5 h-5 text-severity-high shrink-0" />
        <div className="min-w-0">
          <p className="text-sm font-medium">Gmail connection expired</p>
          <p className="text-xs text-text-secondary mt-0.5">
            Your Google account access has expired. Reconnect to continue syncing emails.
          </p>
        </div>
      </div>
      <Button
        size="sm"
        className="w-full sm:w-auto shrink-0"
        onClick={() => signIn("google", { callbackUrl: window.location.pathname })}
      >
        Reconnect Gmail
      </Button>
    </div>
  );
}
