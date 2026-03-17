export type LayoutStructure =
  | "single-column"
  | "single-column-sidebar"
  | "two-column"
  | "dashboard-grid";

export type LayoutSpacing = "compact" | "normal" | "spacious";

export type SummaryVariant = "default" | "compact" | "comparison";
export type MetricsVariant =
  | "default"
  | "mini"
  | "sparklines"
  | "grid"
  | "delta"
  | "comparison"
  | "comparison-grid";
export type AttentionVariant = "default" | "compact" | "list" | "badges" | "grid";
export type EmailsVariant = "default" | "table" | "detailed" | "compact" | "comparison";

export type SectionId = "summary" | "metrics" | "attention" | "emails";

export interface SectionConfig {
  id: SectionId;
  label: string;
  variant: string;
}

export interface LayoutConfig {
  structure: LayoutStructure;
  spacing: LayoutSpacing;
  showSidebarNav: boolean;
  sections: SectionConfig[];
}

type LayoutKey = `${string}:${string}`;

function key(reportType: string, format: string): LayoutKey {
  return `${reportType}:${format}`;
}

const layoutMap: Record<LayoutKey, LayoutConfig> = {
  // ── all emails ──────────────────────────────────────────
  [key("all emails", "summary")]: {
    structure: "single-column",
    spacing: "compact",
    showSidebarNav: false,
    sections: [
      { id: "summary", label: "Summary", variant: "compact" },
      { id: "emails", label: "Emails", variant: "table" },
    ],
  },
  [key("all emails", "detailed")]: {
    structure: "single-column-sidebar",
    spacing: "normal",
    showSidebarNav: true,
    sections: [
      { id: "emails", label: "Emails", variant: "detailed" },
      { id: "summary", label: "Summary", variant: "default" },
      { id: "attention", label: "Attention", variant: "list" },
    ],
  },
  [key("all emails", "graphical")]: {
    structure: "two-column",
    spacing: "normal",
    showSidebarNav: false,
    sections: [
      { id: "emails", label: "Emails", variant: "default" },
      { id: "metrics", label: "Metrics", variant: "sparklines" },
      { id: "attention", label: "Attention", variant: "badges" },
    ],
  },

  // ── detailed report ─────────────────────────────────────
  [key("detailed report", "summary")]: {
    structure: "single-column",
    spacing: "compact",
    showSidebarNav: false,
    sections: [
      { id: "summary", label: "Summary", variant: "default" },
      { id: "attention", label: "Attention", variant: "compact" },
      { id: "metrics", label: "Metrics", variant: "mini" },
    ],
  },
  [key("detailed report", "detailed")]: {
    structure: "single-column-sidebar",
    spacing: "spacious",
    showSidebarNav: true,
    sections: [
      { id: "summary", label: "Summary", variant: "default" },
      { id: "metrics", label: "Metrics", variant: "default" },
      { id: "attention", label: "Attention", variant: "default" },
      { id: "emails", label: "Emails", variant: "default" },
    ],
  },
  [key("detailed report", "graphical")]: {
    structure: "dashboard-grid",
    spacing: "normal",
    showSidebarNav: false,
    sections: [
      { id: "metrics", label: "Metrics", variant: "grid" },
      { id: "attention", label: "Attention", variant: "grid" },
      { id: "summary", label: "Summary", variant: "compact" },
      { id: "emails", label: "Emails", variant: "compact" },
    ],
  },

  // ── plain PDF ──────────────────────────────────────────
  [key("plain PDF", "summary")]: {
    structure: "single-column",
    spacing: "normal",
    showSidebarNav: false,
    sections: [
      { id: "emails", label: "Emails", variant: "detailed" },
    ],
  },
  [key("plain PDF", "detailed")]: {
    structure: "single-column",
    spacing: "normal",
    showSidebarNav: false,
    sections: [
      { id: "emails", label: "Emails", variant: "detailed" },
    ],
  },
  [key("plain PDF", "graphical")]: {
    structure: "single-column",
    spacing: "normal",
    showSidebarNav: false,
    sections: [
      { id: "emails", label: "Emails", variant: "detailed" },
    ],
  },

  // ── comparison ──────────────────────────────────────────
  [key("comparison", "summary")]: {
    structure: "single-column",
    spacing: "compact",
    showSidebarNav: false,
    sections: [
      { id: "summary", label: "Summary", variant: "comparison" },
      { id: "metrics", label: "Metrics", variant: "delta" },
      { id: "attention", label: "Attention", variant: "compact" },
    ],
  },
  [key("comparison", "detailed")]: {
    structure: "single-column-sidebar",
    spacing: "spacious",
    showSidebarNav: true,
    sections: [
      { id: "summary", label: "Summary", variant: "comparison" },
      { id: "metrics", label: "Metrics", variant: "comparison" },
      { id: "attention", label: "Attention", variant: "default" },
      { id: "emails", label: "Emails", variant: "comparison" },
    ],
  },
  [key("comparison", "graphical")]: {
    structure: "dashboard-grid",
    spacing: "normal",
    showSidebarNav: false,
    sections: [
      { id: "metrics", label: "Metrics", variant: "comparison-grid" },
      { id: "attention", label: "Attention", variant: "badges" },
      { id: "summary", label: "Summary", variant: "compact" },
      { id: "emails", label: "Emails", variant: "comparison" },
    ],
  },
};

const defaultLayout: LayoutConfig = layoutMap[key("detailed report", "detailed")];

export function getLayoutConfig(reportType: string, format: string): LayoutConfig {
  return layoutMap[key(reportType, format)] ?? defaultLayout;
}
