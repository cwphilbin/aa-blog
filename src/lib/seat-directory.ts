import { readFile } from 'node:fs/promises';
import { loadSeatDirectory } from '../server/seat-directory.mjs';
import type { SeatAgent } from './seat-agents';
export interface SeatDirectory { agents: SeatAgent[]; zips: Record<string,string> }
// Explicit local-only fixtures never run on Netlify. Production fails closed on lookup errors.
if (process.env.SEAT_REVIEW_FILE && process.env.NETLIFY) throw new Error('Review fixtures cannot be deployed');
export const seatDirectory: SeatDirectory = process.env.SEAT_REVIEW_FILE
  ? JSON.parse(await readFile(process.env.SEAT_REVIEW_FILE, 'utf8')) : await loadSeatDirectory();
export const seatForZip = (zip: string) => seatDirectory.agents.find(a => a.slug === seatDirectory.zips[zip]);
export const aaAgent = { name: '', brokerage: '', photoUrl: '', siteUrl: '', ctaUrl: '', phone: '', email: '', license: '', tier: 'standard' as const };
