import OpenAI from "openai";
import { withRetry } from "@/lib/retry";
import { pLimit } from "@/lib/concurrency";

export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const limit = pLimit(5);

export async function classifyEmail(
  emailBody: string,
  subject: string,
  model: string = "gpt-5"
): Promise<{
  isLabReport: boolean;
  patientName?: string;
  governmentId?: string;
  testTypes?: string[];
}> {
  return withRetry(
    async () => {
      const response = await openai.chat.completions.create({
        model,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: `You are a medical email classifier specializing in laboratory test results. Analyze the email and determine if it contains lab test results or blood work reports. The emails may be in Turkish or English.

Classification criteria — mark as lab report ONLY if the email contains:
- Specific test names with numeric values and units (e.g., "Hemoglobin: 14.2 g/dL", "GLU: 95 mg/dL")
- Reference ranges alongside results
- Structured lab panels (CBC, metabolic panel, thyroid panel, lipid panel, etc.)

Common Turkish lab email formats to recognize:
- e-Nabız (e-Pulse) portal notifications with attached results
- Hospital portal emails (e.g., "Tahlil Sonuçlarınız", "Laboratuvar Sonuçları")
- Direct lab result emails with patient TC Kimlik No

Edge cases — do NOT classify as lab report:
- Appointment reminders or scheduling confirmations (even if they mention tests)
- Emails that only reference lab work without including actual numeric results
- Forwarded emails where only the forwarding note is present (no actual results)
- Insurance or billing documents related to lab tests

Return JSON with:
- isLabReport: boolean
- patientName: string or null (the patient's full name as it appears in the document)
- governmentId: string or null (Turkish TC Kimlik No - exactly 11 digits, or other government ID)
- testTypes: string[] (standardized test panel names, e.g. ["CBC", "Lipid Panel", "Thyroid Panel", "Metabolic Panel", "Urinalysis"])`,
          },
          {
            role: "user",
            content: `Subject: ${subject}\n\nBody:\n${emailBody.slice(0, 4000)}`,
          },
        ],
      });

      return JSON.parse(response.choices[0].message.content || "{}");
    },
    { attempts: 3, label: "classifyEmail" }
  );
}

const CLASSIFY_BATCH_SIZE = 10;

async function classifyEmailsChunk(
  emails: Array<{ id: string; body: string; subject: string }>,
  model: string = "gpt-5"
): Promise<
  Map<string, { isLabReport: boolean; patientName?: string; governmentId?: string }>
> {
  const emailList = emails
    .map(
      (e, i) =>
        `--- EMAIL ${i} (id: ${e.id}) ---\nSubject: ${e.subject}\n\n${e.body.slice(0, 2000)}`
    )
    .join("\n\n");

  const response = await openai.chat.completions.create({
    model,
    temperature: 1,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `You are a medical email classifier. You will receive multiple emails at once. Classify each one.

Mark as lab report ONLY if the email contains specific test names with numeric values/units, reference ranges, or structured lab panels.
Do NOT mark appointment reminders, billing, or emails without actual numeric results.

Return JSON with a "results" object keyed by email id. Each value has:
- isLabReport: boolean
- patientName: string or null
- governmentId: string or null (11-digit Turkish TC Kimlik No)
- testTypes: string[] (e.g. ["CBC", "Lipid Panel"])`,
      },
      {
        role: "user",
        content: emailList,
      },
    ],
  });

  const parsed = JSON.parse(response.choices[0].message.content || "{}");
  const map = new Map<
    string,
    { isLabReport: boolean; patientName?: string; governmentId?: string }
  >();

  const resultsObj = parsed.results || parsed;
  for (const email of emails) {
    const entry = resultsObj[email.id];
    if (entry) {
      map.set(email.id, entry);
    }
  }

  return map;
}

export async function classifyEmailsBatch(
  emails: Array<{ id: string; body: string; subject: string }>,
  model: string = "gpt-5"
): Promise<
  Map<string, { isLabReport: boolean; patientName?: string; governmentId?: string }>
