import type { ReviewState } from '$lib/server/db/schema';
import { areasOf } from './grading';
import { retrievability } from './scheduler';

export interface Candidate {
	id: string;
	tags: string[];
	review: ReviewState | null;
}

export interface Prior {
	weak: string[];
	strong: string[];
}

export const ROUND_SIZE = 20;
// New cards introduced per deck per UTC day. Each new card brings its own future
// reviews, and back-to-back rounds with no cap snowball into a review backlog.
export const NEW_PER_DAY = 20;
const NEW_SHARE = 0.2;
const STRONG_PROBE_SHARE = 0.1;

/**
 * Pick the cards for the next round over one deck.
 *
 * 1. Due cards first, weak areas ahead of the rest, least retrievable first.
 *    Spacing: FSRS says these are about to be forgotten.
 * 2. Weak-area cards that are not due yet, least retrievable first. Retrieval
 *    practice on the gaps the last assessment found.
 * 3. A few not-due cards from strong areas, so "strong" is re-tested rather
 *    than assumed.
 * 4. New cards, spread across tags so every area gets a first measurement, at
 *    most `maxNew` of them: what is left of the deck's daily allowance.
 *
 * The result is interleaved by tag. Mixed practice beats blocked practice for
 * telling similar concepts apart.
 */
export function selectRound(
	cards: Candidate[],
	prior: Prior | null,
	now: Date,
	size = ROUND_SIZE,
	maxNew = NEW_PER_DAY
): Candidate[] {
	const weak = new Set(prior?.weak ?? []);
	const strong = new Set(prior?.strong ?? []);
	const isWeak = (c: Candidate) => areasOf(c.tags).some((t) => weak.has(t));
	const isStrong = (c: Candidate) => !isWeak(c) && areasOf(c.tags).some((t) => strong.has(t));
	const r = (c: Candidate) => retrievability(c.review, now) ?? 1;
	const leastRetrievable = (a: Candidate, b: Candidate) => r(a) - r(b);

	const fresh = interleave(cards.filter((c) => !c.review || c.review.state === 0)).slice(
		0,
		Math.max(0, maxNew)
	);
	const seen = cards.filter((c) => c.review && c.review.state !== 0);
	const due = seen.filter((c) => c.review!.due <= now);
	const notDue = seen.filter((c) => c.review!.due > now);

	const newReserve = seen.length ? Math.min(Math.ceil(size * NEW_SHARE), fresh.length) : size;
	const strongPool = notDue.filter(isStrong).sort(leastRetrievable);
	const strongReserve = Math.min(Math.ceil(size * STRONG_PROBE_SHARE), strongPool.length);
	const reviewCap = Math.max(0, size - newReserve - strongReserve);

	const picked: Candidate[] = [];
	const taken = new Set<string>();
	const take = (pool: Candidate[], limit: number) => {
		for (const c of pool) {
			if (picked.length >= limit) return;
			if (taken.has(c.id)) continue;
			picked.push(c);
			taken.add(c.id);
		}
	};

	take(
		[...due].sort((a, b) => Number(isWeak(b)) - Number(isWeak(a)) || leastRetrievable(a, b)),
		reviewCap
	);
	take(notDue.filter(isWeak).sort(leastRetrievable), reviewCap);
	take(strongPool, picked.length + strongReserve);
	take(fresh, picked.length + newReserve);
	// Short deck or few new cards: top up with whatever is least retrievable.
	take([...seen].sort(leastRetrievable), size);
	take(fresh, size);

	return interleave(picked);
}

/** Round-robin across each card's first area, biggest groups first so the tail is not one tag. */
export function interleave<T extends { tags: string[] }>(cards: T[]): T[] {
	const groups = new Map<string, T[]>();
	for (const c of cards) {
		const key = areasOf(c.tags)[0];
		groups.set(key, [...(groups.get(key) ?? []), c]);
	}
	const queues = [...groups.values()].sort((a, b) => b.length - a.length);
	const out: T[] = [];
	while (out.length < cards.length) {
		for (const q of queues) {
			const c = q.shift();
			if (c) out.push(c);
		}
	}
	return out;
}
