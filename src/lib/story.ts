export interface StoryChart {
  url: string;
  label?: string;
  months?: string[];
  values?: (number | null)[];
}

export interface CanonicalStory {
  schemaVersion: 1;
  storyId: string;
  storyVersion: string;
  zip: string;
  month: string;
  status: 'ready';
  county?: string | null;
  state?: string | null;
  generatedAt: string;
  headline: string;
  tldr: string;
  context: string;
  shift: string;
  proof: string;
  takeaway: string;
  cta: string;
  findings: { metric: string; text: string }[];
  charts: { trend?: StoryChart | null; comparison?: StoryChart | null };
}

const record = (v: unknown): v is Record<string, unknown> =>
  v !== null && typeof v === 'object' && !Array.isArray(v);

export function storyMonth(post: { id?: string; date: string }): string | undefined {
  const month = /^(\d{4}-(?:0[1-9]|1[0-2]))-/.exec(post.id ?? '')?.[1]
    ?? /^(\d{4}-(?:0[1-9]|1[0-2]))-/.exec(post.date)?.[1];
  return month;
}

/** Keep chart requests inside the canonical story's own public S3 directory. */
export function validStoryChartUrl(value: unknown, zip: string, month: string): boolean {
  if (typeof value !== 'string') return false;
  try {
    const url = new URL(value);
    return url.origin === 'https://aa-zip-metrics-prod.s3.us-east-2.amazonaws.com'
      && url.pathname.startsWith(`/stories/${month}/${zip}/`)
      && /\.(png|jpg|jpeg|webp)$/.test(url.pathname)
      && !url.username && !url.password && !url.search && !url.hash;
  } catch { return false; }
}

export function parseCanonicalStory(
  text: string, zip: string, month: string,
  warn: (message: string) => void = console.warn,
): CanonicalStory | undefined {
  const invalid = (reason: string) => {
    warn(`[stories] Skipping malformed story for ZIP ${zip}, ${month}: ${reason}`);
    return undefined;
  };
  let value: unknown;
  try { value = JSON.parse(text); } catch { return invalid('invalid JSON'); }
  if (!record(value) || value.schemaVersion !== 1 || value.status !== 'ready') {
    return invalid('expected ready schemaVersion 1');
  }
  if (value.zip !== zip || value.month !== month || value.storyId !== `${month}/${zip}`) {
    return invalid('story identity does not match its S3 path');
  }
  for (const field of ['storyVersion', 'generatedAt', 'headline', 'tldr', 'context', 'shift', 'proof', 'takeaway', 'cta']) {
    if (typeof value[field] !== 'string' || !value[field].trim()) return invalid(`missing ${field}`);
  }
  for (const field of ['county', 'state']) {
    if (value[field] != null && typeof value[field] !== 'string') return invalid(`invalid ${field}`);
  }
  if (!Number.isFinite(Date.parse(value.generatedAt as string))) return invalid('invalid generatedAt');
  if (!Array.isArray(value.findings) || value.findings.some(f =>
    !record(f) || typeof f.metric !== 'string' || typeof f.text !== 'string' || !f.text.trim())) {
    return invalid('invalid findings');
  }
  if (!record(value.charts)) return invalid('invalid charts');
  for (const key of ['trend', 'comparison']) {
    const chart = value.charts[key];
    if (chart == null) continue;
    if (!record(chart) || !validStoryChartUrl(chart.url, zip, month)) return invalid(`invalid ${key} chart`);
    if (chart.label !== undefined && typeof chart.label !== 'string') return invalid(`invalid ${key} label`);
  }
  return value as unknown as CanonicalStory;
}