> {
  const results = new Map<
    string,
    { isLabReport: boolean; patientName?: string; governmentId?: string }
  >();

  // Split into chunks of CLASSIFY_BATCH_SIZE
  const chunks: Array<typeof emails> = [];
  for (let i = 0; i < emails.length; i += CLASSIFY_BATCH_SIZE) {
    chunks.push(emails.slice(i, i + CLASSIFY_BATCH_SIZE));
  }

  const promises = chunks.map((chunk) =>
    limit(() => withRetry(() => classifyEmailsChunk(chunk, model), { attempts: 3, label: "classifyEmailsChunk" }))
  );

  const settled = await Promise.allSettled(promises);
  for (const result of settled) {
    if (result.status === "fulfilled") {
      for (const [id, classification] of result.value) {
        results.set(id, classification);
      }
    } else {
      console.error("[classifyEmailsBatch] chunk failure:", result.reason);
    }
  }

  return results;
}

export async function extractBloodMetrics(
  emailBody: string,
  model: string = "gpt-5"
): Promise<
  Array<{
    metricName: string;
    value: number;
    unit: string;
    referenceMin?: number;
    referenceMax?: number;
    isAbnormal: boolean;
    confidence: "high" | "medium" | "low";
  }>
> {
  return withRetry(
    async () => {
      const response = await openai.chat.completions.create({
        model,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: `You are a medical data extractor specializing in blood test results. Extract all blood test metrics from the email content. The content may be in Turkish — translate all metric names to standardized English.

Metric name standardization — always use these canonical names:
- HGB/Hb → "Hemoglobin"
- HCT/Htc → "Hematocrit"
- WBC/Lökosit → "White Blood Cell Count"
- RBC/Eritrosit → "Red Blood Cell Count"
- PLT/Trombosit → "Platelet Count"
- MCV → "Mean Corpuscular Volume"
- MCH → "Mean Corpuscular Hemoglobin"
- MCHC → "Mean Corpuscular Hemoglobin Concentration"
- RDW → "Red Cell Distribution Width"
- MPV → "Mean Platelet Volume"
- GLU/Glikoz/Açlık Kan Şekeri → "Glucose"
- BUN/Üre → "Blood Urea Nitrogen"
- CRE/Kreatinin → "Creatinine"
- ALT/SGPT → "Alanine Aminotransferase"
- AST/SGOT → "Aspartate Aminotransferase"
- GGT → "Gamma-Glutamyl Transferase"
- ALP → "Alkaline Phosphatase"
- T.BIL/Total Bilirubin → "Total Bilirubin"
- D.BIL/Direkt Bilirubin → "Direct Bilirubin"
- T.Protein/Total Protein → "Total Protein"
- ALB/Albümin → "Albumin"
- TC/Total Kolesterol → "Total Cholesterol"
- HDL → "HDL Cholesterol"
- LDL → "LDL Cholesterol"
- TG/Trigliserit → "Triglycerides"
- TSH → "Thyroid Stimulating Hormone"
- FT3/sT3 → "Free T3"
- FT4/sT4 → "Free T4"
- Fe/Demir → "Iron"
- TIBC → "Total Iron Binding Capacity"
- Ferritin/Ferritin → "Ferritin"
- B12/Vitamin B12 → "Vitamin B12"
- Folat/Folik Asit → "Folate"
- D Vitamini/25-OH Vitamin D → "Vitamin D"
- CRP → "C-Reactive Protein"
- Sedimantasyon/ESR → "Erythrocyte Sedimentation Rate"
- HbA1c → "Hemoglobin A1c"
- Na/Sodyum → "Sodium"
- K/Potasyum → "Potassium"
- Ca/Kalsiyum → "Calcium"
- Mg/Magnezyum → "Magnesium"
- P/Fosfor → "Phosphorus"
- Ürik Asit → "Uric Acid"
- PSA → "Prostate-Specific Antigen"

Unit normalization:
- Always use g/dL for hemoglobin (convert g/L by dividing by 10)
- Always use mg/dL for glucose, cholesterol, triglycerides, creatinine, BUN, uric acid
- Always use U/L for liver enzymes (ALT, AST, GGT, ALP)
- For RBC/Eritrosit: use ×10⁶/μL (M/μL) — store 5.5, NOT 5500000
- For WBC/Lökosit: use ×10³/μL (K/μL) — store 5.2, NOT 5200
- For Platelets/Trombosit: use ×10³/μL (K/μL) — store 198, NOT 198000
- IMPORTANT: Store values as displayed on the lab report, never expand to raw counts
- Always use mIU/L for TSH
- Always use ng/mL for ferritin, Vitamin D, Vitamin B12, PSA
- Always use mmol/L for sodium, potassium, calcium, magnesium

If duplicate metrics appear (e.g., same test repeated), include only the most recent value.

Return JSON with a "metrics" array where each item has:
- metricName: string (standardized English name from the mapping above)
- value: number
- unit: string (normalized unit)
- referenceMin: number or null
- referenceMax: number or null
- isAbnormal: boolean (true if outside reference range)
- confidence: "high" | "medium" | "low"
  • "high": value and unit are clearly stated in a structured lab format with no ambiguity
  • "medium": value is present but formatting is unusual, OCR artifacts possible, or unit had to be inferred
  • "low": value is partially legible, extracted from unstructured text, or unit conversion was uncertain

Only include metrics that have clear numeric values. Do not guess or infer missing values.`,
          },
          {
            role: "user",
            content: emailBody.slice(0, 6000),
          },
        ],
      });

      const parsed = JSON.parse(response.choices[0].message.content || "{}");
      return parsed.metrics || [];
    },
    { attempts: 3, label: "extractBloodMetrics" }
  );
}

