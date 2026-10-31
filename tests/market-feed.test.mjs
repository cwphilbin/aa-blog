import assert from 'node:assert/strict';
import test from 'node:test';
import { parseMarketFeed } from '../src/lib/market-feed.ts';

const market = () => ({
  zip: '28215', name: 'Charlotte', url: 'https://agentsautomated.com/market/28215',
  agent: { name: '', tier: '' },
  posts: [{
    slug: 'september-2026-market-update', title: 'September update',
    date: '2026-09-15', summary: '', videoUrl: '', bodyHtml: '<p>Market update</p>',
    slideImages: [],
    metrics: { medianPrice: 343000, yoyChange: 0, inventory: 133, daysOnMarket: 34, newListings: 0, pricePerSqft: 200 },
  }],
});

test('keeps valid feeds, including zero metrics and empty agent branding', () => {
  const feed = market();
  assert.deepEqual(parseMarketFeed(JSON.stringify(feed), '28215', assert.fail), feed);
});

test('preserves ZIP 28215 with null YoY and other unavailable metrics', () => {
  const feed = market();
  feed.posts[0].metrics.yoyChange = null;
  feed.posts[0].metrics.newListings = null;
  assert.deepEqual(parseMarketFeed(JSON.stringify(feed), '28215', assert.fail), feed);
});

test('malformed JSON logs no raw feed contents', () => {
  const warnings = [];
  assert.equal(parseMarketFeed('{private-feed-content', '28215', (m) => warnings.push(m)), undefined);
  assert.deepEqual(warnings, ['[markets] Skipping invalid posts.json for ZIP 28215: malformed JSON']);
});

test('rejects unsafe template inputs before route generation', () => {
  const cases = [
    null,
    { ...market(), zip: '99999' },
    { ...market(), posts: null },
    { ...market(), agent: null },
    { ...market(), agent: { name: null } },
  ];
  for (const mutate of [
    (f) => { f.posts[0].slideImages = null; },
    (f) => { f.posts[0].metrics = null; },
    (f) => { delete f.posts[0].metrics.yoyChange; },
    (f) => { f.posts[0].metrics.yoyChange = '4.2'; },
    (f) => { f.posts[0].date = 'invalid'; },
    (f) => { f.posts[0].slug = '../escape'; },
    (f) => { f.posts.push(structuredClone(f.posts[0])); },
  ]) {
    const feed = market();
    mutate(feed);
    cases.push(feed);
  }
  for (const feed of cases) {
    const warnings = [];
    assert.equal(parseMarketFeed(JSON.stringify(feed), '28215', (m) => warnings.push(m)), undefined);
    assert.equal(warnings.length, 1);
  }
});

test('one invalid feed does not prevent valid feeds from being returned', () => {
  const invalid = market();
  invalid.posts[0].metrics.yoyChange = 'invalid';
  const valid = market();
  const feeds = [JSON.stringify(invalid), JSON.stringify(valid), '{bad json'];
  const warnings = [];
  const result = feeds.map((body) => parseMarketFeed(body, '28215', (m) => warnings.push(m))).filter(Boolean);
  assert.deepEqual(result, [valid]);
  assert.equal(warnings.length, 2);
});
