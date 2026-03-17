import { getBoss } from "@/lib/queue";
import type { GenerateReportPayload, MergePdfsPayload } from "@/lib/queue";
import { processReport } from "@/lib/jobs/process-report";
import { mergePdfs } from "@/lib/jobs/merge-pdfs";

export async function registerWorkers() {
  const boss = getBoss();

  await boss.work<GenerateReportPayload>(
    "generate-report",
    { batchSize: 2 },
    async (jobs) => {
      for (const job of jobs) {
        console.log(`[worker] generate-report job ${job.id} started`);
        await processReport(job.data);
        console.log(`[worker] generate-report job ${job.id} completed`);
      }
    }
  );

  await boss.work<MergePdfsPayload>(
    "merge-pdfs",
    { batchSize: 3 },
    async (jobs) => {
      for (const job of jobs) {
        console.log(`[worker] merge-pdfs job ${job.id} started`);
        await mergePdfs(job.data);
        console.log(`[worker] merge-pdfs job ${job.id} completed`);
      }
    }
  );

  console.log("[workers] all workers registered");
}
