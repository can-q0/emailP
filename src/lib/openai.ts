import OpenAI from "openai";
import { withRetry } from "@/lib/retry";
import { pLimit } from "@/lib/concurrency";

export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const limit = pLimit(5);

export async function classifyEmail(
  emailBody: string,
  subject: string
): Promise<{
  isLabReport: boolean;
  patientName?: string;
  governmentId?: string;
  testTypes?: string[];
}> {
  return withRetry(
    async () => {
      const response = await openai.chat.completions.create({
        model: "gpt-5",
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

export async function classifyEmailsBatch(
  emails: Array<{ id: string; body: string; subject: string }>
): Promise<
  Map<string, { isLabReport: boolean; patientName?: string; governmentId?: string }>
> {
  const results = new Map<
    string,
    { isLabReport: boolean; patientName?: string; governmentId?: string }
  >();

  const promises = emails.map((email) =>
    limit(async () => {
      const classification = await classifyEmail(email.body, email.subject);
      return { id: email.id, classification };
    })
  );

  const settled = await Promise.allSettled(promises);
  for (const result of settled) {
    if (result.status === "fulfilled") {
      results.set(result.value.id, result.value.classification);
    } else {
      console.error("[classifyEmailsBatch] partial failure:", result.reason);
    }
  }

  return results;
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
  return withRetry(
    async () => {
      const response = await openai.chat.completions.create({
        model: "gpt-5",
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
- Always use cells/μL or ×10³/μL for blood cell counts
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

Only include metrics that have clear numeric values. Do not guess or infer missing values.`,
          },
          {
            role: "user",
            content: emailBody.slice(0, 12000),
          },
        ],
      });

      const parsed = JSON.parse(response.choices[0].message.content || "{}");
      return parsed.metrics || [];
    },
    { attempts: 3, label: "extractBloodMetrics" }
  );
}

export async function extractBloodMetricsBatch(
  emails: Array<{ id: string; body: string }>
): Promise<
  Map<
    string,
    Array<{
      metricName: string;
      value: number;
      unit: string;
      referenceMin?: number;
      referenceMax?: number;
      isAbnormal: boolean;
    }>
  >
> {
  const results = new Map<
    string,
    Array<{
      metricName: string;
      value: number;
      unit: string;
      referenceMin?: number;
      referenceMax?: number;
      isAbnormal: boolean;
    }>
  >();

  const promises = emails.map((email) =>
    limit(async () => {
      const metrics = await extractBloodMetrics(email.body);
      return { id: email.id, metrics };
    })
  );

  const settled = await Promise.allSettled(promises);
  for (const result of settled) {
    if (result.status === "fulfilled") {
      results.set(result.value.id, result.value.metrics);
    } else {
      console.error("[extractBloodMetricsBatch] partial failure:", result.reason);
    }
  }

  return results;
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
  }>
): Promise<{
  summary: string;
  attentionPoints: Array<{
    severity: "high" | "medium" | "low";
    title: string;
    description: string;
    relatedMetrics: string[];
    recommendations: string[];
  }>;
}> {
  return withRetry(
    async () => {
      const response = await openai.chat.completions.create({
        model: "gpt-5",
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: `You are a senior clinical laboratory analyst writing a comprehensive patient health report. Based on the patient's lab results collected over time, generate BOTH a summary and attention points.

Summary guidelines:
- Write 2-4 paragraphs organized by body system (hematology, metabolic/liver, lipids/cardiovascular, endocrine/thyroid, nutritional/vitamins, renal, inflammatory markers).
- For each system, analyze trends over time: is the patient improving, worsening, or stable? Quantify changes where possible (e.g., "Hemoglobin improved from 10.2 to 12.8 g/dL over 6 months").
- Cross-reference related metrics to provide deeper insights:
  • Iron + Ferritin + Hemoglobin + MCV → iron-deficiency anemia assessment
  • Glucose + HbA1c → diabetes/pre-diabetes assessment
  • ALT + AST + GGT + Bilirubin → liver function assessment
  • TSH + FT3 + FT4 → thyroid function assessment
  • Total Cholesterol + HDL + LDL + Triglycerides → cardiovascular risk assessment
  • BUN + Creatinine → kidney function assessment
  • Calcium + Vitamin D + Phosphorus → bone health assessment
- Be professional, factual, and write in English.
- Do NOT provide diagnoses. Frame findings as observations for physician review.

Attention points guidelines:
- Generate 3-7 attention points, sorted by severity (high first).
- Severity classification:
  • HIGH: Values significantly outside reference range (>2x deviation), worsening trends over multiple tests, or dangerous metric combinations (e.g., very low hemoglobin + low ferritin + low iron).
  • MEDIUM: Values moderately outside reference range, mildly concerning trends, or borderline combinations worth monitoring.
  • LOW: Values slightly outside range but stable, single minor deviations, or general health optimization opportunities.
- Consider metric combinations, not just individual values in isolation.
- Recommendations should be specific and evidence-based (e.g., "Consider ferritin and iron studies follow-up in 3 months" rather than "Monitor blood levels").

Return JSON with:
1. "summary": string (the multi-paragraph summary)
2. "attentionPoints": array of objects, each with:
   - severity: "high" | "medium" | "low"
   - title: string (short, descriptive — e.g., "Progressive Iron Deficiency Anemia")
   - description: string (2-3 sentences explaining the finding with specific values and dates)
   - relatedMetrics: string[] (all metric names involved in this finding)
   - recommendations: string[] (1-3 specific, actionable recommendations)`,
          },
          {
            role: "user",
            content: `Patient: ${patientName}\n\nLab results:\n${emailSummaries.join("\n---\n")}\n\nExtracted metrics:\n${JSON.stringify(metrics, null, 2)}`,
          },
        ],
      });

      const parsed = JSON.parse(response.choices[0].message.content || "{}");
      return {
        summary: parsed.summary || "",
        attentionPoints: parsed.attentionPoints || [],
      };
    },
    { attempts: 3, label: "generateSummaryAndAttentionPoints" }
  );
}
