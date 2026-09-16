import { Solar } from 'lunar-javascript';
import type { BaziChartJson, BaziInput } from '../chart-types';

export const BAZI_POLICY = {
  timezone: 'Asia/Shanghai',
  yearBoundary: 'lichun',
  librarySect: 2,
  trueSolarTime: false
} as const;

function parseShanghaiTime(value: string): [number, number, number, number, number, number, string] {
  if (!value || Number.isNaN(Date.parse(value))) {
    throw new Error('birthDateTime 必须是有效的 ISO 8601 日期时间，且需包含时区，例如 +08:00。');
  }

  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: BAZI_POLICY.timezone,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'
  }).formatToParts(new Date(value));
  const get = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value);
  const year = get('year');
  const month = get('month');
  const day = get('day');
  const hour = get('hour');
  const minute = get('minute');
  const second = get('second');
  return [year, month, day, hour, minute, second, `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:${String(second).padStart(2, '0')}+08:00`];
}

export function calculateBazi(input: BaziInput): BaziChartJson {
  const [year, month, day, hour, minute, second, normalizedAt] = parseShanghaiTime(input.birthDateTime);
  const solar = Solar.fromYmdHms(year, month, day, hour, minute, second);
  const lunar = solar.getLunar();
  const eightChar = lunar.getEightChar();
  eightChar.setSect(BAZI_POLICY.librarySect);

  return {
    schemaVersion: 'bazi-chart-1',
    calculator: { name: 'lunar-javascript', version: '1.7.7' },
    calculationPolicy: BAZI_POLICY,
    birth: { normalizedAt, solar: solar.toYmdHms(), lunar: lunar.toString() },
    pillars: {
      year: eightChar.getYear(), month: eightChar.getMonth(),
      day: eightChar.getDay(), hour: eightChar.getTime()
    },
    dayMaster: eightChar.getDayGan(),
    elements: {
      year: eightChar.getYearWuXing(), month: eightChar.getMonthWuXing(),
      day: eightChar.getDayWuXing(), hour: eightChar.getTimeWuXing()
    },
    tenGods: {
      year: eightChar.getYearShiShenGan(), month: eightChar.getMonthShiShenGan(),
      day: eightChar.getDayShiShenGan(), hour: eightChar.getTimeShiShenGan()
    }
  };
}
