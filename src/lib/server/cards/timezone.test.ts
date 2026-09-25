import { describe, expect, it, vi } from 'vitest';
import { toTimeZone } from '$lib/timezone';

vi.mock('../db', () => ({ db: {} }));
const { dayIn, dueForecast, heatmap, streakDays } = await import('./stats');

const LA = 'America/Los_Angeles';
const at = (iso: string) => new Date(iso);

describe('toTimeZone', () => {
	it('keeps an IANA zone and falls back to UTC for anything else', () => {
		expect(toTimeZone(LA)).toBe(LA);
		expect(toTimeZone('Asia/Kolkata')).toBe('Asia/Kolkata');
		expect(toTimeZone(undefined)).toBe('UTC');
		expect(toTimeZone('Mars/Olympus')).toBe('UTC');
		expect(toTimeZone("UTC'; drop table nodes; --")).toBe('UTC');
		expect(toTimeZone('x'.repeat(80))).toBe('UTC');
	});
});

describe('days in the user time zone', () => {
	it('dayIn puts 03:00 UTC on the previous day in Los Angeles', () => {
		expect(dayIn(at('2026-09-22T03:00:00Z'), LA)).toBe('2026-09-21');
		expect(dayIn(at('2026-09-22T03:00:00Z'))).toBe('2026-09-22');
	});

	it('counts an evening and the next morning as two days, where UTC saw one', () => {
		// 20:00 Monday and 09:00 Tuesday in Los Angeles are both Tuesday in UTC.
		const reviews = [at('2026-09-22T03:00:00Z'), at('2026-09-22T16:00:00Z')];
		const now = at('2026-09-22T17:00:00Z');
		expect(streakDays(new Set(reviews.map((d) => dayIn(d, LA))), now, LA)).toBe(2);
		expect(streakDays(new Set(reviews.map((d) => dayIn(d))), now)).toBe(1);
	});

	it('ends the heatmap on the local today and its local weekday', () => {
		// Monday 2026-09-21 20:00 in Los Angeles is Tuesday in UTC.
		const now = at('2026-09-22T03:00:00Z');
		const last = heatmap(new Map(), now, 12, LA)[11];
		expect(last[0]?.day).toBe('2026-09-21');
		expect(last[1]).toBeNull();
	});

	it('buckets due dates by local day', () => {
		const now = at('2026-09-22T03:00:00Z'); // Monday evening in LA
		// Tuesday 01:00 local: tomorrow in LA, today in UTC.
		const due = at('2026-09-22T08:00:00Z');
		expect(dueForecast([due], now, 3, LA).map((d) => d.count)).toEqual([0, 1, 0]);
		expect(dueForecast([due], now, 3).map((d) => d.count)).toEqual([1, 0, 0]);
	});
});
