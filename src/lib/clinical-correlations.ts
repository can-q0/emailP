import { normalizeMetricName, getAdjustedRange } from "@/lib/blood-metrics";
import type { ClinicalCorrelation } from "@/types";

// ── Clinical pattern definitions ────────────────────────
// Each pattern defines: which metrics to check, what thresholds trigger it,
// and what the clinical significance is. These are deterministic — no AI needed.

interface PatternRule {
  pattern: string;
  /** All metric keys that must be present (at least some with values) */
  requiredMetrics: string[];
  /** Function that checks the latest values and returns a correlation or null */
  evaluate: (
    latestValues: Map<string, { value: number; min: number; max: number; unit: string }>,
    age?: number | null,
    gender?: string | null
  ) => ClinicalCorrelation | null;
}

const CLINICAL_PATTERNS: PatternRule[] = [
  // ── Iron-deficiency anemia ──────────────────────────
  {
    pattern: "Iron-Deficiency Anemia",
    requiredMetrics: ["iron", "ferritin", "hemoglobin"],
    evaluate: (vals) => {
      const iron = vals.get("iron");
      const ferritin = vals.get("ferritin");
      const hb = vals.get("hemoglobin");
      if (!iron || !ferritin || !hb) return null;

      const ironLow = iron.value < iron.min;
      const ferritinLow = ferritin.value < ferritin.min;
      const hbLow = hb.value < hb.min;

      if (ironLow && ferritinLow && hbLow) {
        return {
          pattern: "Iron-Deficiency Anemia Pattern",
          severity: "high",
          description: `Iron (${iron.value} ${iron.unit}), Ferritin (${ferritin.value} ${ferritin.unit}), and Hemoglobin (${hb.value} ${hb.unit}) are all below reference range, consistent with iron-deficiency anemia.`,
          involvedMetrics: ["iron", "ferritin", "hemoglobin"],
          recommendation: "Evaluate for iron-deficiency anemia. Consider iron studies, reticulocyte count, and GI evaluation if clinically indicated.",
        };
      }
      if (ironLow && ferritinLow) {
        return {
          pattern: "Iron Depletion",
          severity: "medium",
          description: `Iron (${iron.value} ${iron.unit}) and Ferritin (${ferritin.value} ${ferritin.unit}) are below reference range. Hemoglobin is still within range but iron stores are depleted.`,
          involvedMetrics: ["iron", "ferritin", "hemoglobin"],
          recommendation: "Monitor hemoglobin closely. Consider dietary iron assessment and supplementation.",
        };
      }
      return null;
    },
  },

  // ── Diabetes / Pre-diabetes ─────────────────────────
  {
    pattern: "Diabetes Indicators",
    requiredMetrics: ["glucose", "hba1c"],
    evaluate: (vals) => {
      const glucose = vals.get("glucose");
      const hba1c = vals.get("hba1c");
      if (!glucose || !hba1c) return null;

      const glucoseHigh = glucose.value > 126;
      const hba1cHigh = hba1c.value > 6.5;
      const glucosePreDiabetic = glucose.value >= 100 && glucose.value <= 126;
      const hba1cPreDiabetic = hba1c.value >= 5.7 && hba1c.value <= 6.5;

      if (glucoseHigh && hba1cHigh) {
        return {
          pattern: "Diabetes Indicators",
          severity: "high",
          description: `Fasting glucose (${glucose.value} mg/dL) and HbA1c (${hba1c.value}%) both exceed diabetic thresholds (>126 mg/dL and >6.5% respectively).`,
          involvedMetrics: ["glucose", "hba1c"],
          recommendation: "Results are consistent with diabetes mellitus criteria. Confirm diagnosis and assess for complications. Consider referral to endocrinology.",
        };
      }
      if (glucosePreDiabetic && hba1cPreDiabetic) {
        return {
          pattern: "Pre-Diabetes Indicators",
          severity: "medium",
          description: `Fasting glucose (${glucose.value} mg/dL) and HbA1c (${hba1c.value}%) are in the pre-diabetic range (100-126 mg/dL and 5.7-6.5%).`,
          involvedMetrics: ["glucose", "hba1c"],
          recommendation: "Results suggest pre-diabetes. Lifestyle modifications (diet, exercise) and periodic monitoring recommended.",
        };
      }
      if (glucoseHigh || hba1cHigh) {
        return {
          pattern: "Elevated Glycemic Marker",
          severity: "medium",
          description: `${glucoseHigh ? `Fasting glucose (${glucose.value} mg/dL) exceeds 126 mg/dL` : `HbA1c (${hba1c.value}%) exceeds 6.5%`}. The other glycemic marker is within range — further evaluation recommended.`,
          involvedMetrics: ["glucose", "hba1c"],
          recommendation: "Repeat testing to confirm. Discordant glucose/HbA1c may indicate recent glycemic changes.",
        };
      }
      return null;
    },
  },

  // ── Hepatocellular injury ───────────────────────────
  {
    pattern: "Liver Injury",
    requiredMetrics: ["alt", "ast"],
    evaluate: (vals) => {
      const alt = vals.get("alt");
      const ast = vals.get("ast");
      if (!alt || !ast) return null;

      const altRatio = alt.value / alt.max;
      const astRatio = ast.value / ast.max;

      if (altRatio > 2 && astRatio > 2) {
        const ggt = vals.get("ggt");
        const bilirubin = vals.get("totalBilirubin");
        const extras: string[] = [];
        const involvedMetrics = ["alt", "ast"];

        if (ggt && ggt.value > ggt.max) {
          extras.push(`GGT elevated (${ggt.value} ${ggt.unit})`);
          involvedMetrics.push("ggt");
        }
        if (bilirubin && bilirubin.value > bilirubin.max) {
          extras.push(`Total Bilirubin elevated (${bilirubin.value} ${bilirubin.unit})`);
          involvedMetrics.push("totalBilirubin");
        }

        return {
          pattern: "Hepatocellular Injury Pattern",
          severity: "high",
          description: `ALT (${alt.value} ${alt.unit}, ${altRatio.toFixed(1)}x upper limit) and AST (${ast.value} ${ast.unit}, ${astRatio.toFixed(1)}x upper limit) are significantly elevated.${extras.length > 0 ? " " + extras.join(". ") + "." : ""}`,
          involvedMetrics,
          recommendation: "Evaluate for hepatocellular injury causes. Consider hepatitis panel, imaging, medication review, and alcohol history.",
        };
      }
      if (altRatio > 1 && astRatio > 1) {
        return {
          pattern: "Mild Liver Enzyme Elevation",
          severity: "low",
          description: `ALT (${alt.value} ${alt.unit}) and AST (${ast.value} ${ast.unit}) are mildly elevated above reference range.`,
          involvedMetrics: ["alt", "ast"],
          recommendation: "Monitor liver enzymes. Consider repeat testing in 4-6 weeks. Review medications and alcohol intake.",
        };
      }
      return null;
    },
  },

  // ── Thyroid dysfunction ─────────────────────────────
  {
    pattern: "Thyroid Dysfunction",
    requiredMetrics: ["tsh"],
    evaluate: (vals) => {
      const tsh = vals.get("tsh");
      if (!tsh) return null;

      const ft4 = vals.get("freeT4");
      const ft3 = vals.get("freeT3");
      const involvedMetrics = ["tsh"];
      if (ft4) involvedMetrics.push("freeT4");
      if (ft3) involvedMetrics.push("freeT3");

      // Hypothyroidism: high TSH
      if (tsh.value > tsh.max) {
        const ft4Low = ft4 && ft4.value < ft4.min;
        if (ft4Low) {
          return {
            pattern: "Primary Hypothyroidism Pattern",
            severity: "high",
            description: `TSH is elevated (${tsh.value} ${tsh.unit}) with low Free T4 (${ft4!.value} ${ft4!.unit}), consistent with primary hypothyroidism.`,
            involvedMetrics,
            recommendation: "Results suggest primary hypothyroidism. Consider thyroid antibody testing (Anti-TPO) and levothyroxine therapy evaluation.",
          };
        }
        return {
          pattern: "Subclinical Hypothyroidism",
          severity: "medium",
          description: `TSH is elevated (${tsh.value} ${tsh.unit})${ft4 ? ` with normal Free T4 (${ft4.value} ${ft4.unit})` : ""}, suggesting subclinical hypothyroidism.`,
          involvedMetrics,
          recommendation: "Monitor TSH and Free T4 in 6-8 weeks. Consider thyroid antibody testing.",
        };
      }

      // Hyperthyroidism: low TSH
      if (tsh.value < tsh.min) {
        const ft4High = ft4 && ft4.value > ft4.max;
        if (ft4High) {
          return {
            pattern: "Hyperthyroidism Pattern",
            severity: "high",
            description: `TSH is suppressed (${tsh.value} ${tsh.unit}) with elevated Free T4 (${ft4!.value} ${ft4!.unit}), consistent with hyperthyroidism.`,
            involvedMetrics,
            recommendation: "Results suggest hyperthyroidism. Consider thyroid antibody testing, imaging, and endocrinology referral.",
          };
        }
      }

      return null;
    },
  },

  // ── Cardiovascular risk ─────────────────────────────
  {
    pattern: "Cardiovascular Risk",
    requiredMetrics: ["totalCholesterol", "ldl", "hdl", "triglycerides"],
    evaluate: (vals) => {
      const tc = vals.get("totalCholesterol");
      const ldl = vals.get("ldl");
      const hdl = vals.get("hdl");
      const tg = vals.get("triglycerides");
      if (!tc && !ldl) return null;

      const risks: string[] = [];
      const involvedMetrics: string[] = [];

      if (tc && tc.value > 240) {
        risks.push(`Total Cholesterol very high (${tc.value} mg/dL)`);
        involvedMetrics.push("totalCholesterol");
      } else if (tc && tc.value > tc.max) {
        risks.push(`Total Cholesterol elevated (${tc.value} mg/dL)`);
        involvedMetrics.push("totalCholesterol");
      }

      if (ldl && ldl.value > 160) {
        risks.push(`LDL very high (${ldl.value} mg/dL)`);
        involvedMetrics.push("ldl");
      } else if (ldl && ldl.value > ldl.max) {
        risks.push(`LDL elevated (${ldl.value} mg/dL)`);
        involvedMetrics.push("ldl");
      }

      if (hdl && hdl.value < hdl.min) {
        risks.push(`HDL low (${hdl.value} mg/dL)`);
        involvedMetrics.push("hdl");
      }

      if (tg && tg.value > 200) {
        risks.push(`Triglycerides high (${tg.value} mg/dL)`);
        involvedMetrics.push("triglycerides");
      }

      if (risks.length >= 2) {
        const hasVeryHigh = (ldl && ldl.value > 160) || (tc && tc.value > 240);
        return {
          pattern: "Cardiovascular Risk Profile",
          severity: hasVeryHigh ? "high" : "medium",
          description: `Multiple lipid abnormalities detected: ${risks.join("; ")}.`,
          involvedMetrics,
          recommendation: "Assess overall cardiovascular risk (Framingham/ASCVD score). Consider lifestyle modifications and statin therapy evaluation.",
        };
      }

      return null;
    },
  },

  // ── Kidney function ─────────────────────────────────
  {
    pattern: "Kidney Function",
    requiredMetrics: ["bun", "creatinine"],
    evaluate: (vals) => {
      const bun = vals.get("bun");
      const creatinine = vals.get("creatinine");
      if (!bun || !creatinine) return null;

      const bunHigh = bun.value > bun.max;
      const creatinineHigh = creatinine.value > creatinine.max;

      if (bunHigh && creatinineHigh) {
        const creatRatio = creatinine.value / creatinine.max;
        return {
          pattern: "Renal Impairment Pattern",
          severity: creatRatio > 1.5 ? "high" : "medium",
          description: `BUN (${bun.value} ${bun.unit}) and Creatinine (${creatinine.value} ${creatinine.unit}) are both elevated, suggesting impaired kidney function.`,
          involvedMetrics: ["bun", "creatinine"],
          recommendation: "Calculate eGFR. Consider urinalysis, renal ultrasound, and nephrology referral if eGFR significantly reduced.",
        };
      }

      return null;
    },
  },

  // ── Vitamin deficiency cluster ──────────────────────
  {
    pattern: "Nutritional Deficiency",
    requiredMetrics: ["vitaminD", "vitaminB12"],
    evaluate: (vals) => {
      const vitD = vals.get("vitaminD");
      const vitB12 = vals.get("vitaminB12");
      const folate = vals.get("folate");
      const deficiencies: string[] = [];
      const involvedMetrics: string[] = [];

      if (vitD && vitD.value < vitD.min) {
        deficiencies.push(`Vitamin D (${vitD.value} ${vitD.unit})`);
        involvedMetrics.push("vitaminD");
      }
      if (vitB12 && vitB12.value < vitB12.min) {
        deficiencies.push(`Vitamin B12 (${vitB12.value} ${vitB12.unit})`);
        involvedMetrics.push("vitaminB12");
      }
      if (folate && folate.value < folate.min) {
        deficiencies.push(`Folate (${folate.value} ${folate.unit})`);
        involvedMetrics.push("folate");
      }

      if (deficiencies.length >= 2) {
        return {
          pattern: "Multiple Nutritional Deficiencies",
          severity: "medium",
          description: `Multiple vitamin deficiencies detected: ${deficiencies.join(", ")} are below reference range.`,
          involvedMetrics,
          recommendation: "Evaluate dietary intake and absorption. Consider supplementation and screening for malabsorption conditions.",
        };
      }

      return null;
    },
  },

  // ── Inflammation markers ────────────────────────────
  {
    pattern: "Systemic Inflammation",
    requiredMetrics: ["crp", "esr"],
    evaluate: (vals) => {
      const crp = vals.get("crp");
      const esr = vals.get("esr");
      const wbc = vals.get("wbc");
      if (!crp && !esr) return null;

      const crpHigh = crp && crp.value > crp.max;
      const esrHigh = esr && esr.value > esr.max;
      const wbcHigh = wbc && wbc.value > wbc.max;

      const markers: string[] = [];
      const involvedMetrics: string[] = [];
      if (crpHigh) { markers.push(`CRP (${crp!.value} ${crp!.unit})`); involvedMetrics.push("crp"); }
      if (esrHigh) { markers.push(`ESR (${esr!.value} ${esr!.unit})`); involvedMetrics.push("esr"); }
      if (wbcHigh) { markers.push(`WBC (${wbc!.value} ${wbc!.unit})`); involvedMetrics.push("wbc"); }

      if (markers.length >= 2) {
        const crpVeryHigh = crp && crp.value > 10;
        return {
          pattern: "Systemic Inflammation Pattern",
          severity: crpVeryHigh ? "high" : "medium",
          description: `Multiple inflammation markers elevated: ${markers.join(", ")}.`,
          involvedMetrics,
          recommendation: "Investigate source of inflammation. Consider infectious, autoimmune, and inflammatory differential diagnosis.",
        };
      }

      return null;
    },
  },
];

