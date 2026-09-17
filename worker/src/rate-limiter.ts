export interface RateLimitRequest {
  limit: number;
  windowMs: number;
}

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds: number;
}

/**
 * A per-key fixed-window limiter. A Durable Object serializes concurrent
 * requests for one key, so a burst cannot race the counter in the Worker.
 */
export class RateLimiter implements DurableObject {
  constructor(private readonly state: DurableObjectState) {}

  async fetch(request: Request): Promise<Response> {
    if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 });
    const { limit, windowMs } = await request.json() as RateLimitRequest;
    if (!Number.isInteger(limit) || !Number.isInteger(windowMs) || limit < 1 || windowMs < 1) {
      return Response.json({ allowed: false, retryAfterSeconds: 60 } satisfies RateLimitResult, { status: 400 });
    }

    const now = Date.now();
    const stored = await this.state.storage.get<{ startedAt: number; count: number }>('window');
    const active = stored && now - stored.startedAt < windowMs ? stored : { startedAt: now, count: 0 };
    active.count += 1;
    await this.state.storage.put('window', active);
    const retryAfterSeconds = Math.max(1, Math.ceil((active.startedAt + windowMs - now) / 1000));
    return Response.json({ allowed: active.count <= limit, retryAfterSeconds } satisfies RateLimitResult);
  }
}
