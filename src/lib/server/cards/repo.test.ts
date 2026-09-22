// Runs against the real database named by DATABASE_URL (loaded from .env when
// present) and skips without one. Every row it writes is removed afterwards.
import { existsSync } from 'node:fs';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import * as table from '../db/schema';

if (!process.env.DATABASE_URL && existsSync('.env')) process.loadEnvFile('.env');
const url = process.env.DATABASE_URL;

const { client, db } = vi.hoisted(() => ({
	client: { current: null as ReturnType<typeof postgres> | null },
	db: { current: null as ReturnType<typeof drizzle<typeof import('../db/schema')>> | null }
}));

// repo.ts imports through SvelteKit aliases, which this vitest config does not resolve.
vi.mock('$lib/server/db', () => ({
	get db() {
		return db.current;
	}
}));
vi.mock('$lib/server/db/schema', () => import('../db/schema'));
vi.mock('$lib/server/ingest/anki-tsv', () => ({ parseAnkiExport: () => ({}) }));

const { recordGrade } = await import('./repo');

describe.skipIf(!url)('recordGrade against the database', () => {
	const run = crypto.randomUUID();
	const userId = `test-user-${run}`;
	const nodeId = `test-node-${run}`;
	let assessmentId = '';

	if (url) {
		client.current = postgres(url, { onnotice: () => {} });
		db.current = drizzle(client.current, { schema: table });
	}
	const q = () => db.current!;

	beforeEach(async () => {
		await cleanup();
		await q()
			.insert(table.user)
			.values({ id: userId, email: `${userId}@test.invalid` });
		await q()
			.insert(table.node)
			.values({ id: nodeId, userId, deck: 'test-deck', front: 'f', back: 'b' });
		assessmentId = crypto.randomUUID();
		await q().insert(table.assessment).values({ id: assessmentId, userId, deck: 'test-deck' });
	});

	async function cleanup() {
		await q().delete(table.reviewLog).where(eq(table.reviewLog.userId, userId));
		await q().delete(table.reviewState).where(eq(table.reviewState.userId, userId));
		await q().delete(table.assessment).where(eq(table.assessment.userId, userId));
		await q().delete(table.node).where(eq(table.node.userId, userId));
		await q().delete(table.user).where(eq(table.user.id, userId));
	}

	afterAll(async () => {
		await cleanup();
		await client.current?.end();
	});

	async function counts() {
		const logs = await q().select().from(table.reviewLog).where(eq(table.reviewLog.userId, userId));
		const [state] = await q()
			.select()
			.from(table.reviewState)
			.where(eq(table.reviewState.nodeId, nodeId));
		return { logs: logs.length, reps: state?.reps };
	}

	it('records a retried first attempt once', async () => {
		expect(await recordGrade(userId, assessmentId, nodeId, 3, 0)).toBe(true);
		expect(await recordGrade(userId, assessmentId, nodeId, 3, 0)).toBe(true);
		expect(await counts()).toEqual({ logs: 1, reps: 1 });
	});

	it('records a relearning repeat as a second attempt', async () => {
		expect(await recordGrade(userId, assessmentId, nodeId, 1, 0)).toBe(true);
		expect(await recordGrade(userId, assessmentId, nodeId, 3, 1)).toBe(true);
		expect(await counts()).toEqual({ logs: 2, reps: 2 });
	});
});
