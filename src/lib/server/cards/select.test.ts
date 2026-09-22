import { describe, expect, it } from 'vitest';
import type { ReviewState } from '$lib/server/db/schema';
import { interleave, NEW_PER_DAY, selectRound, type Candidate } from './select';

const DAY = 86_400_000;
const now = new Date('2026-09-01T12:00:00Z');
const days = (n: number) => new Date(now.getTime() + n * DAY);

type ReviewOpts = { dueIn?: number; lastAgo?: number; stability?: number };

function review(
	id: string,
	{ dueIn = 0, lastAgo = 5, stability = 5 }: ReviewOpts = {}
): ReviewState {
	return {
		nodeId: id,
		userId: 'u1',
		stability,
		difficulty: 5,
		due: days(dueIn),
		reps: 4,
		lapses: 0,
		state: 2,
		learningSteps: 0,
		scheduledDays: Math.max(1, lastAgo + dueIn),
		lastReview: days(-lastAgo)
	};
}

let seq = 0;
const newCard = (tag: string): Candidate => ({ id: `n${seq++}`, tags: [tag], review: null });
const seenCard = (tag: string, opts?: ReviewOpts): Candidate => {
	const id = `s${seq++}`;
	return { id, tags: [tag], review: review(id, opts) };
};
const many = <T>(n: number, f: () => T) => Array.from({ length: n }, f);
const ids = (cs: Candidate[]) => new Set(cs.map((c) => c.id));
const firstTag = (c: Candidate) => c.tags[0] ?? '(untagged)';

// Due, but recently reviewed with long stability: high retrievability.
const dueHighR: ReviewOpts = { dueIn: -1, lastAgo: 3, stability: 100 };
// Not due for a while, but low stability and a long gap: low retrievability.
const notDueLowR: ReviewOpts = { dueIn: 10, lastAgo: 30, stability: 1 };

describe('selectRound size and uniqueness', () => {
	it('never exceeds size, never duplicates, returns min(size, cards.length)', () => {
		const deck = [
			...many(15, () => newCard('a')),
			...many(10, () => seenCard('b', { dueIn: -2 })),
			...many(10, () => seenCard('c', { dueIn: 5 }))
		];
		for (const size of [1, 7, 20, 35, 50]) {
			const out = selectRound(deck, { weak: ['c'], strong: ['b'] }, now, size);
			expect(out.length).toBe(Math.min(size, deck.length));
			expect(ids(out).size).toBe(out.length);
		}
		expect(selectRound(deck.slice(0, 5), null, now, 20)).toHaveLength(5);
	});

	it('defaults to a round of 20', () => {
		const deck = many(40, () => newCard('a'));
		expect(selectRound(deck, null, now)).toHaveLength(20);
	});
});

describe('selectRound first round', () => {
	it('spreads new cards across tags: 5 tags x 10 cards, size 10, each tag twice', () => {
		const tags = ['t1', 't2', 't3', 't4', 't5'];
		const deck = tags.flatMap((t) => many(10, () => newCard(t)));
		const out = selectRound(deck, null, now, 10);
		expect(out).toHaveLength(10);
		for (const t of tags) expect(out.filter((c) => c.tags[0] === t)).toHaveLength(2);
	});
});

