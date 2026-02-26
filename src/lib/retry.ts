export async function withRetry<T>(
  fn: () => Promise<T>,
  opts: { attempts?: number; baseDelayMs?: number; label?: string } = {}
): Promise<T> {
  const { attempts = 3, baseDelayMs = 1000, label = "operation" } = opts;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === attempts) throw error;
      const delay = baseDelayMs * Math.pow(2, attempt - 1);
      console.warn(
        `[retry] ${label} failed (attempt ${attempt}/${attempts}), retrying in ${delay}ms`,
        error instanceof Error ? error.message : error
      );
      await new Promise((r) => setTimeout(r, delay));
    }
  }

  throw new Error(`${label} failed after ${attempts} attempts`);
}
