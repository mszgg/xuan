const form = document.querySelector('.tool-form');

function apiUrl(path) {
  const base = document.documentElement.dataset.apiBase?.replace(/\/$/, '') || '';
  return `${base}${path}`;
}

function birthDateTimeWithShanghaiOffset(value) {
  return `${value.length === 16 ? `${value}:00` : value}+08:00`;
}

function setProgress(stage) {
  document.querySelectorAll('.progress span').forEach((item, index) => {
    item.classList.toggle('is-active', index === stage);
    item.classList.toggle('is-complete', index < stage);
  });
}

function renderResult(payload) {
  const { chart, interpretation } = payload;
  const result = form.querySelector('.result');
  const meta = form.querySelector('.result-meta');
  const chartGrid = form.querySelector('.chart-grid');
  const content = form.querySelector('.interpretation');
  const sources = form.querySelector('.result-sources');
  meta.textContent = `农历${chart.birth.lunar} · 已按你的出生时间排盘`;
  chartGrid.replaceChildren(...[
    ['年柱', chart.pillars.year], ['月柱', chart.pillars.month], ['日柱', chart.pillars.day], ['时柱', chart.pillars.hour],
    ['日主', chart.dayMaster], ['十神', Object.values(chart.tenGods).join(' / ')]
  ].map(([label, value]) => {
    const item = document.createElement('div');
    const title = document.createElement('b');
    title.textContent = label;
    item.append(title, document.createTextNode(value));
    return item;
  }));
  if (window.renderInterpretation) window.renderInterpretation(content, interpretation.content);
  else content.textContent = interpretation.content;
  sources.textContent = `本次解读使用：${interpretation.sources.map(source => source.title).join('、')}。`;
  result.classList.add('visible');
  setProgress(2);
  result.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

form?.addEventListener('submit', async event => {
  event.preventDefault();
  const submit = form.querySelector('.submit');
  const status = form.querySelector('.form-status');
  const gender = form.querySelector('#gender').value;
  const birthDateTime = form.querySelector('#birth-date-time').value;
  const focus = form.querySelector('#focus').value;
  const typedQuestion = form.querySelector('#question').value.trim();
  const question = typedQuestion || `请围绕“${focus}”给出基于命盘的温和观察和建议。`;
  if (!gender || !birthDateTime) return;

  submit.disabled = true;
  submit.textContent = '正在生成解读…';
  status.textContent = '正在排盘并生成解读，请稍候。';
  setProgress(1);
  try {
    const response = await fetch(apiUrl('/api/v1/analyses/interpret'), {
      method: 'POST',
      headers: { 'content-type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ module: 'bazi', input: { gender, birthDateTime: birthDateTimeWithShanghaiOffset(birthDateTime), question } })
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.message || '暂时无法生成解读。');
    renderResult(payload);
    status.textContent = '解读生成完成。';
  } catch (error) {
    setProgress(0);
    status.textContent = error instanceof Error ? error.message : '网络异常，请稍后再试。';
  } finally {
    submit.disabled = false;
    submit.textContent = '生成我的八字解读 →';
  }
});
