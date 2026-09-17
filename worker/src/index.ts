import { calculateBazi } from './calculators/bazi';
import { calculateZiwei } from './calculators/ziwei';
import { selectCalendarDays } from './calculators/calendar';
import { calculateQimenChart } from './calculators/qimen';
import type { AnalysisRequest } from './chart-types';
import { AiConfigurationError, AiProviderError, interpretBazi, interpretStructured, type Env } from './llm';
import type { RateLimitResult } from './rate-limiter';

export { RateLimiter } from './rate-limiter';

const MAX_REQUEST_BYTES = 16 * 1024;
const RATE_LIMITS = {
  '/api/v1/analyses/preview': { limit: 30, windowMs: 60_000 },
  '/api/v1/analyses/interpret': { limit: 8, windowMs: 10 * 60_000 }
} as const;

const json = (body: unknown, status = 200, headers: HeadersInit = {}) => new Response(JSON.stringify(body), {
  status,
  headers: { 'content-type': 'application/json; charset=utf-8', ...headers }
});

function corsHeaders(request: Request, env: Env): HeadersInit {
  const configuredOrigin = env.ALLOWED_ORIGIN?.trim();
  const origin = request.headers.get('origin');
  const allowOrigin = configuredOrigin && configuredOrigin !== '*' ? configuredOrigin : (origin ?? '*');
  return {
    'access-control-allow-origin': allowOrigin,
    'access-control-allow-methods': 'GET, POST, OPTIONS',
    'access-control-allow-headers': 'content-type',
    'access-control-max-age': '86400',
    'vary': 'Origin'
  };
}

function clientKey(request: Request): string {
  // Cloudflare sets this header from the connecting client; never accept a
  // client-controlled X-Forwarded-For value as a limiter identity.
  return request.headers.get('CF-Connecting-IP') ?? 'unknown';
}

async function checkRateLimit(request: Request, env: Env, path: keyof typeof RATE_LIMITS): Promise<RateLimitResult> {
  const policy = RATE_LIMITS[path];
  const id = env.RATE_LIMITER.idFromName(`${path}:${clientKey(request)}`);
  const response = await env.RATE_LIMITER.get(id).fetch('https://rate-limiter/check', {
    method: 'POST', body: JSON.stringify(policy)
  });
  if (!response.ok) return { allowed: false, retryAfterSeconds: 60 };
  return response.json() as Promise<RateLimitResult>;
}

async function verifyTurnstile(token: string | undefined, request: Request, env: Env): Promise<boolean> {
  if (!env.TURNSTILE_SECRET_KEY || !token) return false;
  const form = new FormData();
  form.set('secret', env.TURNSTILE_SECRET_KEY);
  form.set('response', token);
  const remoteIp = request.headers.get('CF-Connecting-IP');
  if (remoteIp) form.set('remoteip', remoteIp);
  try {
    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body: form });
    const result = await response.json() as { success?: boolean };
    return result.success === true;
  } catch {
    return false;
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const cors = corsHeaders(request, env);
    const respond = (body: unknown, status = 200, headers: HeadersInit = {}) => json(body, status, { ...cors, ...headers });
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    const url = new URL(request.url);
    if (request.method === 'GET' && url.pathname === '/api/health') return respond({ ok: true });
    if (request.method !== 'POST' || !['/api/v1/analyses/preview', '/api/v1/analyses/interpret'].includes(url.pathname)) {
      return respond({ error: 'not_found' }, 404);
    }

    const contentLength = Number(request.headers.get('content-length') ?? '0');
    if (!Number.isFinite(contentLength) || contentLength > MAX_REQUEST_BYTES) {
      return respond({ error: 'request_too_large' }, 413);
    }
    const policyPath = url.pathname as keyof typeof RATE_LIMITS;
    const rateLimit = await checkRateLimit(request, env, policyPath);
    if (!rateLimit.allowed) return respond({ error: 'rate_limited' }, 429, { 'retry-after': String(rateLimit.retryAfterSeconds) });

    let payload: AnalysisRequest;
    try {
      const raw = await request.text();
      if (new TextEncoder().encode(raw).byteLength > MAX_REQUEST_BYTES) return respond({ error: 'request_too_large' }, 413);
      payload = JSON.parse(raw) as AnalysisRequest;
    } catch { return respond({ error: 'invalid_json' }, 400); }
    try {
      const input = payload.input as AnalysisRequest['input'] & { eventType?: string; startDate?: string; endDate?: string; analysisDateTime?: string };
      let chart: unknown;
      let moduleName = '';
      let limitation = '';
      if (payload.module === 'bazi' || payload.module === 'ziwei') {
        if (!input.birthDateTime || (input.gender !== 'male' && input.gender !== 'female')) return respond({ error: 'invalid_input', message: '需要 birthDateTime（含时区）和 gender。' }, 400);
        chart = payload.module === 'bazi' ? calculateBazi({ birthDateTime: input.birthDateTime, gender: input.gender }) : calculateZiwei({ birthDateTime: input.birthDateTime, gender: input.gender });
        moduleName = payload.module === 'bazi' ? '八字' : '紫微斗数';
      } else if (payload.module === 'calendar') {
        if (!input.eventType || !input.startDate || !input.endDate) return respond({ error: 'invalid_input', message: '需要 eventType、startDate 和 endDate。' }, 400);
        chart = selectCalendarDays({ eventType: input.eventType, startDate: input.startDate, endDate: input.endDate });
        moduleName = '择日';
      } else if (payload.module === 'qimen') {
        if (!input.analysisDateTime) return respond({ error: 'invalid_input', message: '需要 analysisDateTime（含时区）。' }, 400);
        chart = calculateQimenChart(input.analysisDateTime);
        moduleName = '奇门遁甲（时家转盘）';
        limitation = '盘面由本地时家转盘奇门拆补法计算；AI 只能依据返回的九宫盘与用户问题解读，不得将传统术数内容表述为确定性预测。';
      } else return respond({ error: 'module_not_enabled' }, 409);
      if (url.pathname === '/api/v1/analyses/interpret') {
        if (!env.TURNSTILE_SECRET_KEY) return respond({ error: 'security_not_configured' }, 503);
        if (!await verifyTurnstile(payload.turnstileToken, request, env)) return respond({ error: 'verification_failed' }, 403);
        const question = payload.input.question?.trim();
        if (!question) return respond({ error: 'invalid_input', message: '解读需要 question。' }, 400);
        if (question.length > 500) return respond({ error: 'invalid_input', message: 'question 不能超过 500 个字符。' }, 400);
        try {
          const interpretation = payload.module === 'bazi' ? await interpretBazi(env, chart as ReturnType<typeof calculateBazi>, question) : await interpretStructured(env, moduleName, chart, question, limitation);
          return respond({ status: 'interpreted', chart, interpretation });
        } catch (error) {
          if (error instanceof AiConfigurationError) return respond({ error: 'ai_not_configured', message: error.message }, 503);
          if (error instanceof AiProviderError) return respond({ error: 'ai_provider_error', message: error.message }, 502);
          return respond({ error: 'interpretation_failed', message: '解读生成失败。' }, 502);
        }
      }
      return respond({ status: 'calculated', chart });
    } catch {
      return respond({ error: 'calculation_failed', message: '输入无法完成计算。' }, 422);
    }
  }
};
