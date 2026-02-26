"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { GlassCard } from "@/components/ui/glass-card";
import { EmailData } from "@/types";
import { Mail, FlaskConical, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

interface EmailTimelineProps {
  emails: EmailData[];
}

export function EmailTimeline({ emails }: EmailTimelineProps) {
  const [selectedEmail, setSelectedEmail] = useState<EmailData | null>(null);

  const labEmails = emails.filter((e) => e.isLabReport);

  const sortedEmails = [...labEmails].sort(
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
          {sortedEmails.length} lab reports
        </span>
      </div>

      <div className="space-y-2">
        {sortedEmails.map((email, i) => (
          <motion.div
            key={email.id}
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
          >
            <GlassCard
              className="transition-all cursor-pointer hover:border-primary/20"
              onClick={() => setSelectedEmail(email)}
            >
              <div className="p-4 flex items-center gap-3">
                <div className="p-1.5 rounded-lg bg-severity-low/10">
                  <FlaskConical className="w-4 h-4 text-severity-low" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium truncate text-sm">
                      {email.subject || "(no subject)"}
                    </p>
                    <span className="px-1.5 py-0.5 rounded text-xs bg-severity-low/10 text-severity-low shrink-0">
                      Lab Report
                    </span>
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
              </div>
            </GlassCard>
          </motion.div>
        ))}
      </div>

      {/* Full Email Modal */}
      <AnimatePresence>
        {selectedEmail && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm"
            onClick={() => setSelectedEmail(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="bg-card border border-card-border rounded-2xl shadow-xl w-full max-w-2xl max-h-[80vh] mx-4 flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-start justify-between p-5 border-b border-card-border">
                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold text-base truncate">
                    {selectedEmail.subject || "(no subject)"}
                  </h3>
                  <div className="flex items-center gap-2 text-xs text-text-muted mt-1">
                    <span className="truncate">{selectedEmail.from}</span>
                    {selectedEmail.date && (
                      <>
                        <span>•</span>
                        <span>
                          {format(
                            new Date(selectedEmail.date),
                            "MMM d, yyyy HH:mm"
                          )}
                        </span>
                      </>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => setSelectedEmail(null)}
                  className="p-1 rounded-lg hover:bg-secondary/50 text-text-muted shrink-0 ml-3"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Body */}
              <div className="p-5 overflow-y-auto">
                <p className="text-sm text-text-secondary whitespace-pre-wrap">
                  {selectedEmail.body || "No content"}
                </p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
