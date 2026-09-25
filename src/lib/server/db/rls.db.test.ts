import { hasDb } from '../testing/db';
import { eq, inArray, sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import * as table from './schema';

const dbm = hasDb ? await import('./index') : ({} as typeof import('./index'));
const repo = hasDb ? await import('../cards/repo') : ({} as typeof import('../cards/repo'));
const stats = hasDb ? await import('../cards/stats') : ({} as typeof import('../cards/stats'));

// Needs drizzle/0003_rls.sql, which `db:migrate` applies and `db:push` does not.
// CI migrates, so there a missing policy fails instead of skipping.
const hasRls =
	hasDb &&
	((
		await dbm.db.execute<{ n: number }>(
			sql`select count(*)::int as n from pg_policy where polname = 'tenant'`
		)
	)[0].n > 0 ||
		Boolean(process.env.CI));

describe.skipIf(!hasRls)('row-level security', () => {
	const { db, asTenant } = dbm;
	const run = crypto.randomUUID().slice(0, 8);
	const a = `rls-a-${run}`;
	const b = `rls-b-${run}`;
	const users = [a, b];

	async function cleanup() {
		await db.delete(table.reviewLog).where(inArray(table.reviewLog.userId, users));
		await db.delete(table.reviewState).where(inArray(table.reviewState.userId, users));
		await db.delete(table.assessment).where(inArray(table.assessment.userId, users));
		await db.delete(table.node).where(inArray(table.node.userId, users));
		await db.delete(table.user).where(inArray(table.user.id, users));
	}
	beforeAll(async () => {
		await cleanup();
		await db.insert(table.user).values(users.map((id) => ({ id, email: `${id}@test.invalid` })));
		await db
			.insert(table.node)
			.values(
				users.flatMap((u) =>
					[0, 1, 2].map((i) => ({ id: `${u}-${i}`, userId: u, deck: 'd', front: `${u} ${i}` }))
				)
			);
	});
	afterAll(cleanup);

	const everyone = () =>
		db.select({ id: table.node.id }).from(table.node).where(inArray(table.node.userId, users));

	it('shows a tenant only its own rows, even with no user_id filter', async () => {
		const seen = await asTenant(a, () => db.select({ userId: table.node.userId }).from(table.node));
		expect(seen.length).toBe(3);
		expect(new Set(seen.map((r) => r.userId))).toEqual(new Set([a]));
		expect((await everyone()).length).toBe(6); // the owner role outside asTenant sees both
	});

	it('refuses to write a row for another tenant', async () => {
		await expect(
			asTenant(a, () =>
				db.insert(table.node).values({ id: `${b}-x`, userId: b, deck: 'd', front: 'x' })
			)
		).rejects.toThrow();
		const hit = await asTenant(a, () =>
			db
				.update(table.node)
				.set({ front: 'owned' })
				.where(eq(table.node.id, `${b}-0`))
				.returning()
		);
		expect(hit).toEqual([]);
		const [row] = await db
			.select()
			.from(table.node)
			.where(eq(table.node.id, `${b}-0`));
		expect(row.front).toBe(`${b} 0`);
	});

	it('runs a whole study round and the dashboard under RLS', async () => {
		const now = new Date('2026-09-10T12:00:00Z');
		const g = await asTenant(a, async () => {
			const r = (await repo.startRound(a, 'd', now))!;
			expect(r.cards.every((c) => c.id.startsWith(a))).toBe(true);
			for (const c of r.cards) await repo.recordGrade(a, r.assessmentId, c.id, 3, 0, now);
			return repo.finishRound(a, r.assessmentId, now);
		});
		expect(g?.score).toBe(1);
		const o = await asTenant(a, () => stats.overview(a, now));
		expect(o.reviewedToday).toBe(3);
		// B's view is empty: A's round, logs and states are invisible to it.
		const other = await asTenant(b, () => stats.overview(b, now));
		expect(other.reviewedToday).toBe(0);
		expect(await asTenant(b, () => db.select().from(table.assessment))).toEqual([]);
	});

	it("cannot grade another tenant's card even when handed its ids", async () => {
		const now = new Date('2026-09-11T12:00:00Z');
		const r = (await asTenant(b, () => repo.startRound(b, 'd', now)))!;
		const stolen = await asTenant(a, () =>
			repo.recordGrade(a, r.assessmentId, r.cards[0].id, 1, 0, now)
		);
		expect(stolen).toBeNull();
	});

	it('rolls the tenant transaction back when the work throws', async () => {
		await expect(
			asTenant(a, async () => {
				await db
					.update(table.node)
					.set({ front: 'changed' })
					.where(eq(table.node.id, `${a}-1`));
				throw new Error('boom');
			})
		).rejects.toThrow('boom');
		const [row] = await db
			.select()
			.from(table.node)
			.where(eq(table.node.id, `${a}-1`));
		expect(row.front).toBe(`${a} 1`);
	});
});