type MetricResult = Array<{
  metricName: string;
  value: number;
  unit: string;
  referenceMin?: number;
  referenceMax?: number;
  isAbnormal: boolean;
  confidence: "high" | "medium" | "low";
}>;

const METRICS_BATCH_SIZE = 8;

async function extractBloodMetricsChunk(
  emails: Array<{ id: string; body: string }>
): Promise<Map<string, MetricResult>> {
  const emailList = emails
    .map(
      (e, i) =>
        `--- EMAIL ${i} (id: ${e.id}) ---\n${e.body.slice(0, 6000)}`
    )
    .join("\n\n");

  const response = await openai.chat.completions.create({
    model: "gpt-5-mini",
    temperature: 1,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `You are a medical data extractor specializing in blood test results. You will receive multiple emails at once. Extract all blood test metrics from each email. The content may be in Turkish — translate all metric names to standardized English.

Metric name standardization — always use these canonical names:
- HGB/Hb → "Hemoglobin"
- HCT/Htc → "Hematocrit"
- WBC/Lökosit → "White Blood Cell Count"
- RBC/Eritrosit → "Red Blood Cell Count"
- PLT/Trombosit → "Platelet Count"
- MCV → "Mean Corpuscular Volume"
- MCH → "Mean Corpuscular Hemoglobin"
- MCHC → "Mean Corpuscular Hemoglobin Concentration"
- RDW → "Red Cell Distribution Width"
- MPV → "Mean Platelet Volume"
- GLU/Glikoz/Açlık Kan Şekeri → "Glucose"
- BUN/Üre → "Blood Urea Nitrogen"
- CRE/Kreatinin → "Creatinine"
- ALT/SGPT → "Alanine Aminotransferase"
- AST/SGOT → "Aspartate Aminotransferase"
- GGT → "Gamma-Glutamyl Transferase"
- ALP → "Alkaline Phosphatase"
- T.BIL/Total Bilirubin → "Total Bilirubin"
- D.BIL/Direkt Bilirubin → "Direct Bilirubin"
- T.Protein/Total Protein → "Total Protein"
- ALB/Albümin → "Albumin"
- TC/Total Kolesterol → "Total Cholesterol"
- HDL → "HDL Cholesterol"
- LDL → "LDL Cholesterol"
- TG/Trigliserit → "Triglycerides"
- TSH → "Thyroid Stimulating Hormone"
- FT3/sT3 → "Free T3"
- FT4/sT4 → "Free T4"
- Fe/Demir → "Iron"
- TIBC → "Total Iron Binding Capacity"
- Ferritin/Ferritin → "Ferritin"
- B12/Vitamin B12 → "Vitamin B12"
- Folat/Folik Asit → "Folate"
- D Vitamini/25-OH Vitamin D → "Vitamin D"
- CRP → "C-Reactive Protein"
- Sedimantasyon/ESR → "Erythrocyte Sedimentation Rate"
- HbA1c → "Hemoglobin A1c"
- Na/Sodyum → "Sodium"
- K/Potasyum → "Potassium"
- Ca/Kalsiyum → "Calcium"
- Mg/Magnezyum → "Magnesium"
- P/Fosfor → "Phosphorus"
- Ürik Asit → "Uric Acid"
- PSA → "Prostate-Specific Antigen"

Unit normalization:
- Always use g/dL for hemoglobin (convert g/L by dividing by 10)
- Always use mg/dL for glucose, cholesterol, triglycerides, creatinine, BUN, uric acid
- Always use U/L for liver enzymes (ALT, AST, GGT, ALP)
- For RBC/Eritrosit: use ×10⁶/μL (M/μL) — store 5.5, NOT 5500000
- For WBC/Lökosit: use ×10³/μL (K/μL) — store 5.2, NOT 5200
- For Platelets/Trombosit: use ×10³/μL (K/μL) — store 198, NOT 198000
- IMPORTANT: Store values as displayed on the lab report, never expand to raw counts
- Always use mIU/L for TSH
- Always use ng/mL for ferritin, Vitamin D, Vitamin B12, PSA
- Always use mmol/L for sodium, potassium, calcium, magnesium

If duplicate metrics appear in the same email, include only the most recent value.

Return JSON with a "results" object keyed by email id. Each value is an array of metric objects with:
- metricName: string (standardized English name)
- value: number
- unit: string (normalized unit)
- referenceMin: number or null
- referenceMax: number or null
- isAbnormal: boolean (true if outside reference range)
- confidence: "high" | "medium" | "low"
  • "high": value and unit are clearly stated in a structured lab format
  • "medium": formatting is unusual, OCR artifacts possible, or unit inferred
  • "low": partially legible, extracted from unstructured text, or unit conversion uncertain

Only include metrics that have clear numeric values.`,
      },
      {
        role: "user",
        content: emailList,
      },
    ],
  });

  const parsed = JSON.parse(response.choices[0].message.content || "{}");
  const map = new Map<string, MetricResult>();

  const resultsObj = parsed.results || parsed;
  for (const email of emails) {
    const entry = resultsObj[email.id];
    if (entry) {
      map.set(email.id, Array.isArray(entry) ? entry : entry.metrics || []);
    }
  }

  return map;
}

