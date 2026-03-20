import { getBoss } from "@/lib/queue";
import { registerWorkers } from "@/lib/workers";

export async function startPgBoss() {
  try {
    const boss = getBoss();
    await boss.start();
    await registerWorkers();
    (globalThis as Record<string, unknown>).pgBossReady = true;
    console.log("[pg-boss] started + workers registered");

    const shutdown = async () => {
      console.log("[pg-boss] stopping...");
      await boss.stop({ graceful: true, timeout: 10_000 });
      console.log("[pg-boss] stopped");
      process.exit(0);
    };

    process.on("SIGTERM", shutdown);
    process.on("SIGINT", shutdown);
  } catch (err) {
    console.warn("[pg-boss] Failed to start — background jobs disabled:", err);
  }
}
