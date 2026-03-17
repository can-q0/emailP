import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

const DEMO_PATIENTS = [
  {
    name: "Ayşe Yılmaz",
    governmentId: "12345678901",
    gender: "Female",
    birthYear: 1985,
    emails: [
      {
        subject: "Lab Sonuçları - Ayşe Yılmaz - 15.01.2026",
        from: "lab@orneklab.com",
        date: new Date("2026-01-15"),
        body: `Hasta: Ayşe Yılmaz\nTC: 12345678901\nTarih: 15.01.2026\n\nTam Kan Sayımı:\nHemoglobin: 12.5 g/dL (Ref: 12.0-15.5)\nHematokrit: %38.2 (Ref: 35.5-44.9)\nLökosit (WBC): 6.8 K/uL (Ref: 4.0-11.0)\nTrombosit: 245 K/uL (Ref: 150-400)\n\nBiyokimya:\nAçlık Kan Şekeri: 95 mg/dL (Ref: 70-100)\nTotal Kolesterol: 220 mg/dL (Ref: 0-200) *YÜKSEK*\nLDL Kolesterol: 145 mg/dL (Ref: 0-130) *YÜKSEK*\nHDL Kolesterol: 55 mg/dL (Ref: 40-60)\nTrigliserit: 160 mg/dL (Ref: 0-150) *YÜKSEK*\n\nTiroid:\nTSH: 0.3 mIU/L (Ref: 0.4-4.0) *DÜŞÜK*\nSerbest T4: 1.8 ng/dL (Ref: 0.8-1.8)`,
        isLabReport: true,
        metrics: [
          { name: "Hemoglobin", value: 12.5, unit: "g/dL", min: 12.0, max: 15.5, isAbnormal: false },
          { name: "Hematocrit", value: 38.2, unit: "%", min: 35.5, max: 44.9, isAbnormal: false },
          { name: "White Blood Cells", value: 6.8, unit: "K/uL", min: 4.0, max: 11.0, isAbnormal: false },
          { name: "Platelets", value: 245, unit: "K/uL", min: 150, max: 400, isAbnormal: false },
          { name: "Glucose (Fasting)", value: 95, unit: "mg/dL", min: 70, max: 100, isAbnormal: false },
          { name: "Total Cholesterol", value: 220, unit: "mg/dL", min: 0, max: 200, isAbnormal: true },
          { name: "LDL Cholesterol", value: 145, unit: "mg/dL", min: 0, max: 130, isAbnormal: true },
          { name: "HDL Cholesterol", value: 55, unit: "mg/dL", min: 40, max: 60, isAbnormal: false },
          { name: "Triglycerides", value: 160, unit: "mg/dL", min: 0, max: 150, isAbnormal: true },
          { name: "TSH", value: 0.3, unit: "mIU/L", min: 0.4, max: 4.0, isAbnormal: true },
          { name: "Free T4", value: 1.8, unit: "ng/dL", min: 0.8, max: 1.8, isAbnormal: false },
        ],
      },
      {
        subject: "Lab Sonuçları - Ayşe Yılmaz - 10.09.2025",
        from: "lab@orneklab.com",
        date: new Date("2025-09-10"),
        body: `Hasta: Ayşe Yılmaz\nTC: 12345678901\nTarih: 10.09.2025\n\nTam Kan Sayımı:\nHemoglobin: 11.8 g/dL (Ref: 12.0-15.5) *DÜŞÜK*\nLökosit (WBC): 7.2 K/uL (Ref: 4.0-11.0)\n\nBiyokimya:\nAçlık Kan Şekeri: 102 mg/dL (Ref: 70-100) *YÜKSEK*\nTotal Kolesterol: 235 mg/dL (Ref: 0-200) *YÜKSEK*\nTSH: 0.35 mIU/L (Ref: 0.4-4.0) *DÜŞÜK*`,
        isLabReport: true,
        metrics: [
          { name: "Hemoglobin", value: 11.8, unit: "g/dL", min: 12.0, max: 15.5, isAbnormal: true },
          { name: "White Blood Cells", value: 7.2, unit: "K/uL", min: 4.0, max: 11.0, isAbnormal: false },
          { name: "Glucose (Fasting)", value: 102, unit: "mg/dL", min: 70, max: 100, isAbnormal: true },
          { name: "Total Cholesterol", value: 235, unit: "mg/dL", min: 0, max: 200, isAbnormal: true },
          { name: "TSH", value: 0.35, unit: "mIU/L", min: 0.4, max: 4.0, isAbnormal: true },
        ],
      },
    ],
  },
  {
    name: "Mehmet Kaya",
    governmentId: "98765432109",
    gender: "Male",
    birthYear: 1978,
    emails: [
      {
        subject: "Lab Sonuçları - Mehmet Kaya - 20.02.2026",
        from: "lab@orneklab.com",
        date: new Date("2026-02-20"),
        body: `Hasta: Mehmet Kaya\nTC: 98765432109\nTarih: 20.02.2026\n\nTam Kan Sayımı:\nHemoglobin: 15.2 g/dL (Ref: 13.5-17.5)\nLökosit (WBC): 8.1 K/uL (Ref: 4.0-11.0)\n\nBiyokimya:\nCRP: 8.5 mg/L (Ref: 0-5.0) *YÜKSEK*\nALT: 62 U/L (Ref: 7-56) *YÜKSEK*\nAST: 48 U/L (Ref: 10-40) *YÜKSEK*\nKreatinin: 1.1 mg/dL (Ref: 0.74-1.35)\nAçlık Kan Şekeri: 88 mg/dL (Ref: 70-100)`,
        isLabReport: true,
        metrics: [
          { name: "Hemoglobin", value: 15.2, unit: "g/dL", min: 13.5, max: 17.5, isAbnormal: false },
          { name: "White Blood Cells", value: 8.1, unit: "K/uL", min: 4.0, max: 11.0, isAbnormal: false },
          { name: "CRP", value: 8.5, unit: "mg/L", min: 0, max: 5.0, isAbnormal: true },
          { name: "ALT", value: 62, unit: "U/L", min: 7, max: 56, isAbnormal: true },
          { name: "AST", value: 48, unit: "U/L", min: 10, max: 40, isAbnormal: true },
          { name: "Creatinine", value: 1.1, unit: "mg/dL", min: 0.74, max: 1.35, isAbnormal: false },
          { name: "Glucose (Fasting)", value: 88, unit: "mg/dL", min: 70, max: 100, isAbnormal: false },
        ],
      },
    ],
  },
  {
    name: "Fatma Demir",
    governmentId: "55566677788",
    gender: "Female",
    birthYear: 1990,
    emails: [
      {
        subject: "Lab Sonuçları - Fatma Demir - 05.03.2026",
        from: "lab@orneklab.com",
        date: new Date("2026-03-05"),
        body: `Hasta: Fatma Demir\nTC: 55566677788\nTarih: 05.03.2026\n\nTam Kan Sayımı:\nHemoglobin: 10.5 g/dL (Ref: 12.0-15.5) *DÜŞÜK*\nMCV: 72 fL (Ref: 80-100) *DÜŞÜK*\nLökosit (WBC): 6.5 K/uL (Ref: 4.0-11.0)\n\nDemir Paneli:\nFerritin: 8 ng/mL (Ref: 12-150) *DÜŞÜK*\nDemir: 35 ug/dL (Ref: 60-170) *DÜŞÜK*\n\nVitamin:\nB12: 180 pg/mL (Ref: 200-900) *DÜŞÜK*\nFolat: 5.2 ng/mL (Ref: 3.0-17.0)`,
        isLabReport: true,
        metrics: [
          { name: "Hemoglobin", value: 10.5, unit: "g/dL", min: 12.0, max: 15.5, isAbnormal: true },
          { name: "MCV", value: 72, unit: "fL", min: 80, max: 100, isAbnormal: true },
          { name: "White Blood Cells", value: 6.5, unit: "K/uL", min: 4.0, max: 11.0, isAbnormal: false },
          { name: "Ferritin", value: 8, unit: "ng/mL", min: 12, max: 150, isAbnormal: true },
          { name: "Iron", value: 35, unit: "ug/dL", min: 60, max: 170, isAbnormal: true },
          { name: "Vitamin B12", value: 180, unit: "pg/mL", min: 200, max: 900, isAbnormal: true },
          { name: "Folate", value: 5.2, unit: "ng/mL", min: 3.0, max: 17.0, isAbnormal: false },
        ],
      },
    ],
  },
];

