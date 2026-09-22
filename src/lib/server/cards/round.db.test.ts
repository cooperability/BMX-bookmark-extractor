import { hasDb } from '../testing/db';
import { eq } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import * as table from '../db/schema';

// Loaded only with a database: `$lib/server/db` throws at import without one.
const { db } = hasDb ? await import('../db') : ({} as typeof import('../db'));
const repo = hasDb ? await import('./repo') : ({} as typeof import('./repo'));

const HOUR = 3_600_000;
const t0 = new Date('2026-09-01T12:00:00Z');
const at = (h: number) => new Date(t0.getTime() + h * HOUR);

describe.skipIf(!hasDb)('study rounds against the database', () => {
	const run = crypto.randomUUID().slice(0, 8);
	const userId = `test-user-${run}`;
	const deck = `test-deck-${run}`;

	async function cleanup() {
		await db.delete(table.reviewLog).where(eq(table.reviewLog.userId, userId));
		await db.delete(table.reviewState).where(eq(table.reviewState.userId, userId));
		await db.delete(table.assessment).where(eq(table.assessment.userId, userId));
		await db.delete(table.node).where(eq(table.node.userId, userId));
		await db.delete(table.user).where(eq(table.user.id, userId));
	}

	beforeEach(async () => {
		await cleanup();
		await db.insert(table.user).values({ id: userId, email: `${userId}@test.invalid` });
		await db.insert(table.node).values(
			Array.from({ length: 5 }, (_, i) => ({
				id: `${run}-n${i}`,
				userId,
				deck,
				front: `f${i}`,
				back: `b${i}`,
				tags: [i % 2 ? 'odd' : 'even']
			}))
		);
	});

	afterAll(cleanup);

	const openRounds = () =>
		db.select().from(table.assessment).where(eq(table.assessment.userId, userId));

	it('resumes the open round on a second load instead of opening another', async () => {
		const first = (await repo.startRound(userId, deck, at(0)))!;
		const again = (await repo.startRound(userId, deck, at(1)))!;
		expect(again.assessmentId).toBe(first.assessmentId);
		expect(again.cards.map((c) => c.id)).toEqual(first.cards.map((c) => c.id));
		expect(await openRounds()).toHaveLength(1);
	});

	it('returns the ratings logged so far, per card, in attempt order', async () => {
		const r = (await repo.startRound(userId, deck, at(0)))!;
		const [a, b] = r.cards;
		await repo.recordGrade(userId, r.assessmentId, a.id, 1, at(0.1));
		await repo.recordGrade(userId, r.assessmentId, b.id, 3, at(0.2));
		await repo.recordGrade(userId, r.assessmentId, a.id, 3, at(0.3));
		const resumed = (await repo.startRound(userId, deck, at(0.5)))!;
		expect(resumed.progress).toEqual({ [a.id]: [1, 3], [b.id]: [3] });
	});

	it('refuses a grade for a card that is not in the round', async () => {
		const r = (await repo.startRound(userId, deck, at(0)))!;
		await db
			.update(table.assessment)
			.set({ cardIds: [r.cards[0].id] })
			.where(eq(table.assessment.id, r.assessmentId));
		expect(await repo.recordGrade(userId, r.assessmentId, r.cards[1].id, 3, at(0.1))).toBe(false);
		expect(await repo.recordGrade(userId, r.assessmentId, r.cards[0].id, 3, at(0.1))).toBe(true);
	});

	it('opens a new round once the last one is finished', async () => {
		const r = (await repo.startRound(userId, deck, at(0)))!;
		for (const c of r.cards) await repo.recordGrade(userId, r.assessmentId, c.id, 3, at(0.1));
		expect(await repo.finishRound(userId, r.assessmentId, at(0.2))).not.toBeNull();
		const next = (await repo.startRound(userId, deck, at(0.3)))!;
		expect(next.assessmentId).not.toBe(r.assessmentId);
		expect(next.progress).toEqual({});
	});

	it('grades a stale round that has grades and deletes one that has none', async () => {
		const graded = (await repo.startRound(userId, deck, at(0)))!;
		await repo.recordGrade(userId, graded.assessmentId, graded.cards[0].id, 1, at(0.1));
		const fresh = (await repo.startRound(userId, deck, at(13)))!;
		expect(fresh.assessmentId).not.toBe(graded.assessmentId);
		const [closed] = await db
			.select()
			.from(table.assessment)
			.where(eq(table.assessment.id, graded.assessmentId));
		// Closed at its last grade, not at the moment it was found stale.
		expect(closed.finishedAt).toEqual(at(0.1));
		expect(closed.score).toBe(0);

		const next = (await repo.startRound(userId, deck, at(26)))!;
		expect(next.assessmentId).not.toBe(fresh.assessmentId);
		const ids = (await openRounds()).map((a) => a.id);
		expect(ids).not.toContain(fresh.assessmentId);
	});
});
