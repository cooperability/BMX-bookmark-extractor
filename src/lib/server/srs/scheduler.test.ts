import { fsrs, generatorParameters, State, type Grade } from 'ts-fsrs';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import {
	cardToRow,
	grade,
	newCardRow,
	previewIntervals,
	rowToCard,
	type SchedulerRow
} from './scheduler';

const NOW = new Date('2026-01-01T00:00:00.000Z');
const DAY_MS = 24 * 60 * 60 * 1000;

function makeRow(state: State, overrides: Partial<SchedulerRow> = {}): SchedulerRow {
	return {
		stability: state === State.New ? 0 : 12,
		difficulty: state === State.New ? 0 : 5,
		due: NOW,
		reps: state === State.New ? 0 : 3,
		lapses: 0,
		state,
		lastReview: state === State.New ? null : new Date(NOW.getTime() - 3 * DAY_MS),
		learningSteps: 0,
		...overrides
	};
}

const RATINGS = [1, 2, 3, 4] as const satisfies readonly Grade[];
const RATING_NAME: Record<Grade, string> = { 1: 'Again', 2: 'Hard', 3: 'Good', 4: 'Easy' };

describe.each([
	['new', State.New],
	['learning', State.Learning],
	['review', State.Review],
	['relearning', State.Relearning]
] as const)('grade: a %s card', (_label, state) => {
	it.each(RATINGS)('rating %s schedules due >= now, reps + 1, positive stability', (rating) => {
		const row = makeRow(state);
		const { card, log } = grade(rowToCard(row), rating, NOW);

		expect(card.due.getTime()).toBeGreaterThanOrEqual(NOW.getTime());
		expect(card.reps).toBe(row.reps + 1);
		expect(card.stability).toBeGreaterThan(0);
		expect(card.state).not.toBe(State.New);
		expect(log.rating).toBe(rating);
	});
});

describe('lapses (review_log / review_state invariant)', () => {
	it('increments on Again from a review-state card', () => {
		const row = makeRow(State.Review, { lapses: 2 });
		const { card } = grade(rowToCard(row), 1, NOW);
		expect(card.lapses).toBe(3);
	});

	it.each([2, 3, 4] as const)(
		'does not increment on rating %s from a review-state card',
		(rating) => {
			const row = makeRow(State.Review, { lapses: 2 });
			const { card } = grade(rowToCard(row), rating, NOW);
			expect(card.lapses).toBe(2);
		}
	);

	it.each(RATINGS)('does not increment on rating %s from a new card', (rating) => {
		const row = makeRow(State.New);
		const { card } = grade(rowToCard(row), rating, NOW);
		expect(card.lapses).toBe(0);
	});
});

describe('previewIntervals (CRD-2)', () => {
	it('orders Easy >= Good >= Hard for a review-state card', () => {
		const row = makeRow(State.Review);
		const preview = previewIntervals(rowToCard(row), NOW);

		expect(preview[4].getTime()).toBeGreaterThanOrEqual(preview[3].getTime());
		expect(preview[3].getTime()).toBeGreaterThanOrEqual(preview[2].getTime());
	});

	it('agrees with grade() for the same row, rating and now', () => {
		const row = makeRow(State.Review);
		const preview = previewIntervals(rowToCard(row), NOW);

		for (const rating of RATINGS) {
			const { card } = grade(rowToCard(row), rating, NOW);
			expect(preview[rating].getTime(), `rating ${RATING_NAME[rating]}`).toBe(card.due.getTime());
		}
	});

	it('never previews Again later than Good', () => {
		for (const state of [State.New, State.Learning, State.Review, State.Relearning]) {
			const preview = previewIntervals(rowToCard(makeRow(state)), NOW);
			expect(preview[1].getTime()).toBeLessThanOrEqual(preview[3].getTime());
		}
	});
});

describe('newCardRow', () => {
	it('is an unscheduled new card due immediately', () => {
		const row = newCardRow(NOW);
		expect(row.state).toBe(State.New);
		expect(row.reps).toBe(0);
		expect(row.lapses).toBe(0);
		expect(row.stability).toBe(0);
		expect(row.due.getTime()).toBe(NOW.getTime());
		expect(row.lastReview).toBeNull();
	});
});

