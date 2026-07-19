/** Fire-and-forget — never blocks or throws into the caller's export flow. */
export function recordExportTally() {
  fetch('/api/export-tally', { method: 'POST' }).catch(() => {});
}

export async function fetchExportTally(): Promise<number | null> {
  try {
    const res = await fetch('/api/export-tally');
    if (!res.ok) return null;
    const data = (await res.json()) as { count?: number };
    return typeof data.count === 'number' ? data.count : null;
  } catch {
    return null;
  }
}
