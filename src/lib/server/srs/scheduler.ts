import { createEmptyCard, fsrs, generatorParameters, State, type Card, type Grade } from 'ts-fsrs';

// FSRS-6 (TDD §8). ts-fsrs's own npm major version (5.x) tracks its API, not the
// scheduling algorithm it ships — 5.4.2 already implements FSRS-6.
//
// Fuzz stays on per TDD §8. ts-fsrs seeds its fuzz PRNG from `now`, `reps`, and
// `difficulty * stability` (DefaultInitSeedStrategy in ts-fsrs), never
// Math.random()/Date.now(), so grade()/previewIntervals() stay pure and
// deterministic for a given row + now.
const f = fsrs(generatorParameters({ enable_fuzz: true }));

/**
 * The reviewState row shape this module bridges to/from a ts-fsrs Card
 * (db/schema.ts). `learningSteps` has no column there yet — a later slice
 * that persists grades adds it; carried here so a New/Learning card's
 * mid-burst step position survives a row round-trip instead of resetting on
 * every load, which would keep re-issuing the first learning step forever.
 */
export interface SchedulerRow {
	stability: number;
	difficulty: number;
	due: Date;
	reps: number;
	lapses: number;
	state: State;
	lastReview: Date | null;
	learningSteps: number;
}

/**
 * Row → Card. `elapsed_days` and `scheduled_days` have no column on
 * review_state and don't need one: ts-fsrs recomputes elapsed_days itself
 * from last_review/now, and scheduled_days is output-only bookkeeping, so
 * both are thrown-away inputs.
 */
export function rowToCard(row: SchedulerRow): Card {
	return {
		due: row.due,
		stability: row.stability,
		difficulty: row.difficulty,
		elapsed_days: 0,
		scheduled_days: 0,
		learning_steps: row.learningSteps,
		reps: row.reps,
		lapses: row.lapses,
		state: row.state,
		last_review: row.lastReview ?? undefined
	};
}

/** Card → row: the fields review_state actually persists. */
export function cardToRow(card: Card): SchedulerRow {
	return {
		stability: card.stability,
		difficulty: card.difficulty,
		due: card.due,
		reps: card.reps,
		lapses: card.lapses,
		state: card.state,
		lastReview: card.last_review ?? null,
		learningSteps: card.learning_steps
	};
}

/** A brand-new card's initial row, before any review (TDD §8). */
export function newCardRow(now: Date): SchedulerRow {
	return cardToRow(createEmptyCard(now));
}

export interface GradeResult {
	card: Card;
	log: { rating: Grade; elapsedDays: number };
}

/**
 * Pure. No I/O. Date injected ⇒ deterministic tests. (TDD §8)
 *
 * TDD §8 types `rating` as `Rating` and returns bare `Card`; `Rating` includes
 * `Manual`, which ts-fsrs's own `next()` rejects at the type level (it wants
 * `Grade`, i.e. 1..4). Typed as `Grade` here instead. The return also carries
 * `log` — the brief needs `rating`/`elapsedDays` for the review_log row, which
 * TDD's snippet discards.
 *
 * Out-of-range `rating` (not 1..4, incl. NaN) or `now` before the row's
 * `lastReview` throws inside ts-fsrs; this module does not validate — the
 * route calling it must reject bad ratings and clamp `now >= lastReview`.
 */
export function grade(state: Card, rating: Grade, now: Date): GradeResult {
	const { card, log } = f.next(state, now, rating);
	return { card, log: { rating: log.rating as Grade, elapsedDays: log.elapsed_days } };
}

/** What the four buttons should say — CRD-2. (TDD §8) */
export function previewIntervals(state: Card, now: Date): Record<Grade, Date> {
	const s = f.repeat(state, now);
	return {
		1: s[1].card.due,
		2: s[2].card.due,
		3: s[3].card.due,
		4: s[4].card.due
	};
}
