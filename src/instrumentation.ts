export async function onRequestError() {
  // Required export — intentionally empty.
}

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { startPgBoss } = await import("@/lib/pg-boss-init");
  await startPgBoss();
}
