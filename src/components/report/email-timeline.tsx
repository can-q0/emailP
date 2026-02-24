"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { GlassCard } from "@/components/ui/glass-card";
import { EmailData } from "@/types";
import { Mail, ChevronDown, ChevronUp, FlaskConical } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

interface EmailTimelineProps {
  emails: EmailData[];
}

export function EmailTimeline({ emails }: EmailTimelineProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const sortedEmails = [...emails].sort(
    (a, b) =>
      new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime()
  );

  return (
    <section id="emails">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 rounded-xl bg-[#6B5B4D]/10">
          <Mail className="w-5 h-5 text-[#6B5B4D]" />
        </div>
        <h2 className="text-xl font-bold">Email Timeline</h2>
        <span className="text-sm text-text-muted">
          {emails.length} emails
        </span>
      </div>

      <div className="space-y-2">
        {sortedEmails.map((email, i) => {
          const isExpanded = expandedId === email.id;

          return (
            <motion.div
              key={email.id}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <GlassCard
                className={cn(
                  "transition-all cursor-pointer",
                  isExpanded && "border-primary/20"
                )}
                onClick={() => setExpandedId(isExpanded ? null : email.id)}
              >
                <div className="p-4 flex items-center gap-3">
                  <div
                    className={cn(
                      "p-1.5 rounded-lg",
                      email.isLabReport
                        ? "bg-severity-low/10"
                        : "bg-foreground/5"
                    )}
                  >
                    {email.isLabReport ? (
                      <FlaskConical className="w-4 h-4 text-severity-low" />
                    ) : (
                      <Mail className="w-4 h-4 text-text-muted" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium truncate text-sm">
                        {email.subject || "(no subject)"}
                      </p>
                      {email.isLabReport && (
                        <span className="px-1.5 py-0.5 rounded text-xs bg-severity-low/10 text-severity-low shrink-0">
                          Lab Report
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-text-muted mt-0.5">
                      <span className="truncate">{email.from}</span>
                      {email.date && (
                        <>
                          <span>•</span>
                          <span>
                            {format(new Date(email.date), "MMM d, yyyy")}
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  {isExpanded ? (
                    <ChevronUp className="w-4 h-4 text-text-muted shrink-0" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-text-muted shrink-0" />
                  )}
                </div>

                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="px-4 pb-4 border-t border-card-border pt-3">
                        <p className="text-sm text-text-secondary whitespace-pre-wrap max-h-60 overflow-y-auto">
                          {email.snippet || email.body?.slice(0, 500) || "No content"}
                        </p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </GlassCard>
            </motion.div>
          );
        })}
      </div>
    </section>
  );
}
