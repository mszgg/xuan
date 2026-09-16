import { astro } from 'iztro';
import type { Gender } from '../chart-types';

function toShanghaiParts(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error('birthDateTime 必须是有效且含时区的 ISO 8601 时间。');
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23' }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value);
  return { year: get('year'), month: get('month'), day: get('day'), hour: get('hour') };
}

export function calculateZiwei(input: { birthDateTime: string; gender: Gender }) {
  const birth = toShanghaiParts(input.birthDateTime);
  const timeIndex = Math.floor(((birth.hour + 1) % 24) / 2);
  const raw = astro.bySolar(`${birth.year}-${birth.month}-${birth.day}`, timeIndex, input.gender === 'male' ? '男' : '女', true, 'zh-CN');
  return {
    schemaVersion: 'ziwei-chart-1',
    calculator: { name: 'iztro', version: '2.6.1' },
    calculationPolicy: { timezone: 'Asia/Shanghai', leapMonthAdjustment: true, timeIndex },
    birth: { solar: raw.solarDate, lunar: raw.lunarDate, chineseDate: raw.chineseDate, time: raw.time },
    summary: { zodiac: raw.zodiac, sign: raw.sign, soul: raw.soul, body: raw.body, fiveElementsClass: raw.fiveElementsClass },
    palaces: raw.palaces.map((palace) => ({
      name: palace.name, earthlyBranch: palace.earthlyBranch, heavenlyStem: palace.heavenlyStem, isBodyPalace: palace.isBodyPalace,
      majorStars: palace.majorStars.map((star) => ({ name: star.name, brightness: star.brightness, mutagen: star.mutagen })),
      minorStars: palace.minorStars.map((star) => ({ name: star.name, brightness: star.brightness, mutagen: star.mutagen })),
      decadal: palace.decadal
    }))
  };
}
