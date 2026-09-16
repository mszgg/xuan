import { Solar } from 'lunar-javascript';

const EVENT_TERMS: Record<string, string[]> = {
  '婚礼 / 订婚': ['嫁娶', '纳采'], '搬家 / 入宅': ['入宅', '移徙'], '开业 / 签约': ['开市', '立券', '交易'],
  '旅行 / 重要会面': ['出行', '会友'], '考试 / 面试': ['求学', '入学']
};

function dateParts(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('日期必须为 YYYY-MM-DD。');
  return value.split('-').map(Number) as [number, number, number];
}

export function selectCalendarDays(input: { eventType: string; startDate: string; endDate: string }) {
  const [sy, sm, sd] = dateParts(input.startDate);
  const [ey, em, ed] = dateParts(input.endDate);
  let current = Solar.fromYmd(sy, sm, sd);
  const end = Solar.fromYmd(ey, em, ed);
  if (current.getJulianDay() > end.getJulianDay()) throw new Error('结束日期不能早于开始日期。');
  if (end.getJulianDay() - current.getJulianDay() > 62) throw new Error('一次最多筛选 63 天。');
  const preferred = EVENT_TERMS[input.eventType] ?? [];
  const candidates = [];
  while (current.getJulianDay() <= end.getJulianDay()) {
    const lunar = current.getLunar();
    const yi = lunar.getDayYi(2);
    const ji = lunar.getDayJi(2);
    const luck = lunar.getDayTianShenLuck();
    const matches = preferred.filter((term) => yi.includes(term));
    const score = (luck === '吉' ? 3 : 0) + matches.length * 4 - preferred.filter((term) => ji.includes(term)).length * 5;
    candidates.push({ date: current.toYmd(), lunar: lunar.toString(), yi, ji, chong: lunar.getDayChongDesc(), sha: lunar.getDaySha(), dayGod: lunar.getDayTianShen(), luck, matches, score });
    current = current.next(1);
  }
  return { schemaVersion: 'calendar-selection-1', calculator: { name: 'lunar-javascript', version: '1.7.7' }, policy: { timezone: 'Asia/Shanghai', maxRangeDays: 63, eventTerms: preferred }, eventType: input.eventType, candidates: candidates.sort((a, b) => b.score - a.score).slice(0, 10) };
}
