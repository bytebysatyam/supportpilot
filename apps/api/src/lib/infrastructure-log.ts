const lastReported = new Map<string, number>();

export function logInfrastructureError(event: string, source: string) {
  const key = `${event}:${source}`;
  const now = Date.now();
  if (now - (lastReported.get(key) ?? 0) < 30_000) return;
  lastReported.set(key, now);
  console.error(JSON.stringify({ event, source }));
}
