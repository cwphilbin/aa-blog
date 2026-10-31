import { GetObjectCommand, ListObjectsV2Command, type S3Client } from '@aws-sdk/client-s3';
import type { MarketFile } from '../types';
import { mapWithConcurrency } from './concurrency.ts';
import { parseCanonicalStory, storyMonth } from './story.ts';

const BUCKET = 'aa-zip-metrics-prod';
const PREFIX = 'stories/';

/** Enrich only existing routes; absent/malformed stories retain legacy content. */
export async function attachCanonicalStories(markets: MarketFile[], s3: S3Client): Promise<void> {
  const keys = new Set<string>();
  let token: string | undefined;
  do {
    const page = await s3.send(new ListObjectsV2Command({
      Bucket: BUCKET, Prefix: PREFIX, ContinuationToken: token,
    }));
    for (const item of page.Contents ?? []) {
      if (item.Key && /^stories\/\d{4}-(0[1-9]|1[0-2])\/\d{5}\.json$/.test(item.Key)) keys.add(item.Key);
    }
    token = page.IsTruncated ? page.NextContinuationToken : undefined;
  } while (token);

  // Multiple posts for the same month share one canonical object/read.
  const targets = new Map<string, { zip: string; month: string; posts: MarketFile['posts'] }>();
  for (const market of markets) for (const post of market.posts) {
    const month = storyMonth(post);
    const key = `stories/${month}/${market.zip}.json`;
    if (!month || !keys.has(key)) continue;
    const target = targets.get(key) ?? { zip: market.zip, month, posts: [] };
    target.posts.push(post);
    targets.set(key, target);
  }
  let loaded = 0;
  await mapWithConcurrency([...targets], 12, async ([key, target]) => {
    let text: string | undefined;
    try {
      const result = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
      text = await result.Body?.transformToString();
    } catch (error) {
      if ((error as { name?: string }).name !== 'NoSuchKey') throw error;
      console.warn(`[stories] Story disappeared for ZIP ${target.zip}, ${target.month}; retaining feed content.`);
      return;
    }
    const story = parseCanonicalStory(text ?? '', target.zip, target.month);
    if (story) {
      for (const post of target.posts) post.story = story;
      loaded++;
    }
  });
  console.info(`[stories] Loaded ${loaded} canonical stories; existing routes retained.`);
}