export async function extractBloodMetricsBatch(
  emails: Array<{ id: string; body: string }>,
  _model?: string
): Promise<Map<string, MetricResult>> {
  // Single email — use the direct function (still useful for one-off calls)
  if (emails.length === 1) {
    const metrics = await extractBloodMetrics(emails[0].body);
    const map = new Map<string, MetricResult>();
    map.set(emails[0].id, metrics);
    return map;
  }

  const results = new Map<string, MetricResult>();

  // Split into chunks of METRICS_BATCH_SIZE
  const chunks: Array<typeof emails> = [];
  for (let i = 0; i < emails.length; i += METRICS_BATCH_SIZE) {
    chunks.push(emails.slice(i, i + METRICS_BATCH_SIZE));
  }

  const promises = chunks.map((chunk) =>
    limit(() => withRetry(() => extractBloodMetricsChunk(chunk), { attempts: 3, label: "extractBloodMetricsChunk" }))
  );

  const settled = await Promise.allSettled(promises);
  for (const result of settled) {
    if (result.status === "fulfilled") {
      for (const [id, metrics] of result.value) {
        results.set(id, metrics);
      }
    } else {
      console.error("[extractBloodMetricsBatch] chunk failure:", result.reason);
    }
  }

  return results;
}

function buildSummaryPrompt(
  reportType: string,
  format: string,
  language: string = "en",
  customSystemPrompt?: string | null
): string {
  // Base analysis instructions shared across all modes
  const crossReferenceInstructions = `Cross-reference related metrics to provide deeper insights:
  • Iron + Ferritin + Hemoglobin + MCV → iron-deficiency anemia assessment
  • Glucose + HbA1c → diabetes/pre-diabetes assessment
  • ALT + AST + GGT + Bilirubin → liver function assessment
  • TSH + FT3 + FT4 → thyroid function assessment
  • Total Cholesterol + HDL + LDL + Triglycerides → cardiovascular risk assessment
  • BUN + Creatinine → kidney function assessment
  • Calcium + Vitamin D + Phosphorus → bone health assessment`;

  // --- Report type instructions ---
  let reportTypeInstructions: string;

  if (reportType === "all emails") {
    reportTypeInstructions = `Report type: ALL EMAILS overview.
- List EVERY lab email chronologically with its date, subject, and key findings.
- For each email, note which metrics were included and highlight any abnormal values.
- After listing all emails, provide a brief overall trend summary (1 paragraph).
- This is an inventory-style report — completeness is more important than deep analysis.`;
  } else if (reportType === "comparison") {
    reportTypeInstructions = `Report type: COMPARISON across time points.
- Structure the summary as a comparison table/analysis between the selected test dates.
- The user may have selected specific dates for comparison — focus your analysis on those dates' results.
- For each metric that appears in multiple tests, show: earlier value → later value, and the direction of change (improved/worsened/stable) with percentage change.
- Group comparisons by body system.
- Highlight metrics with the most significant changes (both improvements and deteriorations).
- End with a 1-paragraph overall trajectory assessment.`;
  } else {
    // "detailed report" (default)
    reportTypeInstructions = `Report type: DETAILED clinical report.
- Write a CONCISE summary of 1-2 short paragraphs (max 150 words total). Focus only on the most clinically significant findings.
- Mention only abnormal metrics and notable trends — skip normal values entirely.
- Quantify key changes (e.g., "Hemoglobin improved from 10.2 to 12.8 g/dL over 6 months") but keep descriptions brief.
- ${crossReferenceInstructions}`;
  }

  // --- Format instructions ---
  let formatInstructions: string;

  if (format === "summary") {
    formatInstructions = `Output format: SUMMARY (concise).
- Keep the summary to 1-2 short paragraphs maximum.
- Only mention metrics that are abnormal or show significant trends.
- Be brief and to the point — this is for a quick overview.
- Generate only 2-4 attention points, focusing on the most critical findings.`;
  } else if (format === "graphical") {
    formatInstructions = `Output format: GRAPHICAL (chart-optimized).
- Keep the written summary to 1-2 paragraphs focusing on the most important trends.
- Focus attention points on metrics that show visual trends over time (changing values across multiple tests).
- For each attention point, always include specific numeric values and dates so charts can be cross-referenced.
- Prioritize metrics with multiple data points over single measurements.`;
  } else {
    // "detailed" (default)
    formatInstructions = `Output format: DETAILED (comprehensive).
- Provide thorough analysis with specific values, dates, and reference ranges.
- Generate 3-7 attention points covering all significant findings.
- Include specific, evidence-based recommendations.`;
  }

  return `You are a senior clinical laboratory analyst writing a patient health report. Based on the patient's lab results collected over time, generate BOTH a summary and attention points.

${reportTypeInstructions}

${formatInstructions}

General guidelines:
${language === "tr" ? `- Write the ENTIRE report in formal medical Turkish (hekim/uzman dili).
- Use Turkish medical terminology throughout: hasta (patient), değer (value), referans aralığı (reference range), yüksek/düşük (high/low), anormal (abnormal), patolojik (pathological), normal sınırlar içinde (within normal limits).
- Body system section names in Turkish: Hematoloji, Biyokimya, Karaciğer Fonksiyonları, Lipit Profili, Tiroit Fonksiyonları, Vitaminler, Demir Paneli, Diyabet, İnflamasyon Belirteçleri.
- Use Turkish metric equivalents: Lökosit (WBC), Eritrosit (RBC), Trombosit (PLT), Hemoglobin, Hematokrit, Açlık Kan Şekeri (Glucose), Üre (BUN), Kreatinin, Sodyum, Potasyum, Kalsiyum, Demir, Ferritin, D Vitamini, B12 Vitamini, Sedimentasyon (ESR), Serbest T3/T4, Total Kolesterol, Trigliserit.
- Format dates as DD.MM.YYYY and use decimal commas (e.g., 12,5 g/dL) where appropriate.
- Use professional physician-audience tone.` : `- Write in English.`}
- Be professional, factual.
- Do NOT provide diagnoses. Frame findings as observations for physician review.

Attention points guidelines:
- Severity classification:
  • HIGH: Values significantly outside reference range (>2x deviation), worsening trends over multiple tests, or dangerous metric combinations.
  • MEDIUM: Values moderately outside reference range, mildly concerning trends, or borderline combinations worth monitoring.
  • LOW: Values slightly outside range but stable, single minor deviations, or general health optimization opportunities.
- Consider metric combinations, not just individual values in isolation.
- Recommendations should be specific and evidence-based.

Return JSON with:
1. "summary": string (the report text)
2. "attentionPoints": array of objects, each with:
   - severity: "high" | "medium" | "low"
   - title: string (short, descriptive)
   - description: string (2-3 sentences explaining the finding with specific values and dates)
   - relatedMetrics: string[] (all metric names involved in this finding)
   - recommendations: string[] (1-3 specific, actionable recommendations)${customSystemPrompt ? `\n\nAdditional instructions from the user:\n${customSystemPrompt}` : ""}`;
}