describe('selectRound priorities', () => {
	it('includes every due card before not-due non-weak cards, even less retrievable ones', () => {
		const due = many(3, () => seenCard('x', dueHighR));
		const notDue = many(20, () => seenCard('y', notDueLowR));
		const got = ids(selectRound([...notDue, ...due], null, now, 10));
		for (const c of due) expect(got.has(c.id)).toBe(true);
	});

	it('prefers due cards in prior weak tags when due cards exceed the review budget', () => {
		// Weak-tag due cards are the most retrievable, so retrievability alone would drop them.
		const weakDue = many(5, () => seenCard('w', dueHighR));
		const otherDue = many(10, () => seenCard('n', { dueIn: -10, lastAgo: 20, stability: 2 }));
		const fresh = many(10, () => newCard('f'));
		const out = selectRound(
			[...otherDue, ...fresh, ...weakDue],
			{ weak: ['w'], strong: [] },
			now,
			10
		);
		const got = ids(out);
		for (const c of weakDue) expect(got.has(c.id)).toBe(true);
	});

	it('reserves ceil(0.2 * size) slots for new cards when reviewed cards are present', () => {
		const due = many(30, () => seenCard('d', { dueIn: -3 }));
		const fresh = many(30, () => newCard('f'));
		for (const size of [10, 20, 7]) {
			const out = selectRound([...due, ...fresh], null, now, size);
			expect(out.filter((c) => c.review === null).length).toBe(Math.ceil(0.2 * size));
		}
	});

	it('includes not-due weak-tag cards ahead of not-due neutral cards', () => {
		const weakNotDue = many(5, () => seenCard('w', { dueIn: 20, lastAgo: 2, stability: 100 }));
		const neutralNotDue = many(20, () => seenCard('n', notDueLowR));
		const out = selectRound(
			[...neutralNotDue, ...weakNotDue],
			{ weak: ['w'], strong: [] },
			now,
			10
		);
		const got = ids(out);
		for (const c of weakNotDue) expect(got.has(c.id)).toBe(true);
	});

	it('probes strong tags with at least one and at most ceil(0.1 * size) not-due cards', () => {
		const due = many(30, () => seenCard('d', { dueIn: -3 }));
		const strongNotDue = many(6, () => seenCard('s', { dueIn: 15 }));
		const fresh = many(10, () => newCard('f'));
		const size = 20;
		const out = selectRound(
			[...due, ...fresh, ...strongNotDue],
			{ weak: [], strong: ['s'] },
			now,
			size
		);
		const probes = out.filter((c) => c.tags[0] === 's').length;
		expect(probes).toBeGreaterThanOrEqual(1);
		expect(probes).toBeLessThanOrEqual(Math.ceil(0.1 * size));
	});

	it('includes no strong-tag card when prior.strong is empty and due cards fill the round', () => {
		const due = many(30, () => seenCard('d', { dueIn: -3 }));
		const strongNotDue = many(6, () => seenCard('s', { dueIn: 15 }));
		const fresh = many(10, () => newCard('f'));
		const out = selectRound([...due, ...fresh, ...strongNotDue], null, now, 20);
		expect(out.filter((c) => c.tags[0] === 's')).toHaveLength(0);
	});

	it('caps new cards at the reserve when not-due reviewed cards can fill the round', () => {
		const due = many(3, () => seenCard('d', dueHighR));
		const notDue = many(20, () => seenCard('n', notDueLowR));
		const fresh = many(50, () => newCard('f'));
		const out = selectRound([...due, ...notDue, ...fresh], null, now, 20);
		expect(out).toHaveLength(20);
		expect(out.filter((c) => c.review === null)).toHaveLength(4);
	});

	it('fills a round with new cards when there are too few reviewed cards', () => {
		const due = many(3, () => seenCard('d', dueHighR));
		const fresh = many(50, () => newCard('f'));
		const out = selectRound([...due, ...fresh], null, now, 20);
		expect(out).toHaveLength(20);
	});
});

describe('selectRound daily new-card allowance', () => {
	it('serves no more new cards than maxNew, even on a first round', () => {
		const deck = many(30, () => newCard('a'));
		expect(selectRound(deck, null, now, 20, 7)).toHaveLength(7);
		expect(selectRound(deck, null, now, 20, 0)).toHaveLength(0);
		expect(selectRound(deck, null, now, 20, -3)).toHaveLength(0);
	});

	it('tops up with reviewed cards once the allowance is spent', () => {
		const deck = [...many(10, () => newCard('a')), ...many(10, () => seenCard('b', { dueIn: 3 }))];
		const out = selectRound(deck, null, now, 12, 0);
		expect(out).toHaveLength(10);
		expect(out.every((c) => c.review)).toBe(true);
	});

	it('spreads a partial allowance across tags', () => {
		const deck = [...many(10, () => newCard('a')), ...many(10, () => newCard('b'))];
		const out = selectRound(deck, null, now, 20, 4);
		expect(out.map(firstTag).sort()).toEqual(['a', 'a', 'b', 'b']);
	});

	it(`defaults the allowance to NEW_PER_DAY (${NEW_PER_DAY})`, () => {
		expect(
			selectRound(
				many(40, () => newCard('a')),
				null,
				now,
				40
			)
		).toHaveLength(NEW_PER_DAY);
	});
});

describe('interleaving', () => {
	it('selectRound output has no adjacent cards sharing a first tag when the mix allows', () => {
		// Blocked input order: all a, then all b, then all c.
		const deck = [
			...many(4, () => seenCard('a', { dueIn: -1 })),
			...many(4, () => seenCard('b', { dueIn: -2 })),
			...many(4, () => seenCard('c', { dueIn: -3 }))
		];
		const out = selectRound(deck, null, now, 12);
		expect(out).toHaveLength(12);
		for (let i = 1; i < out.length; i++) expect(firstTag(out[i])).not.toBe(firstTag(out[i - 1]));
	});

	it('interleave preserves the multiset and breaks up blocks', () => {
		const cards: Candidate[] = [
			...many(3, () => newCard('a')),
			...many(3, () => newCard('b')),
			...many(3, () => newCard('c')),
			{ id: 'u', tags: [], review: null }
		];
		const out = interleave(cards);
		expect(out).toHaveLength(cards.length);
		expect(out.map((c) => c.id).sort()).toEqual(cards.map((c) => c.id).sort());
		for (let i = 1; i < 9; i++) expect(firstTag(out[i])).not.toBe(firstTag(out[i - 1]));
	});

	it('interleave of an empty list is empty', () => {
		expect(interleave([])).toEqual([]);
	});
});
