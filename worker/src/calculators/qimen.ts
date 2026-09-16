import { QimenChart } from '3meta';

const QIMEN_VERSION = '2.6.0';

function shanghaiParts(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error('analysisDateTime 必须是有效且含时区的 ISO 8601 时间。');
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value;
  const year = part('year');
  const month = part('month');
  const day = part('day');
  const hour = part('hour');
  const minute = part('minute');
  if (!year || !month || !day || !hour || !minute) throw new Error('无法按 Asia/Shanghai 解析问事时间。');
  return { year, month, day, hour, minute };
}

function text(value: unknown) {
  return typeof value === 'string' || typeof value === 'number' ? String(value) : '';
}

function joinedText(value: unknown) {
  return Array.isArray(value) ? value.map(text).filter(Boolean).join('、') : text(value);
}

/** Generates a deterministic hour-chart using the rotating-plate, Chai Bu method. */
export function calculateQimenChart(questionTime: string) {
  const time = shanghaiParts(questionTime);
  const chart = QimenChart.fromSolar(Number(time.year), Number(time.month), Number(time.day), Number(time.hour), Number(time.minute), 0);
  const patterns = chart.palaces.flatMap((palace) => [
    ...(palace.auspiciousPatterns ?? []).map((pattern) => ({ type: '吉格', name: pattern.name, auspiciousness: '吉', palace: palace.trigram, detail: pattern.description ?? '', relationship: '', hostGuest: '' })),
    ...(palace.inauspiciousPatterns ?? []).map((pattern) => ({ type: '凶格', name: pattern.name, auspiciousness: '凶', palace: palace.trigram, detail: pattern.description ?? '', relationship: '', hostGuest: '' }))
  ]).slice(0, 12);
  const chiefStarPalace = chart.palaces.find((palace) => palace.position === chart.zhiFu.position)?.trigram ?? '';
  const chiefDoorPalace = chart.palaces.find((palace) => palace.position === chart.zhiShi.position)?.trigram ?? '';

  return {
    schemaVersion: 'qimen-hour-chart-1',
    calculator: { name: '3meta', version: QIMEN_VERSION },
    policy: {
      method: '时家转盘奇门', juMethod: '拆补法', nightZiHour: '次日', timezone: 'Asia/Shanghai', trueSolarTime: false,
      limitation: '按 Asia/Shanghai 墙上时钟起时家转盘奇门；未做真太阳时、经度或历史夏令时校正。传统术数内容仅作文化参考。'
    },
    questionTime: `${time.year}-${time.month}-${time.day} ${time.hour}:${time.minute}:00`,
    pillars: { year: `${chart.fourPillars.year.stem}${chart.fourPillars.year.branch}`, month: `${chart.fourPillars.month.stem}${chart.fourPillars.month.branch}`, day: `${chart.fourPillars.day.stem}${chart.fourPillars.day.branch}`, hour: `${chart.fourPillars.hour.stem}${chart.fourPillars.hour.branch}` },
    jieQi: chart.timeInfo.solarTerm ?? '', yuan: chart.yuan,
    dun: { type: chart.ju.type.replace('遁', ''), ju: chart.ju.number },
    duty: {
      chiefStar: text(chart.zhiFu.star), chiefDoor: text(chart.zhiShi.gate), chiefStarPalace, chiefDoorPalace,
      xunShou: chart.timeInfo.xunShou, fuShou: text(chart.zhiFu.heavenlyStem)
    },
    palaces: chart.palaces.map((palace) => ({ palace: palace.trigram, earthPlate: joinedText(palace.earthlyStem), heavenPlate: joinedText(palace.heavenlyStem), door: text(palace.gate), star: joinedText(palace.star), deity: text(palace.deity) })),
    patterns
  };
}