// ── Chain-of-Verification: post-generation fact-check ───

async function verifySummary(
  summary: string,
  attentionPoints: Array<{
    severity: string;
    title: string;
    description: string;
    relatedMetrics: string[];
    recommendations: string[];
  }>,
  metrics: Array<{
    metricName: string;
    value: number;
    unit: string;
    isAbnormal: boolean;
    measuredAt: string;
  }>,
  model: string = "gpt-5"
): Promise<{
  summary: string;
  attentionPoints: typeof attentionPoints;
  corrections: string[];
}> {
  return withRetry(
    async () => {
      const response = await openai.chat.completions.create({
        model,
        temperature: 1,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: `You are a medical data verification specialist. Your job is to fact-check a generated lab report summary against the raw extracted metrics.

For each claim in the summary and attention points:
1. Verify that stated numeric values match the raw metrics data
2. Verify that trend descriptions (improving/worsening/stable) are supported by the data
3. Verify that severity assessments are proportional to actual deviations
4. Flag any statements not supported by the provided data

Return JSON with:
- "summary": the corrected summary (fix any inaccurate values or unsupported claims; keep unchanged if accurate)
- "attentionPoints": the corrected attention points array (same structure as input; fix inaccuracies, remove unsupported points)
- "corrections": string[] listing each correction made (empty array if no corrections needed)

IMPORTANT: Only correct factual errors. Do not change style, tone, or add new information not present in the data.`,
          },
          {
            role: "user",
            content: `Raw metrics data:\n${JSON.stringify(metrics, null, 2)}\n\nGenerated summary:\n${summary}\n\nGenerated attention points:\n${JSON.stringify(attentionPoints, null, 2)}`,
          },
        ],
      });

      const parsed = JSON.parse(response.choices[0].message.content || "{}");
      return {
        summary: parsed.summary || summary,
        attentionPoints: parsed.attentionPoints || attentionPoints,
        corrections: parsed.corrections || [],
      };
    },
    { attempts: 2, label: "verifySummary" }
  );
}

