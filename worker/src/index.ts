import { calculateBazi } from './calculators/bazi';
import type { AnalysisRequest } from './chart-types';
import { AiConfigurationError, AiProviderError, interpretBazi, type Env } from './llm';

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

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const cors = corsHeaders(request, env);
    const respond = (body: unknown, status = 200) => json(body, status, cors);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    const url = new URL(request.url);
    if (request.method === 'GET' && url.pathname === '/api/health') return respond({ ok: true });
    if (request.method !== 'POST' || !['/api/v1/analyses/preview', '/api/v1/analyses/interpret'].includes(url.pathname)) {
      return respond({ error: 'not_found' }, 404);
    }

    let payload: AnalysisRequest;
    try { payload = await request.json() as AnalysisRequest; } catch { return respond({ error: 'invalid_json' }, 400); }
    if (payload.module !== 'bazi') {
      return respond({ error: 'module_not_enabled', message: '当前只启用 bazi 预览计算。' }, 409);
    }
    if (!payload.input?.birthDateTime || (payload.input.gender !== 'male' && payload.input.gender !== 'female')) {
      return respond({ error: 'invalid_input', message: '需要 birthDateTime（含时区）和 gender。' }, 400);
    }
    try {
      const chart = calculateBazi({ birthDateTime: payload.input.birthDateTime, gender: payload.input.gender });
      if (url.pathname === '/api/v1/analyses/interpret') {
        const question = payload.input.question?.trim();
        if (!question) return respond({ error: 'invalid_input', message: '解读需要 question。' }, 400);
        if (question.length > 500) return respond({ error: 'invalid_input', message: 'question 不能超过 500 个字符。' }, 400);
        try {
          const interpretation = await interpretBazi(env, chart, question);
          return respond({ status: 'interpreted', chart, interpretation });
        } catch (error) {
          if (error instanceof AiConfigurationError) return respond({ error: 'ai_not_configured', message: error.message }, 503);
          if (error instanceof AiProviderError) return respond({ error: 'ai_provider_error', message: error.message }, 502);
          return respond({ error: 'interpretation_failed', message: '解读生成失败。' }, 502);
        }
      }
      return respond({ status: 'calculated', chart });
    } catch (error) {
      return respond({ error: 'calculation_failed', message: error instanceof Error ? error.message : '计算失败。' }, 422);
    }
  }
};
