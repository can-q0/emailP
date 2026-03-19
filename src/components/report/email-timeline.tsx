"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { GlassCard } from "@/components/ui/glass-card";
import { EmailData } from "@/types";
import { Mail, FlaskConical, X, ChevronDown, FileText, Paperclip } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import type { EmailsVariant } from "@/config/report-layouts";

interface EmailTimelineProps {
  emails: EmailData[];
  variant?: EmailsVariant;
  reportId?: string;
}

export function EmailTimeline({ emails, variant = "default", reportId }: EmailTimelineProps) {
  const [viewMode, setViewMode] = useState<"timeline" | "pdf">("timeline");
  const sortedEmails = [...emails].sort(
    (a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime()
  );
  const emailsWithPdf = sortedEmails.filter((e) => e.pdfPath);
  const hasPdfs = emailsWithPdf.length > 0;

  if (viewMode === "pdf" && hasPdfs) {
    return (
      <section id="emails">
        <EmailsHeader count={sortedEmails.length} viewMode={viewMode} onViewModeChange={setViewMode} hasPdfs={hasPdfs} />
        <GlassCard className="overflow-hidden">
          <div className="space-y-0">
            {emailsWithPdf.map((email, i) => (
              <div key={email.id}>
                {i > 0 && <div className="border-t border-card-border" />}
                <div className="px-4 py-2 bg-card-hover/30 flex items-center gap-2">
                  <Paperclip className="w-3.5 h-3.5 text-primary" />
                  <span className="text-xs font-medium truncate">{email.subject || "(no subject)"}</span>
                  {email.date && (
                    <span className="text-xs text-text-muted ml-auto shrink-0">
                      {format(new Date(email.date), "d MMM yyyy")}
                    </span>
                  )}
                </div>
                <iframe
                  src={`/api/emails/${email.id}/pdf`}
                  className="w-full bg-white"
                  style={{ height: "700px" }}
                  title={`PDF - ${email.subject}`}
                />
              </div>
            ))}
          </div>
        </GlassCard>
      </section>
    );
  }

  return (
    <section id="emails">
      <EmailsHeader count={sortedEmails.length} viewMode={viewMode} onViewModeChange={setViewMode} hasPdfs={hasPdfs} />
      {variant === "table" ? <TableEmailsContent emails={sortedEmails} />
        : variant === "detailed" ? <DetailedEmailsContent emails={sortedEmails} />
        : variant === "compact" ? <CompactEmailsContent emails={sortedEmails} />
        : variant === "comparison" ? <ComparisonEmailsContent emails={sortedEmails} />
        : <DefaultEmailsContent emails={sortedEmails} />}
    </section>
  );
}

// ── Section header ────────────────────────────────────────

function EmailsHeader({
  count,
  viewMode,
  onViewModeChange,
  hasPdfs,
}: {
  count: number;
  viewMode?: "timeline" | "pdf";
  onViewModeChange?: (mode: "timeline" | "pdf") => void;
  hasPdfs?: boolean;
}) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <div className="p-2 rounded-xl bg-[#6B5B4D]/10">
        <Mail className="w-5 h-5 text-[#6B5B4D]" />
      </div>
      <h2 className="text-xl font-bold">Email Timeline</h2>
      <span className="text-sm text-text-muted">{count} email{count !== 1 ? "s" : ""}</span>

      {hasPdfs && onViewModeChange && (
        <div className="ml-auto flex items-center rounded-lg border border-card-border overflow-hidden">
          <button
            onClick={() => onViewModeChange("timeline")}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer",
              viewMode === "timeline"
                ? "bg-primary text-white"
                : "text-text-secondary hover:text-foreground"
            )}
          >
            <FileText className="w-3.5 h-3.5" />
            Timeline
          </button>
          <button
            data-pdf-toggle
            onClick={() => onViewModeChange("pdf")}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer",
              viewMode === "pdf"
                ? "bg-primary text-white"
                : "text-text-secondary hover:text-foreground"
            )}
          >
            <Paperclip className="w-3.5 h-3.5" />
            PDF
          </button>
        </div>
      )}
    </div>
  );
}

// ── Email detail modal (shared) ───────────────────────────

