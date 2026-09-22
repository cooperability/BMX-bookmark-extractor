import { describe, expect, it, vi } from 'vitest';

// The client needs DATABASE_URL and $app modules. Only the pure helpers run here.
vi.mock('../db', () => ({ db: {} }));

import { addDays, band, dueForecast, heatmap, streakDays, tagMastery, utcDay } from './stats';

const at = (iso: string) => new Date(iso);

describe('utcDay', () => {
	it('buckets by the UTC calendar day, not the local one', () => {
		expect(utcDay(at('2026-09-21T23:59:59Z'))).toBe('2026-09-21');
		expect(utcDay(at('2026-09-21T20:00:00-05:00'))).toBe('2026-09-22');
	});

	it('addDays crosses month and year boundaries', () => {
		expect(addDays('2026-02-28', 1)).toBe('2026-03-01');
		expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
	});
});

describe('streakDays', () => {
	const now = at('2026-09-21T15:00:00Z');

	it('counts consecutive days ending today', () => {
		expect(streakDays(['2026-09-21', '2026-09-20', '2026-09-19'], now)).toBe(3);
	});

	it('stops at the first gap', () => {
		expect(streakDays(['2026-09-21', '2026-09-20', '2026-09-18', '2026-09-17'], now)).toBe(2);
	});

	it('keeps a streak alive through today until today ends', () => {
		expect(streakDays(['2026-09-20', '2026-09-19'], now)).toBe(2);
	});

	it('is zero when neither today nor yesterday has a review', () => {
		expect(streakDays(['2026-09-19', '2026-09-18'], now)).toBe(0);
		expect(streakDays([], now)).toBe(0);
	});

	it('ignores days after today', () => {
		expect(streakDays(['2026-09-22', '2026-09-21'], now)).toBe(1);
	});
});

describe('heatmap', () => {
	// 2026-09-23 is a Wednesday.
	const now = at('2026-09-23T10:00:00Z');

	it('lays out 12 Monday-first weeks whose last column holds today', () => {
		const grid = heatmap(new Map(), now);
		expect(grid).toHaveLength(12);
		expect(grid.every((w) => w.length === 7)).toBe(true);
		expect(grid[11][0]?.day).toBe('2026-09-21');
		expect(grid[11][2]?.day).toBe('2026-09-23');
		expect(grid[0][0]?.day).toBe(addDays('2026-09-21', -77));
	});

	it('leaves days after today empty', () => {
		const last = heatmap(new Map(), now)[11];
		expect(last.slice(3)).toEqual([null, null, null, null]);
	});

	it('scales levels 1..4 against the busiest day in the window', () => {
		const counts = new Map([
			['2026-09-21', 8],
			['2026-09-22', 1],
			['2026-09-23', 4],
			['2026-01-01', 1000] // outside the window: must not flatten the scale
		]);
		const [mon, tue, wed] = heatmap(counts, now)[11];
		expect(mon).toEqual({ day: '2026-09-21', count: 8, level: 4 });
		expect(tue?.level).toBe(1);
		expect(wed?.level).toBe(2);
		expect(heatmap(counts, now)[10][0]).toEqual({ day: '2026-09-14', count: 0, level: 0 });
	});
});

describe('dueForecast', () => {
	const now = at('2026-09-21T15:00:00Z');

	it('returns one bucket per day starting today', () => {
		const f = dueForecast([], now);
		expect(f).toHaveLength(14);
		expect(f[0].day).toBe('2026-09-21');
		expect(f[13].day).toBe('2026-10-04');
	});

	it('counts overdue cards toward today and drops cards past the horizon', () => {
		const f = dueForecast(
			[
				at('2026-09-01T00:00:00Z'), // overdue
				at('2026-09-21T23:00:00Z'), // later today
				at('2026-09-22T00:00:00Z'), // tomorrow, first instant
				at('2026-10-04T23:59:59Z'), // last day in range
				at('2026-10-05T00:00:00Z') // first day out of range
			],
			now
		);
		expect(f.map((d) => d.count)).toEqual([2, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1]);
	});
});

describe('tagMastery', () => {
	it('counts cards and reviewed cards per tag, untagged cards under (untagged)', () => {
		const rows = tagMastery(
			[
				{ tags: ['a', 'b'], stability: 10 },
				{ tags: ['a'], stability: 2 },
				{ tags: ['a'], stability: null },
				{ tags: [], stability: null }
			],
			null
		);
		expect(rows).toEqual([
			{ tag: 'a', cards: 3, reviewed: 2, stability: 6, score: null, band: null },
			{ tag: '(untagged)', cards: 1, reviewed: 0, stability: null, score: null, band: null },
			{ tag: 'b', cards: 1, reviewed: 1, stability: 10, score: null, band: null }
		]);
	});

	it('takes each tag score from the latest round areas', () => {
		const [a, b] = tagMastery(
			[
				{ tags: ['a'], stability: 1 },
				{ tags: ['a'], stability: 1 },
				{ tags: ['b'], stability: 1 }
			],
			[{ tag: 'b', cards: 1, again: 1, score: 0 }]
		);
		expect(a.score).toBeNull();
		expect(b).toMatchObject({ tag: 'b', score: 0, band: 'weak' });
	});
});

describe('band', () => {
	it('uses the grading thresholds: >= 0.85 strong, < 0.6 weak', () => {
		expect(band(0.85)).toBe('strong');
		expect(band(0.84)).toBe('mid');
		expect(band(0.6)).toBe('mid');
		expect(band(0.59)).toBe('weak');
		expect(band(null)).toBeNull();
	});
});
