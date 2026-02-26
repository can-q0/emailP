export interface MetricReference {
  name: string;
  unit: string;
  min: number;
  max: number;
  category: string;
}

export const bloodMetricReferences: Record<string, MetricReference> = {
  hemoglobin: { name: "Hemoglobin", unit: "g/dL", min: 12.0, max: 17.5, category: "Complete Blood Count" },
  hematocrit: { name: "Hematocrit", unit: "%", min: 36, max: 51, category: "Complete Blood Count" },
  rbc: { name: "Red Blood Cells", unit: "M/uL", min: 4.0, max: 5.9, category: "Complete Blood Count" },
  wbc: { name: "White Blood Cells", unit: "K/uL", min: 4.0, max: 11.0, category: "Complete Blood Count" },
  platelets: { name: "Platelets", unit: "K/uL", min: 150, max: 400, category: "Complete Blood Count" },
  mcv: { name: "MCV", unit: "fL", min: 80, max: 100, category: "Complete Blood Count" },
  mch: { name: "MCH", unit: "pg", min: 27, max: 33, category: "Complete Blood Count" },
  mchc: { name: "MCHC", unit: "g/dL", min: 32, max: 36, category: "Complete Blood Count" },
  rdw: { name: "RDW", unit: "%", min: 11.5, max: 14.5, category: "Complete Blood Count" },
  neutrophils: { name: "Neutrophils", unit: "%", min: 40, max: 70, category: "Complete Blood Count" },
  lymphocytes: { name: "Lymphocytes", unit: "%", min: 20, max: 40, category: "Complete Blood Count" },
  monocytes: { name: "Monocytes", unit: "%", min: 2, max: 8, category: "Complete Blood Count" },
  eosinophils: { name: "Eosinophils", unit: "%", min: 1, max: 4, category: "Complete Blood Count" },
  basophils: { name: "Basophils", unit: "%", min: 0, max: 1, category: "Complete Blood Count" },
  glucose: { name: "Glucose (Fasting)", unit: "mg/dL", min: 70, max: 100, category: "Metabolic Panel" },
  bun: { name: "BUN", unit: "mg/dL", min: 7, max: 20, category: "Metabolic Panel" },
  creatinine: { name: "Creatinine", unit: "mg/dL", min: 0.6, max: 1.2, category: "Metabolic Panel" },
  sodium: { name: "Sodium", unit: "mEq/L", min: 136, max: 145, category: "Metabolic Panel" },
  potassium: { name: "Potassium", unit: "mEq/L", min: 3.5, max: 5.1, category: "Metabolic Panel" },
  chloride: { name: "Chloride", unit: "mEq/L", min: 98, max: 106, category: "Metabolic Panel" },
  calcium: { name: "Calcium", unit: "mg/dL", min: 8.5, max: 10.5, category: "Metabolic Panel" },
  totalProtein: { name: "Total Protein", unit: "g/dL", min: 6.0, max: 8.3, category: "Metabolic Panel" },
  albumin: { name: "Albumin", unit: "g/dL", min: 3.5, max: 5.0, category: "Metabolic Panel" },
  alt: { name: "ALT", unit: "U/L", min: 7, max: 56, category: "Liver Panel" },
  ast: { name: "AST", unit: "U/L", min: 10, max: 40, category: "Liver Panel" },
  alp: { name: "ALP", unit: "U/L", min: 44, max: 147, category: "Liver Panel" },
  totalBilirubin: { name: "Total Bilirubin", unit: "mg/dL", min: 0.1, max: 1.2, category: "Liver Panel" },
  directBilirubin: { name: "Direct Bilirubin", unit: "mg/dL", min: 0, max: 0.3, category: "Liver Panel" },
  ggt: { name: "GGT", unit: "U/L", min: 9, max: 48, category: "Liver Panel" },
  totalCholesterol: { name: "Total Cholesterol", unit: "mg/dL", min: 0, max: 200, category: "Lipid Panel" },
  ldl: { name: "LDL", unit: "mg/dL", min: 0, max: 100, category: "Lipid Panel" },
  hdl: { name: "HDL", unit: "mg/dL", min: 40, max: 60, category: "Lipid Panel" },
  triglycerides: { name: "Triglycerides", unit: "mg/dL", min: 0, max: 150, category: "Lipid Panel" },
  tsh: { name: "TSH", unit: "mIU/L", min: 0.4, max: 4.0, category: "Thyroid Panel" },
  freeT4: { name: "Free T4", unit: "ng/dL", min: 0.8, max: 1.8, category: "Thyroid Panel" },
  freeT3: { name: "Free T3", unit: "pg/mL", min: 2.3, max: 4.2, category: "Thyroid Panel" },
  vitaminD: { name: "Vitamin D", unit: "ng/mL", min: 30, max: 100, category: "Vitamins" },
  vitaminB12: { name: "Vitamin B12", unit: "pg/mL", min: 200, max: 900, category: "Vitamins" },
  ferritin: { name: "Ferritin", unit: "ng/mL", min: 12, max: 300, category: "Iron Studies" },
  iron: { name: "Iron", unit: "ug/dL", min: 60, max: 170, category: "Iron Studies" },
  tibc: { name: "TIBC", unit: "ug/dL", min: 250, max: 370, category: "Iron Studies" },
  hba1c: { name: "HbA1c", unit: "%", min: 4.0, max: 5.6, category: "Diabetes" },
  esr: { name: "ESR", unit: "mm/hr", min: 0, max: 20, category: "Inflammation" },
  crp: { name: "CRP", unit: "mg/L", min: 0, max: 3, category: "Inflammation" },
  procalcitonin: { name: "Procalcitonin", unit: "ng/mL", min: 0, max: 0.5, category: "Inflammation" },
  antiTPO: { name: "Anti-TPO", unit: "IU/mL", min: 0, max: 35, category: "Thyroid Panel" },
};

export const metricCategories = [...new Set(Object.values(bloodMetricReferences).map((m) => m.category))];