export async function generateSummaryAndAttentionPoints(
  patientName: string,
  emailSummaries: string[],
  metrics: Array<{
    metricName: string;
    value: number;
    unit: string;
    isAbnormal: boolean;
    measuredAt: string;
  }>,
  reportType: string = "detailed report",
  format: string = "detailed",
  options?: {
    model?: string;
    language?: string;
    customSystemPrompt?: string | null;
    trendAlerts?: Array<{
      metricName: string;
      displayName: string;
      direction: string;
      severity: string;
      type: string;
      description: string;
      percentChange?: number;
    }>;
    clinicalCorrelations?: Array<{
      pattern: string;
      severity: string;
      description: string;
      involvedMetrics: string[];
      recommendation: string;
    }>;
    verify?: boolean;
  }
): Promise<{
  summary: string;
  attentionPoints: Array<{
    severity: "high" | "medium" | "low";
    title: string;
    description: string;
    relatedMetrics: string[];
    recommendations: string[];
  }>;
  corrections?: string[];
}> {
  return withRetry(
    async () => {
      const systemPrompt = buildSummaryPrompt(
        reportType,
        format,
        options?.language,
        options?.customSystemPrompt
      );

      let userContent = `Patient: ${patientName}\n\nLab results:\n${emailSummaries.join("\n---\n")}\n\nExtracted metrics:\n${JSON.stringify(metrics, null, 2)}`;

      // Append detected trend alerts for richer AI analysis
      if (options?.trendAlerts && options.trendAlerts.length > 0) {
        const trendSection = options.trendAlerts.map((t) =>
          `- [${t.severity.toUpperCase()}] ${t.displayName}: ${t.description}${t.percentChange ? ` (${t.percentChange > 0 ? "+" : ""}${t.percentChange.toFixed(1)}%)` : ""}`
        ).join("\n");
        userContent += `\n\nDetected trends (use these for deeper analysis):\n${trendSection}`;
      }

      // Append deterministic clinical correlations
      if (options?.clinicalCorrelations && options.clinicalCorrelations.length > 0) {
        const corrSection = options.clinicalCorrelations.map((c) =>
          `- [${c.severity.toUpperCase()}] ${c.pattern}: ${c.description} (metrics: ${c.involvedMetrics.join(", ")})`
        ).join("\n");
        userContent += `\n\nDeterministic clinical correlations detected (incorporate these into your analysis — they are algorithmically verified):\n${corrSection}`;
      }

      const response = await openai.chat.completions.create({
        model: options?.model || "gpt-5-mini",
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: systemPrompt,
          },
          {
            role: "user",
            content: userContent,
          },
        ],
      });

      const parsed = JSON.parse(response.choices[0].message.content || "{}");
      let result = {
        summary: parsed.summary || "",
        attentionPoints: parsed.attentionPoints || [],
        corrections: undefined as string[] | undefined,
      };

      // Chain-of-Verification: second pass to fact-check the generated summary
      if (options?.verify !== false) {
        try {
          const verified = await verifySummary(
            result.summary,
            result.attentionPoints,
            metrics,
            options?.model || "gpt-5-mini"
          );
          result = {
            summary: verified.summary,
            attentionPoints: verified.attentionPoints as typeof result.attentionPoints,
            corrections: verified.corrections.length > 0 ? verified.corrections : undefined,
          };
          if (verified.corrections.length > 0) {
            console.log(`[verifySummary] ${verified.corrections.length} corrections applied:`, verified.corrections);
          }
        } catch (verifyError) {
          // Verification is non-critical — log and continue with unverified result
          console.warn("[verifySummary] Verification failed, using unverified result:", verifyError);
        }
      }

      return result;
    },
    { attempts: 3, label: "generateSummaryAndAttentionPoints" }
  );
}
