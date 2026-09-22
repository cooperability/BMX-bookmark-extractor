import { hasDb } from '../testing/db';
import { eq } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import * as table from '../db/schema';

const { db } = hasDb ? await import('../db') : ({} as typeof import('../db'));
const { overview } = hasDb ? await import('./stats') : ({} as typeof import('./stats'));

describe.skipIf(!hasDb)('overview against the database', () => {
	const run = crypto.randomUUID().slice(0, 8);
	const userId = `test-user-${run}`;
	const now = new Date('2026-09-10T12:00:00Z');

	async function cleanup() {
		await db.delete(table.reviewLog).where(eq(table.reviewLog.userId, userId));
		await db.delete(table.assessment).where(eq(table.assessment.userId, userId));
		await db.delete(table.node).where(eq(table.node.userId, userId));
		await db.delete(table.user).where(eq(table.user.id, userId));
	}
	beforeEach(async () => {
		await cleanup();
		await db.insert(table.user).values({ id: userId, email: `${userId}@test.invalid` });
		await db
			.insert(table.node)
			.values(['a', 'b', 'c'].map((k) => ({ id: `${run}-${k}`, userId, deck: 'd', front: k })));
		await db.insert(table.assessment).values({ id: run, userId, deck: 'd' });
	});
	afterAll(cleanup);

	it('computes retention over first attempts at learned cards only', async () => {
		const log = (node: string, rating: number, state: number, attempt = 0) => ({
			userId,
			nodeId: `${run}-${node}`,
			rating,
			state,
			attempt,
			assessmentId: run,
			surface: 'cards',
			reviewedAt: now
		});
		await db.insert(table.reviewLog).values([
			log('a', 1, 0), // new card, first sight: not retention
			log('a', 3, 1, 1), // its learning step
			log('b', 3, 2), // recalled
			log('c', 1, 2), // forgotten
			log('c', 3, 3, 1) // relearning repeat: not a first attempt
		]);
		const o = await overview(userId, now);
		expect(o.reviews30d).toBe(2);
		expect(o.retention30d).toBe(0.5);
		// Daily counts still include every first attempt, new cards too.
		expect(o.reviewedToday).toBe(3);
	});

	it('buckets daily counts in the given time zone', async () => {
		const at = (iso: string) => ({
			userId,
			nodeId: `${run}-a`,
			rating: 3,
			state: 2,
			attempt: 0,
			surface: 'cards',
			reviewedAt: new Date(iso)
		});
		// 20:00 and 21:00 on Sep 9 in Los Angeles; Sep 10 in UTC.
		await db
			.insert(table.reviewLog)
			.values([at('2026-09-10T03:00:00Z'), at('2026-09-10T04:00:00Z')]);
		const la = await overview(userId, now, 'America/Los_Angeles');
		expect(la.reviewedToday).toBe(0);
		expect(la.streakDays).toBe(1);
		const utc = await overview(userId, now);
		expect(utc.reviewedToday).toBe(2);
	});
});
