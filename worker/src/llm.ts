import type { BaziChartJson } from './chart-types';
import { selectBaziKnowledge } from './knowledge/bazi';

export interface Env {
  AI_API_KEY?: string;
  AI_BASE_URL?: string;
  AI_MODEL?: string;
  ALLOWED_ORIGIN?: string;
}

export class AiConfigurationError extends Error {}
export class AiProviderError extends Error {}

function requiredEnv(env: Env): Required<Env> {
  if (!env.AI_API_KEY || !env.AI_BASE_URL || !env.AI_MODEL) {
    throw new AiConfigurationError('AI 未配置。请设置 AI_API_KEY、AI_BASE_URL 和 AI_MODEL。');
  }
  return env as Required<Env>;
}

export function buildInterpretationMessages(chart: BaziChartJson, question: string) {
  const knowledge = selectBaziKnowledge(chart);
  const system = [
    '你是传统命理解读助手。只可依据提供的命盘 JSON 与审核知识片段作答。',
    '先列出盘面依据，再给出温和、非确定性的解读。不得诊断疾病、提供投资/法律建议，或宣称能预测确定事件。',
    '若问题超出资料范围，明确说明限制。回答使用简体中文，控制在 800 个汉字以内。',
    '审核知识片段：',
    ...knowledge.map((item) => `【${item.title}】${item.text}`)
  ].join('\n');
  const user = `命盘 JSON：\n${JSON.stringify(chart)}\n\n用户问题：${question}`;
  return { system, user, sources: knowledge.map(({ id, title }) => ({ id, title })) };
}

export async function interpretBazi(env: Env, chart: BaziChartJson, question: string) {
  const config = requiredEnv(env);
  const messages = buildInterpretationMessages(chart, question);
  const endpoint = `${config.AI_BASE_URL.replace(/\/$/, '')}/chat/completions`;
  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${config.AI_API_KEY}`,
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model: config.AI_MODEL,
        messages: [
          { role: 'system', content: messages.system },
          { role: 'user', content: messages.user }
        ],
        temperature: 0.3,
        max_tokens: 1200
      })
    });
  } catch {
    throw new AiProviderError('AI 服务不可连接。');
  }
  if (!response.ok) throw new AiProviderError(`AI 服务返回 ${response.status}。`);

  const payload = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
  const content = payload.choices?.[0]?.message?.content?.trim();
  if (!content) throw new AiProviderError('AI 服务未返回可用解读。');
  return { content, sources: messages.sources, model: config.AI_MODEL };
}

export async function interpretStructured(env: Env, moduleName: string, chart: unknown, question: string, limitations?: string) {
  const config = requiredEnv(env);
  const system = [
    `你是${moduleName}传统文化参考助手。只依据提供的结构化计算结果和用户问题作答。`,
    '先列出可验证的计算依据，再给出温和、非确定性的观察。不得诊断疾病、提供投资/法律建议或预测确定事件。',
    '回答使用简体中文，控制在 800 个汉字以内。',
    limitations ? `边界：${limitations}` : ''
  ].filter(Boolean).join('\n');
  const endpoint = `${config.AI_BASE_URL.replace(/\/$/, '')}/chat/completions`;
  let response: Response;
  try {
    response = await fetch(endpoint, { method: 'POST', headers: { authorization: `Bearer ${config.AI_API_KEY}`, 'content-type': 'application/json' }, body: JSON.stringify({ model: config.AI_MODEL, messages: [{ role: 'system', content: system }, { role: 'user', content: `计算结果：\n${JSON.stringify(chart)}\n\n用户问题：${question}` }], temperature: 0.3, max_tokens: 1200 }) });
  } catch { throw new AiProviderError('AI 服务不可连接。'); }
  if (!response.ok) throw new AiProviderError(`AI 服务返回 ${response.status}。`);
  const payload = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
  const content = payload.choices?.[0]?.message?.content?.trim();
  if (!content) throw new AiProviderError('AI 服务未返回可用解读。');
  return { content, sources: [{ id: 'computed-chart', title: `${moduleName}计算结果` }], model: config.AI_MODEL };
}
