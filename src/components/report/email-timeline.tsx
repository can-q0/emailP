"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { GlassCard } from "@/components/ui/glass-card";
import { EmailData } from "@/types";
import { Mail, FlaskConical, X, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import type { EmailsVariant } from "@/config/report-layouts";

interface EmailTimelineProps {
  emails: EmailData[];
  variant?: EmailsVariant;
}

export function EmailTimeline({ emails, variant = "default" }: EmailTimelineProps) {
  const labEmails = emails.filter((e) => e.isLabReport);
  const sortedEmails = [...labEmails].sort(
    (a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime()
  );

  if (variant === "table") return <TableEmails emails={sortedEmails} />;
  if (variant === "detailed") return <DetailedEmails emails={sortedEmails} />;
  if (variant === "compact") return <CompactEmails emails={sortedEmails} />;
  if (variant === "comparison") return <ComparisonEmails emails={sortedEmails} />;
  return <DefaultEmails emails={sortedEmails} />;
}

// ── Section header ────────────────────────────────────────

function EmailsHeader({ count }: { count: number }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <div className="p-2 rounded-xl bg-[#6B5B4D]/10">
        <Mail className="w-5 h-5 text-[#6B5B4D]" />
      </div>
      <h2 className="text-xl font-bold">Email Timeline</h2>
      <span className="text-sm text-text-muted">{count} lab reports</span>
    </div>
  );
}

// ── Email detail modal (shared) ───────────────────────────

function EmailModal({
  email,
  onClose,
}: {
  email: EmailData | null;
  onClose: () => void;
}) {
  return (
    <AnimatePresence>
      {email && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="bg-card border border-card-border rounded-2xl shadow-xl w-full max-w-2xl max-h-[80vh] mx-4 flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between p-5 border-b border-card-border">
              <div className="min-w-0 flex-1">
                <h3 className="font-semibold text-base truncate">
                  {email.subject || "(no subject)"}
                </h3>
                <div className="flex items-center gap-2 text-xs text-text-muted mt-1">
                  <span className="truncate">{email.from}</span>
                  {email.date && (
                    <>
                      <span>•</span>
                      <span>{format(new Date(email.date), "MMM d, yyyy HH:mm")}</span>
                    </>
                  )}
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-1 rounded-lg hover:bg-secondary/50 text-text-muted shrink-0 ml-3"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 overflow-y-auto">
              <p className="text-sm text-text-secondary whitespace-pre-wrap">
                {email.body || "No content"}
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ── default ───────────────────────────────────────────────

function DefaultEmails({ emails }: { emails: EmailData[] }) {
  const [selectedEmail, setSelectedEmail] = useState<EmailData | null>(null);

  return (
    <section id="emails">
      <EmailsHeader count={emails.length} />
      <div className="space-y-2">
        {emails.map((email, i) => (
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
                        <span>{format(new Date(email.date), "MMM d, yyyy")}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </GlassCard>
          </motion.div>
        ))}
      </div>
      <EmailModal email={selectedEmail} onClose={() => setSelectedEmail(null)} />
    </section>
  );
}

// ── table ─────────────────────────────────────────────────

function TableEmails({ emails }: { emails: EmailData[] }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <section id="emails">
      <EmailsHeader count={emails.length} />
      <GlassCard className="overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-card-border bg-secondary/30">
              <th className="text-left p-3 font-medium text-text-muted">Date</th>
              <th className="text-left p-3 font-medium text-text-muted">Subject</th>
              <th className="text-left p-3 font-medium text-text-muted hidden md:table-cell">
                From
              </th>
            </tr>
          </thead>
          <tbody>
            {emails.map((email) => {
              const isExpanded = expandedId === email.id;
              return (
                <tr key={email.id} className="group">
                  <td
                    colSpan={3}
                    className="p-0"
                  >
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : email.id)}
                      className="w-full text-left cursor-pointer"
                    >
                      <div className={cn(
                        "flex items-center border-b border-card-border hover:bg-secondary/20 transition-colors",
                        isExpanded && "bg-secondary/20"
                      )}>
                        <span className="p-3 text-text-muted whitespace-nowrap w-28 shrink-0">
                          {email.date
                            ? format(new Date(email.date), "MMM d, yyyy")
                            : "–"}
                        </span>
                        <span className="p-3 truncate flex-1 font-medium">
                          {email.subject || "(no subject)"}
                        </span>
                        <span className="p-3 text-text-muted truncate hidden md:block max-w-[200px]">
                          {email.from}
                        </span>
                        <ChevronDown
                          className={cn(
                            "w-4 h-4 text-text-muted mr-3 transition-transform shrink-0",
                            isExpanded && "rotate-180"
                          )}
                        />
                      </div>
                    </button>
                    {isExpanded && (
                      <div className="p-4 bg-secondary/10 border-b border-card-border">
                        <p className="text-sm text-text-secondary whitespace-pre-wrap">
                          {email.body || "No content"}
                        </p>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </GlassCard>
    </section>
  );
}

// ── detailed ──────────────────────────────────────────────

function DetailedEmails({ emails }: { emails: EmailData[] }) {
  const [selectedEmail, setSelectedEmail] = useState<EmailData | null>(null);

  return (
    <section id="emails">
      <EmailsHeader count={emails.length} />
      <div className="space-y-2">
        {emails.map((email, i) => (
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
              <div className="p-4">
                <div className="flex items-center gap-3">
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
                          <span>{format(new Date(email.date), "MMM d, yyyy")}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                {/* Body snippet */}
                {email.body && (
                  <p className="text-xs text-text-muted mt-2 ml-10 line-clamp-2">
                    {email.body.slice(0, 150)}
                    {email.body.length > 150 ? "..." : ""}
                  </p>
                )}
              </div>
            </GlassCard>
          </motion.div>
        ))}
      </div>
      <EmailModal email={selectedEmail} onClose={() => setSelectedEmail(null)} />
    </section>
  );
}

// ── compact ───────────────────────────────────────────────

function CompactEmails({ emails }: { emails: EmailData[] }) {
  const [showAll, setShowAll] = useState(false);
  const [selectedEmail, setSelectedEmail] = useState<EmailData | null>(null);
  const displayed = showAll ? emails : emails.slice(0, 3);

  return (
    <section id="emails">
      <EmailsHeader count={emails.length} />
      <div className="space-y-2">
        {displayed.map((email, i) => (
          <GlassCard
            key={email.id}
            className="transition-all cursor-pointer hover:border-primary/20"
            onClick={() => setSelectedEmail(email)}
          >
            <div className="p-3 flex items-center gap-3">
              <div className="p-1.5 rounded-lg bg-severity-low/10">
                <FlaskConical className="w-3.5 h-3.5 text-severity-low" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate text-sm">
                  {email.subject || "(no subject)"}
                </p>
                <div className="flex items-center gap-2 text-xs text-text-muted mt-0.5">
                  {email.date && (
                    <span>{format(new Date(email.date), "MMM d, yyyy")}</span>
                  )}
                </div>
              </div>
            </div>
          </GlassCard>
        ))}
      </div>
      {!showAll && emails.length > 3 && (
        <button
          onClick={() => setShowAll(true)}
          className="mt-3 text-sm text-primary font-medium hover:underline cursor-pointer"
        >
          Show all ({emails.length})
        </button>
      )}
      <EmailModal email={selectedEmail} onClose={() => setSelectedEmail(null)} />
    </section>
  );
}

// ── comparison ────────────────────────────────────────────

function ComparisonEmails({ emails }: { emails: EmailData[] }) {
  const [selectedEmail, setSelectedEmail] = useState<EmailData | null>(null);

  if (emails.length < 2) {
    return <DefaultEmails emails={emails} />;
  }

  const latest = emails[0];
  const previous = emails[1];

  return (
    <section id="emails">
      <EmailsHeader count={emails.length} />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[
          { email: previous, label: "Previous" },
          { email: latest, label: "Latest" },
        ].map(({ email, label }) => (
          <GlassCard
            key={email.id}
            className="transition-all cursor-pointer hover:border-primary/20"
            onClick={() => setSelectedEmail(email)}
          >
            <div className="p-4">
              <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">
                {label}
              </span>
              <div className="mt-2 flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-severity-low/10">
                  <FlaskConical className="w-4 h-4 text-severity-low" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium truncate text-sm">
                    {email.subject || "(no subject)"}
                  </p>
                  <div className="flex items-center gap-2 text-xs text-text-muted mt-0.5">
                    <span className="truncate">{email.from}</span>
                    {email.date && (
                      <>
                        <span>•</span>
                        <span>{format(new Date(email.date), "MMM d, yyyy")}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
              {email.body && (
                <p className="text-xs text-text-muted mt-3 line-clamp-3">
                  {email.body.slice(0, 200)}
                  {email.body.length > 200 ? "..." : ""}
                </p>
              )}
            </div>
          </GlassCard>
        ))}
      </div>
      {emails.length > 2 && (
        <p className="text-xs text-text-muted mt-3">
          + {emails.length - 2} more email{emails.length > 3 ? "s" : ""}
        </p>
      )}
      <EmailModal email={selectedEmail} onClose={() => setSelectedEmail(null)} />
    </section>
  );
}
