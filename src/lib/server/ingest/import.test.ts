import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { eq } from 'drizzle-orm';
import type { PgliteDatabase } from 'drizzle-orm/pglite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestDb } from '../db/test-db';
import * as schema from '../db/schema';
import { withTenant } from '../db/rls';
import { importAnkiExport, MAX_IMPORT_BYTES, PayloadTooLargeError, readCappedText } from './import';
import { POST } from '../../../routes/api/import/+server';

const ANTHRO = 'source_data/Anthro (Psych_Soc_Econ_Health).txt';
const COMPSCI = 'source_data/CompSci (AIML_Web3_Math_Logic_Tech).txt';
const read = (p: string) => readFileSync(p, 'utf8');

const ALICE = 'user_alice';
const BOB = 'user_bob';
const CAROL = 'user_carol';
const DAVE = 'user_dave';
const EVE = 'user_eve';
const FRANK = 'user_frank';

let client: PGlite;
let db: PgliteDatabase<typeof schema>;

beforeAll(async () => {
	({ client, db } = await createTestDb());
	await db.insert(schema.user).values(
		[ALICE, BOB, CAROL, DAVE, EVE, FRANK].map((id) => ({
			id,
			username: id,
			passwordHash: 'x'
		}))
	);
}, 60_000);

afterAll(async () => {
	await client.close();
});

// A minimal synthetic export, independent of the real corpus, for scenarios
// the real files can't exercise on demand (a repeated guid, an edited card).
const PREAMBLE = ['#separator:tab', '#guid column:1', '#notetype column:2', '#deck column:3'].join(
	'\n'
);
function tsv(rows: string[][]): string {
	return [PREAMBLE, ...rows.map((r) => r.join('\t'))].join('\n');
}

describe('importAnkiExport, the warm path', () => {
	it('imports both real exports to 320 + 137 = 457 nodes for one user', async () => {
		const now = new Date();
		const anthro = await importAnkiExport(db, ALICE, read(ANTHRO), now);
		const compsci = await importAnkiExport(db, ALICE, read(COMPSCI), now);

		expect(anthro).toMatchObject({ imported: 320, matched: 0 });
		expect(compsci).toMatchObject({ imported: 137, matched: 0 });

		const nodes = await withTenant(db, ALICE, (tx) => tx.select().from(schema.node));
		expect(nodes).toHaveLength(457);

		const reviewState = await withTenant(db, ALICE, (tx) => tx.select().from(schema.reviewState));
		expect(reviewState).toHaveLength(457);
	}, 30_000);

	it('re-importing the same file changes nothing', async () => {
		const beforeNodes = await withTenant(db, ALICE, (tx) => tx.select().from(schema.node));
		const beforeReview = await withTenant(db, ALICE, (tx) => tx.select().from(schema.reviewState));

		const result = await importAnkiExport(db, ALICE, read(ANTHRO), new Date());
		expect(result).toMatchObject({ imported: 0, matched: 320 });

		const afterNodes = await withTenant(db, ALICE, (tx) => tx.select().from(schema.node));
		const afterReview = await withTenant(db, ALICE, (tx) => tx.select().from(schema.reviewState));
		expect(afterNodes).toHaveLength(beforeNodes.length);
		expect(afterReview).toHaveLength(beforeReview.length);
	}, 30_000);

	it("a second user importing the same file gets their own 457 rows, neither sees the other's", async () => {
		const anthro = await importAnkiExport(db, BOB, read(ANTHRO), new Date());
		const compsci = await importAnkiExport(db, BOB, read(COMPSCI), new Date());
		expect(anthro).toMatchObject({ imported: 320, matched: 0 });
		expect(compsci).toMatchObject({ imported: 137, matched: 0 });

		const bobNodes = await withTenant(db, BOB, (tx) => tx.select().from(schema.node));
		const aliceNodes = await withTenant(db, ALICE, (tx) => tx.select().from(schema.node));
		expect(bobNodes).toHaveLength(457);
		expect(aliceNodes).toHaveLength(457);

		const bobIds = new Set(bobNodes.map((n) => n.id));
		expect(aliceNodes.every((n) => !bobIds.has(n.id))).toBe(true);
	}, 30_000);

	it('enqueues a job row per import', async () => {
		const before = await withTenant(db, ALICE, (tx) => tx.select().from(schema.job));
		const result = await importAnkiExport(db, ALICE, read(COMPSCI), new Date());
		const after = await withTenant(db, ALICE, (tx) => tx.select().from(schema.job));

		expect(after).toHaveLength(before.length + 1);
		expect(result.jobId).toMatch(/^\d+$/);
		const job = after.find((j) => String(j.id) === result.jobId);
		expect(job).toMatchObject({ kind: 'embed', userId: ALICE });
	});
});

