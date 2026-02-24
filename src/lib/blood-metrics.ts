import { bloodMetricReferences, MetricReference } from "@/config/blood-metrics";

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
  "free t3": "freeT3",
  ft3: "freeT3",
  "vitamin d": "vitaminD",
  "25-oh vitamin d": "vitaminD",
  "vitamin b12": "vitaminB12",
  b12: "vitaminB12",
  ferritin: "ferritin",
  iron: "iron",
  tibc: "tibc",
  hba1c: "hba1c",
  "hemoglobin a1c": "hba1c",
  esr: "esr",
  "sedimentation rate": "esr",
  crp: "crp",
  "c-reactive protein": "crp",
};

export function normalizeMetricName(name: string): string {
  const lower = name.toLowerCase().trim();
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
