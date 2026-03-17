export interface AgeGenderRange {
  gender?: "Male" | "Female";
  ageMin?: number;
  ageMax?: number;
  min: number;
  max: number;
}

export interface MetricReference {
  name: string;
  trName: string;
  unit: string;
  min: number;
  max: number;
  category: string;
  trCategory: string;
  ranges?: AgeGenderRange[];
}

export const bloodMetricReferences: Record<string, MetricReference> = {
  hemoglobin: { name: "Hemoglobin", trName: "Hemoglobin", unit: "g/dL", min: 12.0, max: 17.5, category: "Complete Blood Count", trCategory: "Tam Kan Sayimi", ranges: [
    { gender: "Male", min: 13.5, max: 17.5 },
    { gender: "Female", min: 12.0, max: 15.5 },
    { gender: "Male", ageMin: 65, min: 12.6, max: 17.4 },
    { gender: "Female", ageMin: 65, min: 11.7, max: 15.5 },
  ] },
  hematocrit: { name: "Hematocrit", trName: "Hematokrit", unit: "%", min: 36, max: 51, category: "Complete Blood Count", trCategory: "Tam Kan Sayimi", ranges: [
    { gender: "Male", min: 38.3, max: 48.6 },
    { gender: "Female", min: 35.5, max: 44.9 },
  ] },
  rbc: { name: "Red Blood Cells", trName: "Eritrosit", unit: "M/uL", min: 4.0, max: 5.9, category: "Complete Blood Count", trCategory: "Tam Kan Sayimi", ranges: [
    { gender: "Male", min: 4.35, max: 5.65 },
    { gender: "Female", min: 3.92, max: 5.13 },
  ] },
  wbc: { name: "White Blood Cells", trName: "Lokosit", unit: "K/uL", min: 4.0, max: 11.0, category: "Complete Blood Count", trCategory: "Tam Kan Sayimi" },
  platelets: { name: "Platelets", trName: "Trombosit", unit: "K/uL", min: 150, max: 400, category: "Complete Blood Count", trCategory: "Tam Kan Sayimi" },
  mcv: { name: "MCV", trName: "MCV", unit: "fL", min: 80, max: 100, category: "Complete Blood Count", trCategory: "Tam Kan Sayimi" },
  mch: { name: "MCH", trName: "MCH", unit: "pg", min: 27, max: 33, category: "Complete Blood Count", trCategory: "Tam Kan Sayimi" },
  mchc: { name: "MCHC", trName: "MCHC", unit: "g/dL", min: 32, max: 36, category: "Complete Blood Count", trCategory: "Tam Kan Sayimi" },
  rdw: { name: "RDW", trName: "RDW", unit: "%", min: 11.5, max: 14.5, category: "Complete Blood Count", trCategory: "Tam Kan Sayimi", ranges: [
    { ageMin: 65, min: 11.7, max: 15.0 },
  ] },
  neutrophils: { name: "Neutrophils", trName: "Notrofil", unit: "%", min: 40, max: 70, category: "Complete Blood Count", trCategory: "Tam Kan Sayimi" },
  lymphocytes: { name: "Lymphocytes", trName: "Lenfosit", unit: "%", min: 20, max: 40, category: "Complete Blood Count", trCategory: "Tam Kan Sayimi" },
  monocytes: { name: "Monocytes", trName: "Monosit", unit: "%", min: 2, max: 8, category: "Complete Blood Count", trCategory: "Tam Kan Sayimi" },
  eosinophils: { name: "Eosinophils", trName: "Eozinofil", unit: "%", min: 1, max: 4, category: "Complete Blood Count", trCategory: "Tam Kan Sayimi" },
  basophils: { name: "Basophils", trName: "Bazofil", unit: "%", min: 0, max: 1, category: "Complete Blood Count", trCategory: "Tam Kan Sayimi" },
  glucose: { name: "Glucose (Fasting)", trName: "Aclik Kan Sekeri", unit: "mg/dL", min: 70, max: 100, category: "Metabolic Panel", trCategory: "Biyokimya" },
  bun: { name: "BUN", trName: "Ure", unit: "mg/dL", min: 7, max: 20, category: "Metabolic Panel", trCategory: "Biyokimya" },
  creatinine: { name: "Creatinine", trName: "Kreatinin", unit: "mg/dL", min: 0.6, max: 1.2, category: "Metabolic Panel", trCategory: "Biyokimya", ranges: [
    { gender: "Male", min: 0.74, max: 1.35 },
    { gender: "Female", min: 0.59, max: 1.04 },
  ] },
  sodium: { name: "Sodium", trName: "Sodyum", unit: "mEq/L", min: 136, max: 145, category: "Metabolic Panel", trCategory: "Biyokimya" },
  potassium: { name: "Potassium", trName: "Potasyum", unit: "mEq/L", min: 3.5, max: 5.1, category: "Metabolic Panel", trCategory: "Biyokimya" },
  chloride: { name: "Chloride", trName: "Klorur", unit: "mEq/L", min: 98, max: 106, category: "Metabolic Panel", trCategory: "Biyokimya" },
  calcium: { name: "Calcium", trName: "Kalsiyum", unit: "mg/dL", min: 8.5, max: 10.5, category: "Metabolic Panel", trCategory: "Biyokimya" },
  totalProtein: { name: "Total Protein", trName: "Total Protein", unit: "g/dL", min: 6.0, max: 8.3, category: "Metabolic Panel", trCategory: "Biyokimya" },
  albumin: { name: "Albumin", trName: "Albumin", unit: "g/dL", min: 3.5, max: 5.0, category: "Metabolic Panel", trCategory: "Biyokimya" },
  alt: { name: "ALT", trName: "ALT (SGPT)", unit: "U/L", min: 7, max: 56, category: "Liver Panel", trCategory: "Karaciger Paneli", ranges: [
    { gender: "Male", min: 7, max: 56 },
    { gender: "Female", min: 7, max: 45 },
  ] },
  ast: { name: "AST", trName: "AST (SGOT)", unit: "U/L", min: 10, max: 40, category: "Liver Panel", trCategory: "Karaciger Paneli", ranges: [
    { gender: "Male", min: 10, max: 40 },
    { gender: "Female", min: 9, max: 32 },
  ] },
  alp: { name: "ALP", trName: "ALP", unit: "U/L", min: 44, max: 147, category: "Liver Panel", trCategory: "Karaciger Paneli" },
  totalBilirubin: { name: "Total Bilirubin", trName: "Total Bilirubin", unit: "mg/dL", min: 0.1, max: 1.2, category: "Liver Panel", trCategory: "Karaciger Paneli" },
  directBilirubin: { name: "Direct Bilirubin", trName: "Direkt Bilirubin", unit: "mg/dL", min: 0, max: 0.3, category: "Liver Panel", trCategory: "Karaciger Paneli" },
  ggt: { name: "GGT", trName: "GGT", unit: "U/L", min: 9, max: 48, category: "Liver Panel", trCategory: "Karaciger Paneli", ranges: [
    { gender: "Male", min: 8, max: 61 },
    { gender: "Female", min: 5, max: 36 },
  ] },
  totalCholesterol: { name: "Total Cholesterol", trName: "Total Kolesterol", unit: "mg/dL", min: 0, max: 200, category: "Lipid Panel", trCategory: "Lipit Profili" },
  ldl: { name: "LDL", trName: "LDL Kolesterol", unit: "mg/dL", min: 0, max: 100, category: "Lipid Panel", trCategory: "Lipit Profili" },
  hdl: { name: "HDL", trName: "HDL Kolesterol", unit: "mg/dL", min: 40, max: 60, category: "Lipid Panel", trCategory: "Lipit Profili" },
  triglycerides: { name: "Triglycerides", trName: "Trigliserit", unit: "mg/dL", min: 0, max: 150, category: "Lipid Panel", trCategory: "Lipit Profili" },
  tsh: { name: "TSH", trName: "TSH", unit: "mIU/L", min: 0.4, max: 4.0, category: "Thyroid Panel", trCategory: "Tiroit Paneli" },
  freeT4: { name: "Free T4", trName: "Serbest T4", unit: "ng/dL", min: 0.8, max: 1.8, category: "Thyroid Panel", trCategory: "Tiroit Paneli" },
  freeT3: { name: "Free T3", trName: "Serbest T3", unit: "pg/mL", min: 2.3, max: 4.2, category: "Thyroid Panel", trCategory: "Tiroit Paneli" },
  vitaminD: { name: "Vitamin D", trName: "D Vitamini", unit: "ng/mL", min: 30, max: 100, category: "Vitamins", trCategory: "Vitaminler" },
  vitaminB12: { name: "Vitamin B12", trName: "B12 Vitamini", unit: "pg/mL", min: 200, max: 900, category: "Vitamins", trCategory: "Vitaminler" },
  ferritin: { name: "Ferritin", trName: "Ferritin", unit: "ng/mL", min: 12, max: 300, category: "Iron Studies", trCategory: "Demir Paneli", ranges: [
    { gender: "Male", min: 12, max: 300 },
    { gender: "Female", min: 12, max: 150 },
    { gender: "Female", ageMin: 50, min: 12, max: 263 },
  ] },
  iron: { name: "Iron", trName: "Demir", unit: "ug/dL", min: 60, max: 170, category: "Iron Studies", trCategory: "Demir Paneli", ranges: [
    { gender: "Male", min: 65, max: 176 },
    { gender: "Female", min: 50, max: 170 },
  ] },
  tibc: { name: "TIBC", trName: "TDBK", unit: "ug/dL", min: 250, max: 370, category: "Iron Studies", trCategory: "Demir Paneli" },
  hba1c: { name: "HbA1c", trName: "HbA1c", unit: "%", min: 4.0, max: 5.6, category: "Diabetes", trCategory: "Diyabet" },
  esr: { name: "ESR", trName: "Sedimentasyon", unit: "mm/hr", min: 0, max: 20, category: "Inflammation", trCategory: "Inflamasyon", ranges: [
    { gender: "Male", ageMax: 50, min: 0, max: 15 },
    { gender: "Male", ageMin: 50, min: 0, max: 20 },
    { gender: "Female", ageMax: 50, min: 0, max: 20 },
    { gender: "Female", ageMin: 50, min: 0, max: 30 },
  ] },
  crp: { name: "CRP", trName: "CRP", unit: "mg/L", min: 0, max: 3, category: "Inflammation", trCategory: "Inflamasyon" },
  procalcitonin: { name: "Procalcitonin", trName: "Prokalsitonin", unit: "ng/mL", min: 0, max: 0.5, category: "Inflammation", trCategory: "Inflamasyon" },
  antiTPO: { name: "Anti-TPO", trName: "Anti-TPO", unit: "IU/mL", min: 0, max: 35, category: "Thyroid Panel", trCategory: "Tiroit Paneli" },
};

export const metricCategories = [...new Set(Object.values(bloodMetricReferences).map((m) => m.category))];

// ── Language helpers ─────────────────────────────────────

export function getMetricDisplayName(metricKey: string, language: string = "en"): string {
  const ref = bloodMetricReferences[metricKey];
  if (!ref) return metricKey;
  return language === "tr" ? ref.trName : ref.name;
}

export function getCategoryDisplayName(category: string, language: string = "en"): string {
  if (language !== "tr") return category;
  // Find any metric with this category to get the Turkish name
  const entry = Object.values(bloodMetricReferences).find((m) => m.category === category);
  return entry?.trCategory ?? category;
}