describe('importAnkiExport, edge cases a real export can produce', () => {
	it('dedupes a GUID repeated within one file, last row wins', async () => {
		const raw = tsv([
			['dup-guid', 'Basic', 'Deck', 'first version', 'back'],
			['dup-guid', 'Basic', 'Deck', 'second version', 'back']
		]);
		const result = await importAnkiExport(db, CAROL, raw, new Date());
		expect(result.imported).toBe(1);

		const nodes = await withTenant(db, CAROL, (tx) => tx.select().from(schema.node));
		expect(nodes).toHaveLength(1);
		expect(nodes[0].front).toBe('second version');
	});

	it('normalizes an empty guid column to null, so two blank guids do not collide on idx_guid', async () => {
		const raw = tsv([
			['', 'Basic', 'Deck', 'front one', 'back one'],
			['', 'Basic', 'Deck', 'front two', 'back two']
		]);
		const result = await importAnkiExport(db, DAVE, raw, new Date());
		expect(result.imported).toBe(2);

		const nodes = await withTenant(db, DAVE, (tx) => tx.select().from(schema.node));
		expect(nodes).toHaveLength(2);
		expect(nodes.every((n) => n.ankiGuid === null)).toBe(true);
	});

	it('chunks bulk writes so a ~9000-row import does not overflow the bind-param limit', async () => {
		const rows = Array.from({ length: 9000 }, (_, i) => [
			`guid-${i}`,
			'Basic',
			'Big',
			`front ${i}`,
			`back ${i}`
		]);
		const result = await importAnkiExport(db, EVE, tsv(rows), new Date());
		expect(result.imported).toBe(9000);
		expect(result.jobId).toMatch(/^\d+$/);

		const nodes = await withTenant(db, EVE, (tx) =>
			tx.select({ id: schema.node.id }).from(schema.node)
		);
		expect(nodes).toHaveLength(9000);
	}, 60_000);

	it('a mixed re-import updates an edited card, adds a new one, and leaves other review_state untouched', async () => {
		const first = tsv([
			['g1', 'Basic', 'Deck', 'original front', 'back'],
			['g2', 'Basic', 'Deck', 'g2 front', 'back']
		]);
		await importAnkiExport(db, FRANK, first, new Date());

		const beforeNodes = await withTenant(db, FRANK, (tx) => tx.select().from(schema.node));
		const g1Id = beforeNodes.find((n) => n.ankiGuid === 'g1')!.id;

		// Real review history on g1, which a re-import must not disturb.
		await withTenant(db, FRANK, (tx) =>
			tx.update(schema.reviewState).set({ reps: 7 }).where(eq(schema.reviewState.nodeId, g1Id))
		);

		const second = tsv([
			['g1', 'Basic', 'Deck', 'edited front', 'back'], // existing, content changed
			['g2', 'Basic', 'Deck', 'g2 front', 'back'], // existing, unchanged
			['g3', 'Basic', 'Deck', 'g3 front', 'back'] // new
		]);
		const result = await importAnkiExport(db, FRANK, second, new Date());
		expect(result).toMatchObject({ imported: 1, matched: 2 });

		const afterNodes = await withTenant(db, FRANK, (tx) => tx.select().from(schema.node));
		expect(afterNodes.find((n) => n.id === g1Id)?.front).toBe('edited front');

		const reviewState = await withTenant(db, FRANK, (tx) => tx.select().from(schema.reviewState));
		expect(reviewState).toHaveLength(3);
		expect(reviewState.find((r) => r.nodeId === g1Id)?.reps).toBe(7);
	});
});

describe('readCappedText, the import stream cap', () => {
	function streamOf(parts: string[]): ReadableStream<Uint8Array> {
		const enc = new TextEncoder();
		return new ReadableStream({
			start(controller) {
				for (const p of parts) controller.enqueue(enc.encode(p));
				controller.close();
			}
		});
	}

	it('reads a body under the cap', async () => {
		const text = await readCappedText(streamOf(['hello ', 'world']), null, 100);
		expect(text).toBe('hello world');
	});

	it('rejects on a declared content-length over the cap, before reading', async () => {
		await expect(readCappedText(streamOf(['x']), '1000', 50)).rejects.toBeInstanceOf(
			PayloadTooLargeError
		);
	});

	it('rejects once bytes actually read exceed the cap, even with no content-length', async () => {
		const big = 'x'.repeat(60);
		await expect(readCappedText(streamOf([big]), null, 50)).rejects.toBeInstanceOf(
			PayloadTooLargeError
		);
	});

	it('caps at 4 MB — Vercel rejects request bodies above 4.5 MB before this code ever runs', () => {
		expect(MAX_IMPORT_BYTES).toBe(4 * 1024 * 1024);
	});
});

describe('POST /api/import, route-level gates', () => {
	type PostEvent = Parameters<typeof POST>[0];

	function fakeEvent(overrides: Partial<PostEvent>): PostEvent {
		const base = {
			request: new Request('http://localhost/api/import', { method: 'POST' }),
			locals: { user: null, session: null }
		};
		return { ...base, ...overrides } as unknown as PostEvent;
	}

	function bigBody(bytes: number): ReadableStream<Uint8Array> {
		const piece = new Uint8Array(64 * 1024);
		let sent = 0;
		return new ReadableStream({
			pull(controller) {
				if (sent >= bytes) {
					controller.close();
					return;
				}
				const n = Math.min(piece.length, bytes - sent);
				controller.enqueue(piece.subarray(0, n));
				sent += n;
			}
		});
	}

	it('401s when locals.user is not set', async () => {
		await expect(POST(fakeEvent({}))).rejects.toMatchObject({ status: 401 });
	});

	it('413s once the streamed body exceeds the cap, before any DB access', async () => {
		const request = new Request('http://localhost/api/import', {
			method: 'POST',
			body: bigBody(MAX_IMPORT_BYTES + 1024),
			duplex: 'half'
		} as RequestInit);
		const event = fakeEvent({
			request,
			locals: { user: { id: 'user_route_test', username: 'route' }, session: null }
		});
		await expect(POST(event)).rejects.toMatchObject({ status: 413 });
	});
});
