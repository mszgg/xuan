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

function setProgress(stage) {
  document.querySelectorAll('.progress span').forEach((item, index) => {
    item.classList.toggle('is-active', index === stage);
    item.classList.toggle('is-complete', index < stage);
  });
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
  return [
    `问事时间：${chart.questionTime}`, `四柱：${Object.values(chart.pillars).join(' ')}`, `节气：${chart.jieQi || '无'}｜${chart.yuan || '无'}`,
    `${chart.dun.type}遁${chart.dun.ju}局｜值符：${chart.duty.chiefStar}（${chart.duty.chiefStarPalace}）｜值使：${chart.duty.chiefDoor}（${chart.duty.chiefDoorPalace}）`,
    '', '九宫盘：', ...chart.palaces.map((palace) => `${palace.palace}宫｜地盘${palace.earthPlate}｜天盘${palace.heavenPlate}｜${palace.door || '—'}｜${palace.star || '—'}｜${palace.deity || '—'}`),
    chart.patterns.length ? `\n已识别格局：${chart.patterns.map((pattern) => `${pattern.name}${pattern.palace ? `（${pattern.palace}宫）` : ''}`).join('、')}` : '', `\n${chart.policy.limitation}`
  ].filter(Boolean).join('\n');
}

function render(payload, module) {
  const result = form.querySelector('.result');
  result.replaceChildren();
  const title = document.createElement('h3');
  title.textContent = module === 'ziwei' ? '紫微命盘与解读' : module === 'calendar' ? '择日候选与解读' : '奇门时盘与解读';
  const chart = document.createElement('pre');
  chart.className = 'calculated-chart';
  chart.textContent = summary(payload.chart, module);
  const interpretation = document.createElement('div');
  interpretation.className = 'interpretation';
  if (window.renderInterpretation) window.renderInterpretation(interpretation, payload.interpretation.content);
  else interpretation.textContent = payload.interpretation.content;
  result.append(title, chart, interpretation);
  result.classList.add('visible');
  setProgress(2);
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
  setProgress(1);
  status.textContent = module === 'calendar' ? '正在依据黄历宜忌筛选候选日期…' : module === 'ziwei' ? '正在生成十二宫命盘并准备解读…' : '正在按时家转盘奇门拆补法起完整九宫盘…';
  try {
    const turnstileToken = await window.getTurnstileToken(form);
    const response = await fetch(apiUrl('/api/v1/analyses/interpret'), { method: 'POST', headers: { 'content-type': 'application/json; charset=utf-8' }, body: JSON.stringify({ ...buildPayload(module), turnstileToken }) });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.message || '暂时无法生成结果。');
    render(payload, module);
    status.textContent = '生成完成。';
  } catch (error) { setProgress(0); status.textContent = error instanceof Error ? error.message : '网络异常，请稍后重试。'; }
  finally { window.resetTurnstile?.(); submit.disabled = false; submit.textContent = module === 'ziwei' ? '绘制我的命盘 →' : module === 'calendar' ? '寻找合适日期 →' : '开始策略分析 →'; }
});
