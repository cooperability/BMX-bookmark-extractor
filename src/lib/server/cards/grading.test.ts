import { describe, expect, it } from 'vitest';
import {
	classify,
	gradeRound,
	mergeStanding,
	MIN_CARDS_FOR_STRONG,
	STANDING_DECAY,
	standingOf,
	UNTAGGED
} from './grading';

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

describe('tag standing across rounds', () => {
	const areas = (cards: { tags: string[]; rating: number }[]) => gradeRound(cards).areas;

	it('keeps a tag weak until a later round re-tests it', () => {
		const s1 = mergeStanding([], areas([{ tags: ['a', 'b'], rating: 1 }]));
		expect(classify(s1).weak).toEqual(['a', 'b']);
		// Round 2 never measures `b`: it stays weak instead of being forgotten.
		const s2 = mergeStanding(
			s1,
			areas([
				{ tags: ['a'], rating: 3 },
				{ tags: ['a'], rating: 3 }
			])
		);
		expect(classify(s2).weak).toEqual(['b']);
	});

	it('needs two good rounds to lift a single miss out of weak', () => {
		const s1 = mergeStanding([], areas([{ tags: ['a'], rating: 1 }]));
		const s2 = mergeStanding(s1, areas([{ tags: ['a'], rating: 3 }]));
		// Evidence 0.75 miss + 1 hit: 0.57, still weak.
		expect(classify(s2).weak).toEqual(['a']);
		const s3 = mergeStanding(s2, areas([{ tags: ['a'], rating: 3 }]));
		// 1.75 / 2.31: 0.76, out of weak and short of strong.
		expect(classify(s3)).toEqual({ strong: [], weak: [] });
	});

	it('needs MIN_CARDS_FOR_STRONG of evidence before calling a tag strong', () => {
		const one = mergeStanding([], areas([{ tags: ['a'], rating: 4 }]));
		expect(classify(one).strong).toEqual([]);
		const two = mergeStanding(one, areas([{ tags: ['a'], rating: 4 }]));
		// 1 * 0.75 + 1 = 1.75 cards of evidence, still short of 2.
		expect(two[0].cards).toBeCloseTo(1.75);
		expect(classify(two).strong).toEqual([]);
		expect(classify(mergeStanding(two, areas([{ tags: ['a'], rating: 4 }]))).strong).toEqual(['a']);
	});

	it('lets a tag sampled once per round become strong', () => {
		let s = mergeStanding([], []);
		for (let i = 0; i < 10; i++) s = mergeStanding(s, areas([{ tags: ['a'], rating: 3 }]));
		expect(classify(s).strong).toEqual(['a']);
		expect(MIN_CARDS_FOR_STRONG).toBeLessThan(1 / (1 - STANDING_DECAY));
	});

	it('orders weak weakest first and strong strongest first', () => {
		const s = mergeStanding(
			[],
			areas([
				{ tags: ['mid', 'hard'], rating: 2 },
				{ tags: ['hard'], rating: 1 },
				{ tags: ['top', 'good'], rating: 4 },
				{ tags: ['top', 'good'], rating: 4 },
				{ tags: ['good'], rating: 4 },
				{ tags: ['good'], rating: 4 },
				{ tags: ['good'], rating: 2 }
			])
		);
		const c = classify(s);
		expect(c.weak).toEqual(['hard', 'mid']);
		expect(c.strong).toEqual(['top', 'good']);
	});

	it('seeds from a round stored before standing existed', () => {
		const legacy = { standing: null, areas: [{ tag: 'a', cards: 2, again: 1, score: 0.5 }] };
		expect(standingOf(legacy)).toEqual([{ tag: 'a', cards: 2, credit: 1 }]);
		expect(standingOf(null)).toEqual([]);
	});
});
