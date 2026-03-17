import { bloodMetricReferences, MetricReference, AgeGenderRange } from "@/config/blood-metrics";
import { trLower } from "@/lib/turkish";

// Normalize metric names to match our reference keys
const nameMap: Record<string, string> = {
  hb: "hemoglobin",
  hgb: "hemoglobin",
  hemoglobin: "hemoglobin",
  hct: "hematocrit",
  hematocrit: "hematocrit",
  "red blood cells": "rbc",
  rbc: "rbc",
  "white blood cells": "wbc",
  wbc: "wbc",
  platelets: "platelets",
  plt: "platelets",
  mcv: "mcv",
  mch: "mch",
  mchc: "mchc",
  rdw: "rdw",
  neutrophils: "neutrophils",
  lymphocytes: "lymphocytes",
  monocytes: "monocytes",
  eosinophils: "eosinophils",
  basophils: "basophils",
  glucose: "glucose",
  "fasting glucose": "glucose",
  bun: "bun",
  "blood urea nitrogen": "bun",
  creatinine: "creatinine",
  sodium: "sodium",
  na: "sodium",
  potassium: "potassium",
  k: "potassium",
  chloride: "chloride",
  cl: "chloride",
  calcium: "calcium",
  ca: "calcium",
  "total protein": "totalProtein",
  albumin: "albumin",
  alt: "alt",
  sgpt: "alt",
  ast: "ast",
  sgot: "ast",
  alp: "alp",
  "alkaline phosphatase": "alp",
  "total bilirubin": "totalBilirubin",
  bilirubin: "totalBilirubin",
  "direct bilirubin": "directBilirubin",
  ggt: "ggt",
  "total cholesterol": "totalCholesterol",
  cholesterol: "totalCholesterol",
  ldl: "ldl",
  hdl: "hdl",
  triglycerides: "triglycerides",
  tsh: "tsh",
  "free t4": "freeT4",
  ft4: "freeT4",
  "serbest t4": "freeT4",
  "free t3": "freeT3",
  ft3: "freeT3",
  "serbest t3": "freeT3",
  "vitamin d": "vitaminD",
  "25-oh vitamin d": "vitaminD",
  "vitamin b12": "vitaminB12",
  b12: "vitaminB12",
  ferritin: "ferritin",
  iron: "iron",
  "demir": "iron",
  "fe": "iron",
  tibc: "tibc",
  hba1c: "hba1c",
  "hemoglobin a1c": "hba1c",
  esr: "esr",
  "sedimentation rate": "esr",
  sedimentasyon: "esr",
  crp: "crp",
  "c-reactive protein": "crp",
  "ldl-c": "ldl",
  "hdl-c": "hdl",
  platelet: "platelets",
  "anti-tpo": "antiTPO",
  "prokalsitonin": "procalcitonin",
  procalcitonin: "procalcitonin",
  "neutrofil": "neutrophils",
  "neutrofil %": "neutrophils",
  "lenfosit": "lymphocytes",
  "lenfosit %": "lymphocytes",
};

export function normalizeMetricName(name: string): string {
  const lower = trLower(name).trim();
  return nameMap[lower] || lower;
}

export function getMetricReference(
  metricName: string
): MetricReference | undefined {
  const normalized = normalizeMetricName(metricName);
  return bloodMetricReferences[normalized];
}

export function isMetricAbnormal(
  value: number,
  metricName: string
): boolean {
  const ref = getMetricReference(metricName);
  if (!ref) return false;
  return value < ref.min || value > ref.max;
}

/**
 * Get age/gender-adjusted reference range for a metric.
 * Priority: gender+age match > gender-only match > age-only match > default.
 */
export function getAdjustedRange(
  metricName: string,
  age?: number | null,
  gender?: string | null
): { min: number; max: number } | undefined {
  const ref = getMetricReference(metricName);
  if (!ref) return undefined;

  if (!ref.ranges || ref.ranges.length === 0) {
    return { min: ref.min, max: ref.max };
  }

  let bestMatch: AgeGenderRange | undefined;
  let bestScore = -1;

  for (const r of ref.ranges) {
    let score = 0;
    let matches = true;

    // Check gender match
    if (r.gender) {
      if (gender && r.gender === gender) {
        score += 2;
      } else if (gender && r.gender !== gender) {
        matches = false;
      } else {
        // No gender provided, skip gender-specific ranges
        matches = false;
      }
    }

    // Check age match
    if (r.ageMin !== undefined || r.ageMax !== undefined) {
      if (age != null) {
        if (r.ageMin !== undefined && age < r.ageMin) matches = false;
        if (r.ageMax !== undefined && age > r.ageMax) matches = false;
        if (matches) score += 1;
      } else {
        // No age provided, skip age-specific ranges
        matches = false;
      }
    }

    if (matches && score > bestScore) {
      bestScore = score;
      bestMatch = r;
    }
  }

  if (bestMatch) {
    return { min: bestMatch.min, max: bestMatch.max };
  }
  return { min: ref.min, max: ref.max };
}

export function isMetricAbnormalAdjusted(
  value: number,
  metricName: string,
  age?: number | null,
  gender?: string | null
): boolean {
  const range = getAdjustedRange(metricName, age, gender);
  if (!range) return false;
  return value < range.min || value > range.max;
}

