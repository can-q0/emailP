export interface QueryTemplate {
  id: string;
  segments: QuerySegment[];
}

export type QuerySegment =
  | { type: "text"; value: string }
  | { type: "blank"; id: string; placeholder: string; kind: "text" }
  | { type: "choice"; id: string; options: string[]; kind: "choice" };

export interface QueryValues {
  [key: string]: string;
}

export interface PatientCandidate {
  id: string;
  name: string;
  governmentId?: string;
  email?: string;
  emailCount: number;
  lastEmailDate?: string;
}

export interface BloodMetricData {
  id: string;
  metricName: string;
  value: number;
  unit: string;
  referenceMin?: number;
  referenceMax?: number;
  isAbnormal: boolean;
  measuredAt: string;
}

export interface AttentionPoint {
  severity: "high" | "medium" | "low";
  title: string;
  description: string;
  relatedMetrics: string[];
  recommendations: string[];
}

export interface TrendReading {
  value: number;
  unit: string;
  measuredAt: string;
  isAbnormal: boolean;
}

export interface TrendAlert {
  metricName: string;
  displayName: string;
  direction: "worsening" | "improving";
  severity: "high" | "medium" | "low";
  type: "consecutive_worsening" | "rapid_change" | "persistent_abnormal";
  description: string;
  readings: TrendReading[];
  percentChange?: number;
}

export interface ReportData {
  id: string;
  title: string;
  summary?: string;
  attentionPoints?: AttentionPoint[];
  trendAlerts?: TrendAlert[];
  status: string;
  step?: string;
  reportType: string;
  format: string;
  comparisonDateA?: string;
  comparisonDateB?: string;
  patient: {
    id: string;
    name: string;
    governmentId?: string;
  };
  bloodMetrics: BloodMetricData[];
  emails: EmailData[];
  createdAt: string;
}

export interface EmailData {
  id: string;
  gmailMessageId: string;
  subject?: string;
  from?: string;
  date?: string;
  snippet?: string;
  body?: string;
  isLabReport: boolean;
  extractedData?: Record<string, unknown>;
}

// ── Progressive Search ───────────────────────────────────

export interface SearchFilters {
  firstName?: string;
  lastName?: string;
  year?: number;
  month?: number;
  labCode?: string;
  gender?: "Male" | "Female";
  birthYear?: number;
  metricQuery?: {
    metricName: string; // normalized English key
    operator?: "<" | ">" | "<=" | ">=" | "=";
    value?: number;
  };
}

export interface SearchResult {
  patients: PatientSearchResult[];
  emails: SearchEmailResult[];
  metrics: BloodMetricData[];
  stats: {
    totalEmails: number;
    totalMetrics: number;
    abnormalCount: number;
    uniquePatients: number;
    dateRange?: { from: string; to: string };
  };
}

export interface PatientSearchResult {
  id: string;
  name: string;
  governmentId?: string;
  gender?: string;
  birthYear?: number;
  emailCount: number;
  metricCount: number;
}

export interface SearchEmailResult {
  id: string;
  subject?: string;
  from?: string;
  date?: string;
  snippet?: string;
  pdfPath?: string;
  patientName?: string;
}
