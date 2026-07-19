export interface Env {
  ASSETS: Fetcher;
  EXPORT_TALLY: DurableObjectNamespace;
}

const RATE_LIMIT_WINDOW_MS = 30_000;
// Drop entries older than this on each request, so the in-memory map never
// grows unbounded under sustained traffic.
const RATE_LIMIT_PRUNE_AGE_MS = 2 * 60_000;

export class ExportTally implements DurableObject {
  private state: DurableObjectState;
  private count = 0;
  private lastSeen = new Map<string, number>();
  private loaded = false;

  constructor(state: DurableObjectState) {
    this.state = state;
  }

  private async ensureLoaded() {
    if (this.loaded) return;
    this.count = (await this.state.storage.get<number>('count')) ?? 0;
    this.loaded = true;
  }

  async fetch(request: Request): Promise<Response> {
    await this.ensureLoaded();

    if (request.method === 'GET') {
      return Response.json({ count: this.count });
    }

    if (request.method === 'POST') {
      const ipHash = request.headers.get('x-ip-hash') ?? '';
      const now = Date.now();

      for (const [hash, ts] of this.lastSeen) {
        if (now - ts > RATE_LIMIT_PRUNE_AGE_MS) this.lastSeen.delete(hash);
      }

      const last = ipHash ? this.lastSeen.get(ipHash) : undefined;
      const rateLimited = last !== undefined && now - last < RATE_LIMIT_WINDOW_MS;

      if (!rateLimited) {
        if (ipHash) this.lastSeen.set(ipHash, now);
        this.count += 1;
        await this.state.storage.put('count', this.count);
      }

      // Always 200, regardless of whether this request was rate-limited —
      // the client has no way to tell the difference, by design.
      return Response.json({ ok: true });
    }

    return new Response('Method not allowed', { status: 405 });
  }
}

async function hashIp(ip: string): Promise<string> {
  const data = new TextEncoder().encode(ip);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/api/export-tally') {
      const id = env.EXPORT_TALLY.idFromName('global');
      const stub = env.EXPORT_TALLY.get(id);

      if (request.method === 'POST') {
        const ip = request.headers.get('cf-connecting-ip') ?? '';
        const ipHash = ip ? await hashIp(ip) : '';
        return stub.fetch(request.url, { method: 'POST', headers: { 'x-ip-hash': ipHash } });
      }

      if (request.method === 'GET') {
        return stub.fetch(request.url, { method: 'GET' });
      }

      return new Response('Method not allowed', { status: 405 });
    }

    return env.ASSETS.fetch(request);
  },
};
