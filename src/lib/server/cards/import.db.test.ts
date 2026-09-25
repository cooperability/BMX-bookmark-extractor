import { hasDb } from '../testing/db';
import { eq } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import * as table from '../db/schema';

// Loaded only with a database: `$lib/server/db` needs DATABASE_URL.
const { db, asTenant } = hasDb ? await import('../db') : ({} as typeof import('../db'));
const repo = hasDb ? await import('./repo') : ({} as typeof import('./repo'));

const PREAMBLE = '#separator:tab\n#html:true\n#guid column:1\n#deck column:2\n';

describe.skipIf(!hasDb)('deck import inside a signed-in request', () => {
	const run = crypto.randomUUID().slice(0, 8);
	const userId = `test-user-${run}`;
	const deck = `test-deck-${run}`;

	async function cleanup() {
		await db.delete(table.node).where(eq(table.node.userId, userId));
		await db.delete(table.user).where(eq(table.user.id, userId));
	}
	beforeEach(async () => {
		await cleanup();
		await db.insert(table.user).values({ id: userId, email: `${userId}@test.invalid` });
	});
	afterAll(cleanup);

	it('stores a card whose text holds a NUL byte, without the NUL', async () => {
		// Postgres text cannot hold U+0000, so the insert used to fail outright.
		const raw = `${PREAMBLE}g1\t${deck}\tfront\u0000one\tback\n`;
		const out = await asTenant(userId, () => repo.importDeck(userId, raw));
		expect(out.imported).toBe(1);
		const [n] = await db.select().from(table.node).where(eq(table.node.userId, userId));
		expect(n.front).toBe('frontone');
	});

	it('leaves the request usable after a failed import', async () => {
		// The whole signed-in request is one transaction (asTenant). A failed statement
		// used to abort it, so the page load after the action's error 500ed.
		const raw = `${PREAMBLE}g1\t${deck}\tfront\tback\n`;
		const decks = await asTenant(userId, async () => {
			// Another user's id: row-level security refuses the insert.
			await expect(repo.importDeck(`${userId}-other`, raw)).rejects.toThrow();
			return repo.listDecks(userId);
		});
		expect(decks).toEqual([]);
	});
});