function EmailModalContent({ email, onClose }: { email: EmailData; onClose: () => void }) {
  const [viewMode, setViewMode] = useState<"pdf" | "text">(email.pdfPath ? "pdf" : "text");
  const hasPdf = !!email.pdfPath;

  return (
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
        className={cn(
          "bg-card border border-card-border rounded-2xl shadow-xl w-full max-h-[85vh] mx-4 flex flex-col",
          viewMode === "pdf" ? "max-w-4xl" : "max-w-2xl"
        )}
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

          <div className="flex items-center gap-2 shrink-0 ml-3">
            {/* PDF / Text toggle */}
            {hasPdf && (
              <div className="flex items-center rounded-lg border border-card-border overflow-hidden">
                <button
                  onClick={() => setViewMode("pdf")}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer",
                    viewMode === "pdf"
                      ? "bg-primary text-white"
                      : "text-text-secondary hover:text-foreground"
                  )}
                >
                  <Paperclip className="w-3.5 h-3.5" />
                  PDF
                </button>
                <button
                  onClick={() => setViewMode("text")}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer",
                    viewMode === "text"
                      ? "bg-primary text-white"
                      : "text-text-secondary hover:text-foreground"
                  )}
                >
                  <FileText className="w-3.5 h-3.5" />
                  Text
                </button>
              </div>
            )}
            <button
              onClick={onClose}
              className="p-1 rounded-lg hover:bg-secondary/50 text-text-muted cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="overflow-y-auto flex-1 min-h-0">
          {viewMode === "pdf" && hasPdf ? (
            <iframe
              src={`/api/emails/${email.id}/pdf`}
              className="w-full bg-white"
              style={{ height: "calc(85vh - 80px)" }}
              title="PDF attachment"
            />
          ) : (
            <div className="p-5">
              <p className="text-sm text-text-secondary whitespace-pre-wrap leading-relaxed">
                {email.body || "No content"}
              </p>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

function EmailModal({
  email,
  onClose,
}: {
  email: EmailData | null;
  onClose: () => void;
}) {
  return (
    <AnimatePresence>
      {email && <EmailModalContent email={email} onClose={onClose} />}
    </AnimatePresence>
  );
}

// ── default ───────────────────────────────────────────────

function DefaultEmailsContent({ emails }: { emails: EmailData[] }) {
  const [selectedEmail, setSelectedEmail] = useState<EmailData | null>(null);

  return (
    <>
      <div className="relative">
        {/* Timeline line */}
        <div className="absolute left-5 top-0 bottom-0 w-px bg-card-border" />

        <div className="space-y-3">
          {emails.map((email, i) => (
            <motion.div
              key={email.id}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.06, duration: 0.3 }}
              className="relative pl-12"
            >
              {/* Timeline dot */}
              <div className="absolute left-3.5 top-5 w-3 h-3 rounded-full border-2 border-card bg-severity-low ring-2 ring-severity-low/20" />

              <GlassCard
                className="transition-all cursor-pointer hover:border-primary/20"
                onClick={() => setSelectedEmail(email)}
              >
                <div className="p-4">
                  {/* Date badge */}
                  {email.date && (
                    <span className="text-[11px] font-medium text-text-muted">
                      {format(new Date(email.date), "d MMM yyyy")}
                    </span>
                  )}
                  <div className="flex items-center gap-2 mt-1">
                    <p className="font-medium text-sm truncate flex-1">
                      {email.subject || "(no subject)"}
                    </p>
                    {email.pdfPath && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] bg-primary/10 text-primary font-medium shrink-0">
                        PDF
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-text-muted mt-1 truncate">
                    {email.from}
                  </p>
                  {email.body && (
                    <p className="text-xs text-text-secondary mt-2 line-clamp-2 leading-relaxed">
                      {email.body.slice(0, 150)}
                    </p>
                  )}
                </div>
              </GlassCard>
            </motion.div>
          ))}
        </div>
      </div>
      <EmailModal email={selectedEmail} onClose={() => setSelectedEmail(null)} />
    </>
  );
}

// ── table ─────────────────────────────────────────────────

function TableEmailsContent({ emails }: { emails: EmailData[] }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <>
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
    </>
  );
}

// ── detailed ──────────────────────────────────────────────

function DetailedEmailsContent({ emails }: { emails: EmailData[] }) {
  const [selectedEmail, setSelectedEmail] = useState<EmailData | null>(null);

  return (
    <>
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
    </>
  );
}

// ── compact ───────────────────────────────────────────────

function CompactEmailsContent({ emails }: { emails: EmailData[] }) {
  const [showAll, setShowAll] = useState(false);
  const [selectedEmail, setSelectedEmail] = useState<EmailData | null>(null);
  const displayed = showAll ? emails : emails.slice(0, 3);

  return (
    <>
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
    </>
  );
}

// ── comparison ────────────────────────────────────────────

function ComparisonEmailsContent({ emails }: { emails: EmailData[] }) {
  const [selectedEmail, setSelectedEmail] = useState<EmailData | null>(null);

  if (emails.length < 2) {
    return <DefaultEmailsContent emails={emails} />;
  }

  const latest = emails[0];
  const previous = emails[1];

  return (
    <>
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
    </>
  );
}