describe('row <-> card round trip', () => {
	it('preserves every field through rowToCard -> cardToRow', () => {
		const row = makeRow(State.Review, {
			stability: 7.5,
			difficulty: 4.25,
			reps: 11,
			lapses: 2,
			learningSteps: 1
		});
		const roundTripped = cardToRow(rowToCard(row));

		expect(roundTripped.stability).toBe(row.stability);
		expect(roundTripped.difficulty).toBe(row.difficulty);
		expect(roundTripped.due.getTime()).toBe(row.due.getTime());
		expect(roundTripped.reps).toBe(row.reps);
		expect(roundTripped.lapses).toBe(row.lapses);
		expect(roundTripped.state).toBe(row.state);
		expect(roundTripped.lastReview?.getTime()).toBe(row.lastReview?.getTime());
		expect(roundTripped.learningSteps).toBe(row.learningSteps);
	});

	it('preserves a null lastReview (new card)', () => {
		const row = makeRow(State.New);
		expect(cardToRow(rowToCard(row)).lastReview).toBeNull();
	});
});

describe('learningSteps persistence (row round trip)', () => {
	// Default learning_steps is ['1m', '10m'] (2 entries): a New card graded
	// Good twice should graduate to Review. Reset learning_steps to 0 on every
	// row load (the pre-fix mapping) and Good never advances past the first
	// step, because the row never remembers which step it is on.
	it('reaches Review within the default learning steps, graded Good through a row round trip each time', () => {
		let row = newCardRow(NOW);
		let now = NOW;
		const maxGoods = 5;

		for (let i = 0; i < maxGoods && row.state !== State.Review; i++) {
			const { card } = grade(rowToCard(row), 3, now);
			row = cardToRow(card);
			now = card.due;
		}

		expect(row.state).toBe(State.Review);
	});

	// Same sequence, but never round-tripped through the row: grade() is fed
	// its own previous Card output directly. Must reach Review on the same
	// schedule as the round-tripped path above.
	it('matches the no-round-trip path', () => {
		let card = rowToCard(newCardRow(NOW));
		let now = NOW;
		for (let i = 0; i < 5 && card.state !== State.Review; i++) {
			card = grade(card, 3, now).card;
			now = card.due;
		}

		let row = newCardRow(NOW);
		now = NOW;
		for (let i = 0; i < 5 && row.state !== State.Review; i++) {
			const result = grade(rowToCard(row), 3, now);
			row = cardToRow(result.card);
			now = result.card.due;
		}

		expect(row.state).toBe(State.Review);
		expect(row.due.getTime()).toBe(card.due.getTime());
	});
});

// A real `new Date()` inside scheduler.ts (instead of using the injected `now`)
// would otherwise be caught only incidentally, if at all — the fake system
// clock below is set far from NOW, so any wall-clock read produces a due date
// long before NOW and trips the "due >= now" invariant.
const WALL_CLOCK_FAR_FROM_NOW = new Date('2001-01-01T00:00:00.000Z');

describe('determinism', () => {
	beforeAll(() => {
		vi.useFakeTimers();
		vi.setSystemTime(WALL_CLOCK_FAR_FROM_NOW);
	});
	afterAll(() => {
		vi.useRealTimers();
	});

	it('the same row, rating and now produce identical output twice', () => {
		const row = makeRow(State.Review, { stability: 33.7, difficulty: 6.2 });
		const a = grade(rowToCard(row), 3, NOW);
		const b = grade(rowToCard(row), 3, NOW);

		expect(a.card).toEqual(b.card);
		expect(a.log).toEqual(b.log);
	});
});

