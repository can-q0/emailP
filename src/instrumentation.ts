export async function onRequestError() {
  // Required export — intentionally empty.
}

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { getBoss } = await import("@/lib/queue");
  const { registerWorkers } = await import("@/lib/workers");

  const boss = getBoss();
  await boss.start();
  console.log("[pg-boss] started");

  await registerWorkers();

  const shutdown = async () => {
    console.log("[pg-boss] stopping...");
    await boss.stop({ graceful: true, timeout: 10_000 });
    console.log("[pg-boss] stopped");
    process.exit(0);
  };

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}
