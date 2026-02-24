import OpenAI from "openai";

export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function classifyEmail(
  emailBody: string,
  subject: string
): Promise<{
  isLabReport: boolean;
  patientName?: string;
  governmentId?: string;
  testTypes?: string[];
}> {
  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `You are a medical email classifier. Analyze the email and determine if it contains lab test results or blood work reports. The emails may be in Turkish or English.

Return JSON with:
- isLabReport: boolean
- patientName: string or null (the patient's full name)
- governmentId: string or null (Turkish TC Kimlik No - exactly 11 digits, or other government ID)
- testTypes: string[] (types of tests mentioned, e.g. ["CBC", "Lipid Panel", "Thyroid"])`,
      },
      {
        role: "user",
        content: `Subject: ${subject}\n\nBody:\n${emailBody.slice(0, 4000)}`,
      },
    ],
  });

  return JSON.parse(response.choices[0].message.content || "{}");
}

export async function extractBloodMetrics(
  emailBody: string
): Promise<
  Array<{
    metricName: string;
    value: number;
    unit: string;
    referenceMin?: number;
    referenceMax?: number;
    isAbnormal: boolean;
  }>
> {
  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `You are a medical data extractor. Extract all blood test metrics from the email content. The content may be in Turkish - translate metric names to standard English.

Return JSON with a "metrics" array where each item has:
- metricName: string (standardized English name, e.g. "Hemoglobin", "Glucose", "TSH")
- value: number
- unit: string
- referenceMin: number or null
- referenceMax: number or null
- isAbnormal: boolean (true if outside reference range)

Only include metrics that have clear numeric values.`,
      },
      {
        role: "user",
        content: emailBody.slice(0, 8000),
      },
    ],
  });

  const parsed = JSON.parse(response.choices[0].message.content || "{}");
  return parsed.metrics || [];
}

export async function generateSummary(
  patientName: string,
  emailSummaries: string[]
): Promise<string> {
  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content: `You are a medical report writer. Generate a 2-3 paragraph general summary of the patient's health based on their lab results over time. Be professional, clear, and highlight trends. Write in English.`,
      },
      {
        role: "user",
        content: `Patient: ${patientName}\n\nLab results over time:\n${emailSummaries.join("\n---\n")}`,
      },
    ],
  });

  return response.choices[0].message.content || "";
}

export async function generateAttentionPoints(
  patientName: string,
  metrics: Array<{ metricName: string; value: number; unit: string; isAbnormal: boolean; measuredAt: string }>,
  summary: string
): Promise<
  Array<{
    severity: "high" | "medium" | "low";
    title: string;
    description: string;
    relatedMetrics: string[];
    recommendations: string[];
  }>
> {
  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `You are a medical analyst. Based on the patient's blood metrics and summary, identify key attention points that a physician should review.

Return JSON with an "attentionPoints" array where each item has:
- severity: "high" | "medium" | "low"
- title: string (short, descriptive)
- description: string (2-3 sentences explaining the concern)
- relatedMetrics: string[] (metric names involved)
- recommendations: string[] (1-3 actionable recommendations)

Sort by severity (high first). Include 3-7 points.`,
      },
      {
        role: "user",
        content: `Patient: ${patientName}\n\nSummary: ${summary}\n\nMetrics:\n${JSON.stringify(metrics, null, 2)}`,
      },
    ],
  });

  const parsed = JSON.parse(response.choices[0].message.content || "{}");
  return parsed.attentionPoints || [];
}
