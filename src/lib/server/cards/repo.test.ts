import { hasDb } from '../testing/db';
import { eq } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import * as table from '../db/schema';

// Loaded only with a database: `$lib/server/db` throws at import without one.
// Every row this writes is removed afterwards.
const { db } = hasDb ? await import('../db') : ({} as typeof import('../db'));
const { recordGrade } = hasDb ? await import('./repo') : ({} as typeof import('./repo'));

describe.skipIf(!hasDb)('recordGrade against the database', () => {
	const run = crypto.randomUUID();
	const userId = `test-user-${run}`;
	const nodeId = `test-node-${run}`;
	let assessmentId = '';

	beforeEach(async () => {
		await cleanup();
		await db.insert(table.user).values({ id: userId, email: `${userId}@test.invalid` });
		await db
			.insert(table.node)
			.values({ id: nodeId, userId, deck: 'test-deck', front: 'f', back: 'b' });
		assessmentId = crypto.randomUUID();
		await db
			.insert(table.assessment)
			.values({ id: assessmentId, userId, deck: 'test-deck', cardIds: [nodeId] });
	});

	async function cleanup() {
		await db.delete(table.reviewLog).where(eq(table.reviewLog.userId, userId));
		await db.delete(table.reviewState).where(eq(table.reviewState.userId, userId));
		await db.delete(table.assessment).where(eq(table.assessment.userId, userId));
		await db.delete(table.node).where(eq(table.node.userId, userId));
		await db.delete(table.user).where(eq(table.user.id, userId));
	}

	afterAll(cleanup);

	async function counts() {
		const logs = await db.select().from(table.reviewLog).where(eq(table.reviewLog.userId, userId));
		const [state] = await db
			.select()
			.from(table.reviewState)
			.where(eq(table.reviewState.nodeId, nodeId));
		return { logs: logs.length, reps: state?.reps };
	}

	it('records a retried first attempt once', async () => {
		expect(await recordGrade(userId, assessmentId, nodeId, 3, 0)).toBe(3);
		expect(await recordGrade(userId, assessmentId, nodeId, 3, 0)).toBe(3);
		expect(await counts()).toEqual({ logs: 1, reps: 1 });
	});

	it('answers a retry with a different rating with the rating it stored', async () => {
		expect(await recordGrade(userId, assessmentId, nodeId, 1, 0)).toBe(1);
		// The client lost the first response and the user pressed Good this time.
		expect(await recordGrade(userId, assessmentId, nodeId, 3, 0)).toBe(1);
		expect(await counts()).toEqual({ logs: 1, reps: 1 });
	});

	it('records a relearning repeat as a second attempt', async () => {
		expect(await recordGrade(userId, assessmentId, nodeId, 1, 0)).toBe(1);
		expect(await recordGrade(userId, assessmentId, nodeId, 3, 1)).toBe(3);
		expect(await counts()).toEqual({ logs: 2, reps: 2 });
	});

	it('refuses an attempt that skips ahead or repeats a card that passed', async () => {
		expect(await recordGrade(userId, assessmentId, nodeId, 3, 1)).toBeNull();
		expect(await recordGrade(userId, assessmentId, nodeId, 3, 0)).toBe(3);
		expect(await recordGrade(userId, assessmentId, nodeId, 3, 1)).toBeNull();
		expect(await counts()).toEqual({ logs: 1, reps: 1 });
	});
});
