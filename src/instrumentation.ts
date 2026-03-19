export async function onRequestError() {
  // Required export — intentionally empty.
}

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { getBoss } = await import("@/lib/queue");
  const { registerWorkers } = await import("@/lib/workers");

  const boss = getBoss();
  await boss.start();
  await registerWorkers();
  // Mark ready so ensureReady() in queue.ts won't double-start
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
}