describe('fuzz (TDD §8: enable_fuzz stays on)', () => {
	// A locally-built unfuzzed instance as the negative control. If scheduler.ts's
	// fuzz were ever turned off, every one of these due dates would match this
	// baseline instead of differing for at least one.
	const unfuzzed = fsrs(generatorParameters({ enable_fuzz: false }));

	it('differs from an unfuzzed FSRS instance for at least one review-state card', () => {
		const stabilities = [5, 10, 20, 40, 80, 150, 300];
		const anyDiffer = stabilities.some((stability) => {
			const card = rowToCard(makeRow(State.Review, { stability }));
			const fuzzedDue = grade(card, 3, NOW).card.due.getTime();
			const plainDue = unfuzzed.next(card, NOW, 3).card.due.getTime();
			return fuzzedDue !== plainDue;
		});

		expect(anyDiffer).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// Property tests: a seeded PRNG drives >=500 random (row, rating) pairs through
// grade() and asserts invariants that must hold for every FSRS-6 transition,
// not just the hand-picked table cases above.
// ---------------------------------------------------------------------------

// mulberry32: https://gist.github.com/tommyettinger/46a874533244883189143505d203312
function mulberry32(seed: number): () => number {
	let a = seed;
	return () => {
		a |= 0;
		a = (a + 0x6d2b79f5) | 0;
		let t = Math.imul(a ^ (a >>> 15), 1 | a);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

function randomState(rand: () => number): State {
	return Math.floor(rand() * 4) as State;
}

function randomRow(rand: () => number): SchedulerRow {
	const state = randomState(rand);
	const isNew = state === State.New;
	const isBursting = state === State.Learning || state === State.Relearning;
	return {
		stability: isNew ? 0 : 0.01 + rand() * 200,
		difficulty: isNew ? 0 : 1 + rand() * 9,
		due: new Date(NOW.getTime() + Math.floor((rand() - 0.5) * 60) * DAY_MS),
		reps: Math.floor(rand() * 30),
		lapses: Math.floor(rand() * 8),
		state,
		lastReview: isNew ? null : new Date(NOW.getTime() - Math.floor(rand() * 400) * DAY_MS),
		learningSteps: isBursting ? Math.floor(rand() * 2) : 0
	};
}

function randomRating(rand: () => number): Grade {
	return (Math.floor(rand() * 4) + 1) as Grade;
}

describe('property: 500 random (row, rating) transitions', () => {
	beforeAll(() => {
		vi.useFakeTimers();
		vi.setSystemTime(WALL_CLOCK_FAR_FROM_NOW);
	});
	afterAll(() => {
		vi.useRealTimers();
	});

	const rand = mulberry32(0xc0ffee);
	const ITERATIONS = 500;

	for (let i = 0; i < ITERATIONS; i++) {
		const row = randomRow(rand);
		const rating = randomRating(rand);

		it(`#${i}: state=${row.state} rating=${RATING_NAME[rating]} reps=${row.reps} lapses=${row.lapses}`, () => {
			const startState = row.state;
			const startLapses = row.lapses;
			const { card } = grade(rowToCard(row), rating, NOW);

			// due is never in the past relative to the injected `now`.
			expect(card.due.getTime()).toBeGreaterThanOrEqual(NOW.getTime());

			// stability is always positive after any review.
			expect(card.stability).toBeGreaterThan(0);

			// reps always advances by exactly one.
			expect(card.reps).toBe(row.reps + 1);

			// lapses increments only on Again from a review-state card.
			if (startState === State.Review && rating === 1) {
				expect(card.lapses).toBe(startLapses + 1);
			} else {
				expect(card.lapses).toBe(startLapses);
			}

			// Again is never scheduled later than Good for the same starting card.
			const good = grade(rowToCard(row), 3, NOW).card;
			expect(card.due.getTime() <= good.due.getTime() || rating !== 1).toBe(true);

			// Easy >= Good >= Hard >= Again for review-state cards (TDD §8).
			if (startState === State.Review) {
				const again = grade(rowToCard(row), 1, NOW).card;
				const hard = grade(rowToCard(row), 2, NOW).card;
				const easy = grade(rowToCard(row), 4, NOW).card;
				expect(easy.due.getTime()).toBeGreaterThanOrEqual(good.due.getTime());
				expect(good.due.getTime()).toBeGreaterThanOrEqual(hard.due.getTime());
				expect(hard.due.getTime()).toBeGreaterThanOrEqual(again.due.getTime());
			}

			// round trip through the row shape preserves every field grade() produced.
			const roundTripped = cardToRow(card);
			expect(roundTripped.stability).toBe(card.stability);
			expect(roundTripped.difficulty).toBe(card.difficulty);
			expect(roundTripped.due.getTime()).toBe(card.due.getTime());
			expect(roundTripped.state).toBe(card.state);
			expect(roundTripped.reps).toBe(card.reps);
			expect(roundTripped.lapses).toBe(card.lapses);
			expect(roundTripped.lastReview?.getTime()).toBe(card.last_review?.getTime());
		});
	}
});