const DEMO_REPORT_SUMMARY = `# Hasta Değerlendirmesi: Ayşe Yılmaz

## Genel Bakış
Ayşe Yılmaz'ın son iki lab sonucu karşılaştırıldığında, lipid profilinde belirgin yükseklik ve tiroid fonksiyonlarında düşüklük dikkat çekmektedir.

## Önemli Bulgular

### Lipid Profili
- **Total Kolesterol** 220 mg/dL ile referans aralığın (0-200) üstünde. Önceki tetkikte 235 idi, hafif iyileşme görülmektedir.
- **LDL Kolesterol** 145 mg/dL ile yüksek sınırda.
- **Trigliserit** 160 mg/dL ile sınır değerinin üzerinde.
- HDL Kolesterol 55 mg/dL ile normal aralıkta.

### Tiroid Fonksiyonları
- **TSH** 0.3 mIU/L ile referansın (0.4-4.0) altında. Bu durum subklinik hipertiroidi düşündürmektedir.
- Serbest T4 1.8 ng/dL ile üst sınırda ancak normal.

### Hemoglobin Takibi
- Son tetkikte 12.5 g/dL ile normale dönmüş (önceki: 11.8 g/dL - düşük).

## Öneriler
1. Lipid profili için diyet ve yaşam tarzı düzenlemesi öneriyorum
2. TSH takibi 6-8 hafta sonra tekrarlanmalı
3. 3 ay sonra kontrol kan tetkiki öneriyorum`;

