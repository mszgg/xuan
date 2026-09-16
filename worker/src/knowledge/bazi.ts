import type { BaziChartJson } from '../chart-types';

export interface KnowledgeSnippet {
  id: string;
  title: string;
  text: string;
}

// These are product-authored, short guidance notes. They deliberately do not
// reproduce or index the upstream research corpus.
const BASE_SNIPPETS: KnowledgeSnippet[] = [
  {
    id: 'scope',
    title: '解读边界',
    text: '八字解读属于传统文化与娱乐性参考，不构成医疗、法律、投资或人生重大决定建议。陈述应使用可能性语言，并说明结论以命盘结构为依据。'
  },
  {
    id: 'method',
    title: '解读方法',
    text: '先引用可验证的盘面事实（四柱、日主、五行、十神），再说明传统命理中常见的观察角度；不要把单一元素或单一十神推导成确定的性格、疾病、财富或事件。'
  }
];

const DAY_MASTER_SNIPPETS: Record<string, KnowledgeSnippet> = {
  '己': {
    id: 'day-master-ji',
    title: '己土日主的观察角度',
    text: '传统命理常把己土作为日主时，先结合月令、通根、同类与异类五行的分布观察，不应仅凭“己土”单独下结论。'
  }
};

export function selectBaziKnowledge(chart: BaziChartJson): KnowledgeSnippet[] {
  const selected = [...BASE_SNIPPETS];
  const dayMaster = DAY_MASTER_SNIPPETS[chart.dayMaster];
  if (dayMaster) selected.push(dayMaster);
  return selected.slice(0, 3);
}
