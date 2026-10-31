import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseCanonicalStory, storyMonth, validStoryChartUrl } from '../src/lib/story.ts';
import { attachCanonicalStories } from '../src/lib/stories.ts';
import type { S3Client } from '@aws-sdk/client-s3';
import type { MarketFile } from '../src/types.ts';

const text = readFileSync(new URL('./fixtures/story-90011.json', import.meta.url), 'utf8');
const fixture = JSON.parse(text);
test('published story retains canonical wording, order, and chart URLs', () => {
  const story = parseCanonicalStory(text, '90011', '2026-09', assert.fail)!;
  assert.deepEqual(story, fixture);
  assert.equal(story.findings[0].metric, 'for_sale_vs_sold');
});
test('story month follows content identity, not a rerun publication date', () => {
  assert.equal(storyMonth({ id: '2026-09-market-update', date: '2026-10-31' }), '2026-09');
  assert.equal(storyMonth({ date: '2026-09-15' }), '2026-09');
  assert.equal(storyMonth({ date: 'invalid' }), undefined);
});
test('malformed, mismatched, and unready stories are rejected without raw-content logging', () => {
  for (const input of ['{private-content', 'null', JSON.stringify({...fixture, status:'draft'}), JSON.stringify({...fixture, zip:'90012'}), JSON.stringify({...fixture, findings:[null]})]) {
    const warnings: string[] = [];
    assert.equal(parseCanonicalStory(input, '90011', '2026-09', m => warnings.push(m)), undefined);
    assert.equal(warnings.length, 1);
    assert.ok(!warnings[0].includes('private-content'));
  }
});
test('chart URLs must stay in the same canonical story directory', () => {
  assert.ok(validStoryChartUrl(fixture.charts.trend.url, '90011', '2026-09'));
  for (const url of ['javascript:alert(1)', 'https://example.com/chart.png', fixture.charts.trend.url.replace('90011','90012'), fixture.charts.trend.url+'?token=secret']) {
    assert.equal(validStoryChartUrl(url, '90011', '2026-09'), false);
  }
});
test('unavailable chart data remains null; no zero is invented', () => {
  const data = structuredClone(fixture);
  data.charts.trend.values[0] = null;
  assert.equal(parseCanonicalStory(JSON.stringify(data), '90011', '2026-09', assert.fail)!.charts.trend!.values![0], null);
});
test('missing optional geography does not discard an otherwise ready story', () => {
  const data = {...fixture, county: '', state: null};
  assert.ok(parseCanonicalStory(JSON.stringify(data), '90011', '2026-09', assert.fail));
});
test('loader paginates, shares month reads, and preserves routes without stories', async () => {
  let lists = 0, reads = 0;
  const s3 = { send: async (command: {input: {Key?: string}}) => {
    if (!command.input.Key) return ++lists === 1
      ? {Contents: [], IsTruncated: true, NextContinuationToken: 'next'}
      : {Contents: [{Key:'stories/2026-09/90011.json'}, {Key:'stories/2026-09/90011/chart-trend.png'}]};
    reads++;
    return {Body:{transformToString:async()=>text}};
  }} as unknown as S3Client;
  const markets = [{zip:'90011',posts:[{id:'2026-09-market-update',date:'2026-09-15'},{date:'2026-09-20'}]}, {zip:'90012',posts:[{date:'2026-09-15'}]}] as MarketFile[];
  await attachCanonicalStories(markets, s3);
  assert.equal(lists, 2); assert.equal(reads, 1);
  assert.equal(markets[0].posts[0].story?.headline, fixture.headline);
  assert.equal(markets[0].posts[0].story, markets[0].posts[1].story);
  assert.equal(markets[1].posts.length, 1);
  assert.equal(markets[1].posts[0].story, undefined);
});
test('authorization failures remain visible instead of silently omitting stories', async () => {
  const s3 = {send:async()=>{throw new Error('AccessDenied')}} as unknown as S3Client;
  await assert.rejects(attachCanonicalStories([], s3), /AccessDenied/);
});
