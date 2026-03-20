import PgBoss from "pg-boss";

export interface GenerateReportPayload {
  reportId: string;
  patientName: string;
  emails: Array<{
    id: string;
    subject: string | null;
    body: string | null;
    date: string | null; // ISO string
  }>;
  userId: string;
  reportType: string;
  format: string;
  aiOptions?: {
    model?: string;
    language?: string;
    customSystemPrompt?: string | null;
  };
}

export interface MergePdfsPayload {
  reportId: string;
  emails: Array<{
    id: string;
    gmailMessageId: string;
    subject: string | null;
    date: string | null; // ISO string
  }>;
  userId: string;
}

const globalForBoss = globalThis as unknown as {
  pgBoss: PgBoss | undefined;
  pgBossReady: boolean | undefined;
};

export function getBoss(): PgBoss {
  if (!globalForBoss.pgBoss) {
    globalForBoss.pgBoss = new PgBoss({
      connectionString: process.env.DATABASE_URL!,
      retryLimit: 3,
      retryBackoff: true,
      expireInHours: 1,
    });
    globalForBoss.pgBossReady = false;
  }
  return globalForBoss.pgBoss;
}

/**
 * Ensure pg-boss is started and workers are registered.
 * Safe to call multiple times — idempotent.
 */
async function ensureReady(): Promise<PgBoss> {
  const boss = getBoss();
  if (!globalForBoss.pgBossReady) {
    try {
      await boss.start();
      const { registerWorkers } = await import("@/lib/workers");
      await registerWorkers();
      globalForBoss.pgBossReady = true;
      console.log("[queue] pg-boss started + workers registered");
    } catch (err) {
      console.warn("[queue] pg-boss failed to start:", err);
    }
  }
  return boss;
}

export async function enqueueGenerateReport(
  payload: GenerateReportPayload
): Promise<string | null> {
  const boss = await ensureReady();
  return boss.send("generate-report", payload);
}

export async function enqueueMergePdfs(
  payload: MergePdfsPayload
): Promise<string | null> {
  const boss = await ensureReady();
  return boss.send("merge-pdfs", payload);
}
