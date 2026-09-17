export type Gender = 'male' | 'female';

export interface BaziInput {
  birthDateTime: string;
  gender: Gender;
}

export interface BaziChartJson {
  schemaVersion: 'bazi-chart-1';
  calculator: { name: 'lunar-javascript'; version: '1.7.7' };
  calculationPolicy: {
    timezone: 'Asia/Shanghai';
    yearBoundary: 'lichun';
    librarySect: 2;
    trueSolarTime: false;
  };
  birth: { normalizedAt: string; solar: string; lunar: string };
  pillars: { year: string; month: string; day: string; hour: string };
  dayMaster: string;
  elements: { year: string; month: string; day: string; hour: string };
  tenGods: { year: string; month: string; day: string; hour: string };
}

export interface AnalysisRequest {
  module: 'bazi' | 'ziwei' | 'qimen' | 'calendar';
  /** Cloudflare Turnstile token issued to the browser for this submission. */
  turnstileToken?: string;
  input: {
    gender?: Gender;
    birthDateTime?: string;
    question?: string;
    focus?: string;
  };
}