const DEMO_ATTENTION_POINTS = JSON.stringify([
  { metric: "Total Cholesterol", value: 220, unit: "mg/dL", referenceMax: 200, severity: "medium", message: "Total kolesterol referans aralığın üstünde. Diyet ve egzersiz öneriyorum." },
  { metric: "LDL Cholesterol", value: 145, unit: "mg/dL", referenceMax: 130, severity: "medium", message: "LDL kolesterol yüksek. Kardiyovasküler risk değerlendirmesi yapılmalı." },
  { metric: "TSH", value: 0.3, unit: "mIU/L", referenceMin: 0.4, severity: "high", message: "TSH düşük - subklinik hipertiroidizm olabilir. Tiroid fonksiyon testleri tekrarlanmalı." },
  { metric: "Triglycerides", value: 160, unit: "mg/dL", referenceMax: 150, severity: "low", message: "Trigliserit hafif yüksek. Karbonhidrat kısıtlaması faydalı olabilir." },
]);

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;

  // Check if demo data already exists
  const existingDemo = await prisma.patient.findFirst({
    where: { userId, governmentId: "12345678901" },
  });
  if (existingDemo) {
    return NextResponse.json({ message: "Demo data already exists" });
  }

  // Create patients, emails, metrics, and a demo report in a transaction
  await prisma.$transaction(async (tx) => {
    const createdPatients: { id: string; name: string }[] = [];

    for (const p of DEMO_PATIENTS) {
      const patient = await tx.patient.create({
        data: {
          name: p.name,
          governmentId: p.governmentId,
          gender: p.gender,
          birthYear: p.birthYear,
          userId,
        },
      });
      createdPatients.push({ id: patient.id, name: patient.name });

      for (const email of p.emails) {
        await tx.email.create({
          data: {
            gmailMessageId: `demo_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
            subject: email.subject,
            from: email.from,
            date: email.date,
            body: email.body,
            isLabReport: email.isLabReport,
            patientId: patient.id,
            userId,
          },
        });

        // Create blood metrics linked to patient
        for (const m of email.metrics) {
          await tx.bloodMetric.create({
            data: {
              metricName: m.name,
              value: m.value,
              unit: m.unit,
              referenceMin: m.min,
              referenceMax: m.max,
              isAbnormal: m.isAbnormal,
              measuredAt: email.date,
              patientId: patient.id,
            },
          });
        }
      }
    }

    // Create a demo report for Ayşe Yılmaz
    const ayse = createdPatients.find((p) => p.name === "Ayşe Yılmaz");
    if (ayse) {
      const ayseEmails = await tx.email.findMany({
        where: { patientId: ayse.id },
      });
      const ayseMetrics = await tx.bloodMetric.findMany({
        where: { patientId: ayse.id },
      });

      const report = await tx.report.create({
        data: {
          title: `Detayli Rapor - ${ayse.name}`,
          summary: DEMO_REPORT_SUMMARY,
          attentionPoints: DEMO_ATTENTION_POINTS,
          status: "completed",
          reportType: "detailed report",
          format: "graphical",
          patientId: ayse.id,
          userId,
        },
      });

      // Link emails to report
      for (const email of ayseEmails) {
        await tx.reportEmail.create({
          data: { reportId: report.id, emailId: email.id },
        });
      }

      // Link metrics to report
      for (const metric of ayseMetrics) {
        await tx.bloodMetric.update({
          where: { id: metric.id },
          data: { reportId: report.id },
        });
      }
    }
  });

  return NextResponse.json({ message: "Demo data seeded successfully" });
}
