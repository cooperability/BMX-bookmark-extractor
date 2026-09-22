import { describe, expect, it } from 'vitest';
import { gradeRound, UNTAGGED } from './grading';

const area = (g: ReturnType<typeof gradeRound>, tag: string) => g.areas.find((a) => a.tag === tag);

describe('gradeRound', () => {
	it('returns a null score and no areas for an empty round', () => {
		expect(gradeRound([])).toEqual({ score: null, areas: [], strong: [], weak: [] });
	});

	it('credits Again 0, Hard 0.5, Good 1, Easy 1 and averages them', () => {
		const g = gradeRound([
			{ tags: ['a'], rating: 1 },
			{ tags: ['a'], rating: 2 },
			{ tags: ['a'], rating: 3 },
			{ tags: ['a'], rating: 4 }
		]);
		expect(g.score).toBeCloseTo(2.5 / 4);
		expect(gradeRound([{ tags: ['a'], rating: 2 }]).score).toBeCloseTo(0.5);
		expect(gradeRound([{ tags: ['a'], rating: 4 }]).score).toBeCloseTo(1);
		expect(gradeRound([{ tags: ['a'], rating: 1 }]).score).toBe(0);
	});

	it('counts untagged cards under the (untagged) area', () => {
		expect(UNTAGGED).toBe('(untagged)');
		const g = gradeRound([
			{ tags: [], rating: 3 },
			{ tags: [], rating: 1 }
		]);
		expect(area(g, '(untagged)')).toEqual({ tag: '(untagged)', cards: 2, again: 1, score: 0.5 });
	});

	it('counts a multi-tag card toward each tag', () => {
		const g = gradeRound([
			{ tags: ['x', 'y'], rating: 1 },
			{ tags: ['x'], rating: 3 }
		]);
		expect(area(g, 'x')).toEqual({ tag: 'x', cards: 2, again: 1, score: 0.5 });
		expect(area(g, 'y')).toEqual({ tag: 'y', cards: 1, again: 1, score: 0 });
		// Overall score is per card, not per tag entry.
		expect(g.score).toBeCloseTo(0.5);
	});

	it('marks a tag weak when its score is below 0.6, including a single Again', () => {
		const g = gradeRound([
			{ tags: ['miss'], rating: 1 },
			{ tags: ['edge'], rating: 2 },
			{ tags: ['edge'], rating: 3 }, // 0.75, not weak
			{ tags: ['hard'], rating: 2 } // 0.5, weak
		]);
		expect([...g.weak].sort()).toEqual(['hard', 'miss']);
	});

	it('marks strong only with at least 2 cards and score >= 0.85', () => {
		const g = gradeRound([
			{ tags: ['solo'], rating: 4 },
			{ tags: ['pair'], rating: 3 },
			{ tags: ['pair'], rating: 4 },
			{ tags: ['mixed'], rating: 3 },
			{ tags: ['mixed'], rating: 3 },
			{ tags: ['mixed'], rating: 3 },
			{ tags: ['mixed'], rating: 2 }, // 3.5/4 = 0.875
			{ tags: ['under'], rating: 3 },
			{ tags: ['under'], rating: 2 } // 0.75
		]);
		expect([...g.strong].sort()).toEqual(['mixed', 'pair']);
	});

	it('sorts areas weakest first', () => {
		const g = gradeRound([
			{ tags: ['good'], rating: 3 },
			{ tags: ['bad'], rating: 1 },
			{ tags: ['mid'], rating: 2 }
		]);
		expect(g.areas.map((a) => a.tag)).toEqual(['bad', 'mid', 'good']);
	});
});
