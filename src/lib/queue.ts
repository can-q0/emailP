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
};

export function getBoss(): PgBoss {
  if (!globalForBoss.pgBoss) {
    globalForBoss.pgBoss = new PgBoss({
      connectionString: process.env.DATABASE_URL!,
      retryLimit: 3,
      retryBackoff: true,
      expireInHours: 1,
    });
  }
  return globalForBoss.pgBoss;
}

export async function enqueueGenerateReport(
  payload: GenerateReportPayload
): Promise<string | null> {
  const boss = getBoss();
  return boss.send("generate-report", payload);
}

export async function enqueueMergePdfs(
  payload: MergePdfsPayload
): Promise<string | null> {
  const boss = getBoss();
  return boss.send("merge-pdfs", payload);
}
