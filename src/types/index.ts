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

export interface ReportData {
  id: string;
  title: string;
  summary?: string;
  attentionPoints?: AttentionPoint[];
  status: string;
  step?: string;
  reportType: string;
  format: string;
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
