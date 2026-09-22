import { createEmptyCard, fsrs, generatorParameters, type Card, type Grade } from 'ts-fsrs';
import type { ReviewState } from '$lib/server/db/schema';

// TDD R7: ship ts-fsrs defaults until there are 1k+ reviews to fit on.
const f = fsrs(generatorParameters({ enable_fuzz: true }));

type StoredState = Pick<
	ReviewState,
	| 'stability'
	| 'difficulty'
	| 'due'
	| 'reps'
	| 'lapses'
	| 'state'
	| 'learningSteps'
	| 'scheduledDays'
	| 'lastReview'
>;

export function toCard(s: StoredState | null | undefined, now: Date): Card {
	if (!s) return createEmptyCard(now);
	return {
		due: s.due,
		stability: s.stability,
		difficulty: s.difficulty,
		elapsed_days: 0,
		scheduled_days: s.scheduledDays,
		learning_steps: s.learningSteps,
		reps: s.reps,
		lapses: s.lapses,
		state: s.state,
		last_review: s.lastReview ?? undefined
	};
}

export function fromCard(c: Card): StoredState {
	return {
		due: c.due,
		stability: c.stability,
		difficulty: c.difficulty,
		reps: c.reps,
		lapses: c.lapses,
		state: c.state,
		learningSteps: c.learning_steps,
		scheduledDays: c.scheduled_days,
		lastReview: c.last_review ?? null
	};
}

/** Rating 1 Again, 2 Hard, 3 Good, 4 Easy. */
export function grade(
	s: StoredState | null | undefined,
	rating: Grade,
	now: Date
): { next: StoredState; elapsedDays: number; priorState: number } {
	const { card, log } = f.next(toCard(s, now), now, rating);
	return { next: fromCard(card), elapsedDays: log.elapsed_days, priorState: log.state };
}

/** Probability of recall now. 1 for a card never reviewed has no meaning, so new cards return null. */
export function retrievability(s: StoredState | null | undefined, now: Date): number | null {
	if (!s || s.state === 0) return null;
	return f.get_retrievability(toCard(s, now), now, false);
}
