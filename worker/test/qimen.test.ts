import { describe, expect, it } from 'vitest';
import { calculateQimenChart } from '../src/calculators/qimen';

describe('calculateQimenChart', () => {
  it('returns a deterministic, serializable hour chart with nine palaces', () => {
    const chart = calculateQimenChart('2026-09-16T10:30:00+08:00');
    expect(chart.schemaVersion).toBe('qimen-hour-chart-1');
    expect(chart.calculator).toEqual({ name: '3meta', version: '2.6.0' });
    expect(chart.policy).toMatchObject({ method: '时家转盘奇门', juMethod: '拆补法', timezone: 'Asia/Shanghai' });
    expect(chart.pillars).toEqual({ year: '丙午', month: '丁酉', day: '癸巳', hour: '丁巳' });
    expect(chart.dun).toEqual({ type: '阴', ju: 6 });
    expect(chart.yuan).toBe('下元');
    expect(chart.palaces).toHaveLength(9);
    expect(chart.palaces[0]).toMatchObject({ palace: '坎', earthPlate: '癸', heavenPlate: '丁', door: '伤门', star: '天英', deity: '白虎' });
  });

  it('normalizes offset input to the Asia/Shanghai wall-clock time', () => {
    const chart = calculateQimenChart('2026-09-16T02:30:00Z');
    expect(chart.questionTime).toBe('2026-09-16 10:30:00');
  });

  it.each([
    ['2024-01-15T10:30:00+08:00', '阳', 5, '下元'], ['2024-06-21T10:30:00+08:00', '阴', 3, '中元'],
    ['2024-12-21T10:30:00+08:00', '阴', 1, '下元'], ['2025-02-03T10:30:00+08:00', '阳', 9, '中元'],
    ['2025-06-21T10:30:00+08:00', '阳', 9, '下元'], ['2025-12-21T10:30:00+08:00', '阴', 4, '上元'],
    ['2026-03-20T10:30:00+08:00', '阳', 4, '下元'], ['2026-09-16T10:30:00+08:00', '阴', 6, '下元']
  ])('matches the validated external reference for %s', (input, type, ju, yuan) => {
    const chart = calculateQimenChart(input);
    expect(chart.dun).toEqual({ type, ju });
    expect(chart.yuan).toBe(yuan);
  });
});
