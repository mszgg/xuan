const form = document.querySelector('.tool-form[data-module]');

function apiUrl(path) {
  return `${document.documentElement.dataset.apiBase?.replace(/\/$/, '') || ''}${path}`;
}

function withShanghaiOffset(value) {
  return value ? `${value.length === 16 ? `${value}:00` : value}+08:00` : new Date().toISOString();
}

function field(name) {
  return form.elements.namedItem(name)?.value?.trim() ?? '';
}

function buildPayload(module) {
  if (module === 'ziwei') {
    const focus = field('focus') || '完整命盘概览';
    return { module, input: { birthDateTime: withShanghaiOffset(field('birthDateTime')), gender: field('gender'), question: field('question') || `请围绕“${focus}”解读命盘。` } };
  }
  if (module === 'calendar') {
    const eventType = field('eventType');
    return { module, input: { eventType, startDate: field('startDate'), endDate: field('endDate'), question: field('question') || `请说明“${eventType}”候选日期的取舍。` } };
  }
  const question = field('question');
  return { module, input: { analysisDateTime: withShanghaiOffset(field('analysisDateTime')), question } };
}

function summary(chart, module) {
  if (module === 'ziwei') return chart.palaces.map((palace) => `${palace.name}（${palace.earthlyBranch}）：${palace.majorStars.map((star) => star.name).join('、') || '无主星'}`).join('\n');
  if (module === 'calendar') return chart.candidates.map((day) => `${day.date}｜${day.lunar}｜${day.luck}｜宜：${day.yi.join('、')}｜冲：${day.chong}`).join('\n');
  return `问事时间：${chart.questionTime}\n四柱：${Object.values(chart.pillars).join(' ')}\n节气：${chart.jieQi || '无'}\n${chart.policy.limitation}`;
}

function render(payload, module) {
  const result = form.querySelector('.result');
  result.replaceChildren();
  const title = document.createElement('h3');
  title.textContent = module === 'ziwei' ? '紫微命盘与解读' : module === 'calendar' ? '择日候选与解读' : '奇门 AI 辅助参考';
  const chart = document.createElement('pre');
  chart.className = 'calculated-chart';
  chart.textContent = summary(payload.chart, module);
  const interpretation = document.createElement('div');
  interpretation.className = 'interpretation';
  interpretation.textContent = payload.interpretation.content;
  result.append(title, chart, interpretation);
  result.classList.add('visible');
  result.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

form?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const module = form.dataset.module;
  const submit = form.querySelector('.submit');
  let status = form.querySelector('.form-status');
  if (!status) { status = document.createElement('p'); status.className = 'form-status'; form.querySelector('.result').before(status); }
  submit.disabled = true;
  submit.textContent = '正在计算并生成解读…';
  status.textContent = '正在生成，请稍候。';
  try {
    const response = await fetch(apiUrl('/api/v1/analyses/interpret'), { method: 'POST', headers: { 'content-type': 'application/json; charset=utf-8' }, body: JSON.stringify(buildPayload(module)) });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.message || '暂时无法生成结果。');
    render(payload, module);
    status.textContent = '生成完成。';
  } catch (error) { status.textContent = error instanceof Error ? error.message : '网络异常，请稍后重试。'; }
  finally { submit.disabled = false; submit.textContent = module === 'ziwei' ? '绘制我的命盘 →' : module === 'calendar' ? '寻找合适日期 →' : '开始策略分析 →'; }
});