// ── Main detection function ─────────────────────────────

export function detectClinicalCorrelations(
  metrics: Array<{
    metricName: string;
    value: number;
    unit: string;
    referenceMin?: number;
    referenceMax?: number;
    isAbnormal: boolean;
  }>,
  age?: number | null,
  gender?: string | null
): ClinicalCorrelation[] {
  // Build a map of latest values per normalized metric
  const latestValues = new Map<string, { value: number; min: number; max: number; unit: string }>();

  for (const m of metrics) {
    const key = normalizeMetricName(m.metricName);
    const range = getAdjustedRange(key, age, gender);
    if (!range) continue;

    latestValues.set(key, {
      value: m.value,
      min: m.referenceMin ?? range.min,
      max: m.referenceMax ?? range.max,
      unit: m.unit,
    });
  }

  const correlations: ClinicalCorrelation[] = [];

  for (const rule of CLINICAL_PATTERNS) {
    // Check if at least 2 of the required metrics are present
    const presentCount = rule.requiredMetrics.filter((k) => latestValues.has(k)).length;
    if (presentCount < Math.min(2, rule.requiredMetrics.length)) continue;

    const result = rule.evaluate(latestValues, age, gender);
    if (result) {
      correlations.push(result);
    }
  }

  // Sort by severity
  const severityOrder = { high: 0, medium: 1, low: 2 };
  correlations.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  return correlations;
}
