import { describe, expect, it } from 'vitest';
import { calculateBazi } from '../src/calculators/bazi';
import { buildInterpretationMessages } from '../src/llm';

describe('calculateBazi', () => {
  it('returns a versioned, serializable deterministic chart', () => {
    const chart = calculateBazi({ birthDateTime: '1998-08-10T09:30:00+08:00', gender: 'female' });
    expect(chart.schemaVersion).toBe('bazi-chart-1');
    expect(chart.calculator.version).toBe('1.7.7');
    expect(chart.pillars.year).toHaveLength(2);
    expect(chart.pillars.day).toHaveLength(2);
    expect(JSON.parse(JSON.stringify(chart))).toEqual(chart);
  });

  it('normalizes an offset input into the fixed Beijing calculation timezone', () => {
    const chart = calculateBazi({ birthDateTime: '1998-08-10T01:30:00Z', gender: 'male' });
    expect(chart.birth.normalizedAt).toBe('1998-08-10T09:30:00+08:00');
  });

  it('builds a bounded interpretation prompt from the chart and curated snippets only', () => {
    const chart = calculateBazi({ birthDateTime: '1998-08-10T09:30:00+08:00', gender: 'female' });
    const messages = buildInterpretationMessages(chart, '请说明事业方面的观察角度');
    expect(messages.user).toContain('"dayMaster":"己"');
    expect(messages.sources).toHaveLength(3);
    expect(messages.system).toContain('解读边界');
    expect(messages.system).toContain('严禁在最终解读中出现任何计算机或实现术语');
    expect(messages.system).toContain('可另作大运、流年的传统推演');
    expect(messages.system).not.toContain('research/upstream');
  });
});
