import { Solar } from 'lunar-javascript';

export function calculateQimenContext(questionTime: string) {
  const date = new Date(questionTime);
  if (Number.isNaN(date.getTime())) throw new Error('analysisDateTime 必须是有效且含时区的 ISO 8601 时间。');
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value);
  const solar = Solar.fromYmdHms(get('year'), get('month'), get('day'), get('hour'), get('minute'), 0);
  const lunar = solar.getLunar();
  return { schemaVersion: 'qimen-ai-context-1', policy: { method: '时家转盘奇门', juMethod: '拆补法', timezone: 'Asia/Shanghai', limitation: '当前返回节气与干支上下文，尚未实现可审计的九宫盘。' }, questionTime: solar.toYmdHms(), lunar: lunar.toString(), pillars: { year: lunar.getYearInGanZhiExact(), month: lunar.getMonthInGanZhiExact(), day: lunar.getDayInGanZhi(), hour: lunar.getTimeInGanZhi() }, jieQi: lunar.getJieQi(), dayGod: lunar.getDayTianShen(), dayGodLuck: lunar.getDayTianShenLuck() };
}
