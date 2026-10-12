import { hasDb } from '../testing/db';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import * as table from '../db/schema';
import { conceptId, internalId } from '../ingest/identity';

const { db, asTenant } = hasDb ? await import('../db') : ({} as typeof import('../db'));
const edit = hasDb ? await import('./edit') : ({} as typeof import('./edit'));
// Policies come from drizzle/0003_rls.sql and 0006_card_editor.sql via db:migrate. CI migrates.
const hasRls =
	hasDb &&
	((
		await db.execute<{ n: number }>(
			sql`select count(*)::int as n from pg_policy where polname = 'tenant'`
		)
	)[0].n > 0 ||
		Boolean(process.env.CI));
const repo = hasDb ? await import('./repo') : ({} as typeof import('./repo'));

describe.skipIf(!hasDb)('card editor writes', () => {
	const run = crypto.randomUUID().slice(0, 8);
	const userId = `test-edit-${run}`;
	const other = `test-edit-other-${run}`;
	const deck = `edit-deck-${run}`;
	const users = [userId, other];

	async function cleanup() {
		await db.delete(table.cardTrash).where(inArray(table.cardTrash.userId, users));
		await db.delete(table.reviewLog).where(inArray(table.reviewLog.userId, users));
		await db.delete(table.reviewState).where(inArray(table.reviewState.userId, users));
		await db.delete(table.assessment).where(inArray(table.assessment.userId, users));
		await db.delete(table.questRun).where(inArray(table.questRun.userId, users));
		await db.delete(table.edge).where(inArray(table.edge.userId, users));
		await db.delete(table.harvest).where(inArray(table.harvest.userId, users));
		await db.delete(table.node).where(inArray(table.node.userId, users));
		await db.delete(table.user).where(inArray(table.user.id, users));
	}

	const card = (u: string, i: number, d = deck, extra: Partial<table.Node> = {}) => ({
		id: `${run}-${u === userId ? 'a' : 'b'}${i}`,
		userId: u,
		deck: d,
		front: `front ${i}`,
		back: `back ${i}`,
		tags: ['t1'],
		...extra
	});
	const input = (over: Partial<import('./edit').CardInput> = {}) => ({
		front: 'Q',
		back: 'A',
		deck,
		tags: ['t1'],
		...over
	});
	const me = <T>(fn: () => Promise<T>) => asTenant(userId, fn);
	const nodeById = async (id: string) =>
		(await db.select().from(table.node).where(eq(table.node.id, id)))[0];
	const stateOf = async (id: string) =>
		(await db.select().from(table.reviewState).where(eq(table.reviewState.nodeId, id)))[0];

	/** Grade card i once in a round, so it has review state and a log row. */
	async function grade(i: number) {
		const r = (await repo.startRound(userId, deck))!;
		const id = card(userId, i).id;
		expect(r.cards.map((c) => c.id)).toContain(id);
		await repo.recordGrade(userId, r.assessmentId, id, 3, 0);
		await repo.finishRound(userId, r.assessmentId);
		return id;
	}

	beforeEach(async () => {
		await cleanup();
		await db.insert(table.user).values(users.map((id) => ({ id, email: `${id}@test.invalid` })));
		await db
			.insert(table.node)
			.values([card(userId, 0), card(userId, 1), card(userId, 2), card(other, 0)]);
	});
	afterAll(cleanup);

	it('stores sanitized HTML when a save carries a script or an onerror', async () => {
		const dirty = 'ok<script>alert(1)</script><img src="https://a.test/x.png" onerror="alert(2)">';
		const { id } = await me(() =>
			edit.createCard(userId, input({ front: dirty, back: `<b onclick="x()">b</b>${dirty}` }))
		);
		const n = await nodeById(id);
		for (const field of [n.front, n.back]) {
			expect(field).not.toMatch(/<script|onerror|onclick|alert\(1\)/i);
			expect(field).toContain('https://a.test/x.png');
		}
		expect(n.back).toContain('<b>b</b>');

		await me(() =>
			edit.updateCard(userId, id, input({ back: '<a href="javascript:alert(1)">x</a>' }))
		);
		expect((await nodeById(id)).back).not.toMatch(/javascript:/i);
	});

	it('gives a new card a GUID its id derives from, and a place in the Quest graph', async () => {
		const { id } = await me(() => edit.createCard(userId, input()));
		const n = await nodeById(id);
		expect(n.ankiGuid).toMatch(/^[A-Za-z0-9]{10}$/);
		expect(id).toBe(internalId(userId, n.ankiGuid!));
		const [e] = await db
			.select()
			.from(table.edge)
			.where(and(eq(table.edge.srcId, id), eq(table.edge.kind, 'deck')));
		expect(e.dstId).toBe(conceptId(userId, 'deck', deck));
	});

	it('refuses an empty front or a missing deck, and stores nothing', async () => {
		await expect(
			me(() => edit.createCard(userId, input({ front: '<p> </p><br>' })))
		).rejects.toThrow(edit.EditError);
		await expect(me(() => edit.createCard(userId, input({ deck: ' :: ' })))).rejects.toThrow(
			'Pick a deck.'
		);
		const mine = await db.select().from(table.node).where(eq(table.node.userId, userId));
		expect(mine).toHaveLength(3);
	});

	it('leaves review_state byte-equal when the text changes', async () => {
		const id = await grade(0);
		const before = await db.execute(sql`select * from review_state where node_id = ${id}`);
		const saved = await me(() =>
			edit.updateCard(userId, id, input({ front: 'new front', back: '<i>new</i>' }))
		);
		expect(saved).toMatchObject({ front: 'new front', back: '<i>new</i>' });
		const after = await db.execute(sql`select * from review_state where node_id = ${id}`);
		expect(after).toEqual(before);
		expect((await nodeById(id)).updatedAt).toBeInstanceOf(Date);
	});

	it('moves a card and its Quest edge with a deck change', async () => {
		const id = card(userId, 0).id;
		await me(() => edit.updateCard(userId, id, input({ deck: `${deck}-moved` })));
		expect((await nodeById(id)).deck).toBe(`${deck}-moved`);
		const deckEdges = await db
			.select({ dst: table.edge.dstId })
			.from(table.edge)
			.where(and(eq(table.edge.srcId, id), eq(table.edge.kind, 'deck')));
		expect(deckEdges).toEqual([{ dst: conceptId(userId, 'deck', `${deck}-moved`) }]);

		await me(() =>
			edit.moveCards(userId, [card(userId, 1).id, card(userId, 2).id], 'Lang::French')
		);
		const moved = await db
			.select({ deck: table.node.deck })
			.from(table.node)
			.where(inArray(table.node.id, [card(userId, 1).id, card(userId, 2).id]));
		expect(moved.map((m) => m.deck)).toEqual(['Lang::French', 'Lang::French']);
	});

	it("cannot read, edit, move or delete another user's card", async () => {
		const theirs = card(other, 0).id;
		expect(await me(() => edit.getCard(userId, theirs))).toBeNull();
		expect(await me(() => edit.updateCard(userId, theirs, input({ front: 'pwned' })))).toBeNull();
		expect(await me(() => edit.moveCards(userId, [theirs], 'x'))).toBe(0);
		expect(await me(() => edit.deleteCards(userId, [theirs]))).toBeNull();
		expect((await nodeById(theirs)).front).toBe('front 0');
	});

	it('deletes a card with its history, and Undo restores all of it', async () => {
		const id = await grade(0);
		await db.insert(table.harvest).values({
			userId,
			urlNormalized: `https://a.test/${run}`,
			status: 'accepted',
			nodeId: id
		});
		const state = await db.execute(sql`select * from review_state where node_id = ${id}`);
		const logs = await db.select().from(table.reviewLog).where(eq(table.reviewLog.nodeId, id));
		expect(logs).toHaveLength(1);

		const gone = (await me(() => edit.deleteCards(userId, [id, card(other, 0).id])))!;
		expect(gone.count).toBe(1);
		expect(await nodeById(id)).toBeUndefined();
		expect(await stateOf(id)).toBeUndefined();
		const [h] = await db.select().from(table.harvest).where(eq(table.harvest.userId, userId));
		expect(h).toMatchObject({ status: 'ready', nodeId: null });

		expect(await asTenant(other, () => edit.restoreCards(other, gone.trashId))).toBe(0);
		expect(await me(() => edit.restoreCards(userId, gone.trashId))).toBe(1);
		expect((await nodeById(id)).front).toBe('front 0');
		expect(await db.execute(sql`select * from review_state where node_id = ${id}`)).toEqual(state);
		const back = await db.select().from(table.reviewLog).where(eq(table.reviewLog.nodeId, id));
		// Log ids are serials, renumbered on the way back. Everything else is the same.
		const noId = (rows: typeof logs) => rows.map((l) => ({ ...l, id: 0n }));
		expect(noId(back)).toEqual(noId(logs));
		const [h2] = await db.select().from(table.harvest).where(eq(table.harvest.userId, userId));
		expect(h2).toMatchObject({ status: 'accepted', nodeId: id });
		const deckEdge = await db
			.select()
			.from(table.edge)
			.where(and(eq(table.edge.srcId, id), eq(table.edge.kind, 'deck')));
		expect(deckEdge).toHaveLength(1);

		// The trash is spent: a second Undo has nothing to restore.
		expect(await me(() => edit.restoreCards(userId, gone.trashId))).toBe(0);
	});

	it('keeps a card re-imported since its delete as it is now', async () => {
		const id = card(userId, 0).id;
		const gone = (await me(() => edit.deleteCards(userId, [id])))!;
		await db.insert(table.node).values(card(userId, 0, deck, { front: 'reimported' }));
		expect(await me(() => edit.restoreCards(userId, gone.trashId))).toBe(0);
		expect((await nodeById(id)).front).toBe('reimported');
	});

	it('takes a suspended card out of rounds and due counts, and keeps its schedule', async () => {
		const id = await grade(0);
		const before = await stateOf(id);
		await me(() => edit.setSuspended(userId, [id], true));
		await db
			.update(table.reviewState)
			.set({ due: new Date(Date.now() - 86_400_000) })
			.where(eq(table.reviewState.nodeId, id));
		const r = (await repo.startRound(userId, deck))!;
		expect(r.cards.map((c) => c.id)).not.toContain(id);
		const [d] = (await repo.listDecks(userId)).filter((x) => x.deck === deck);
		expect(d).toMatchObject({ total: 3, due: 0 });
		expect((await stateOf(id)).stability).toBe(before.stability);

		await me(() => edit.setSuspended(userId, [id], false));
		const [d2] = (await repo.listDecks(userId)).filter((x) => x.deck === deck);
		expect(d2.due).toBe(1);
	});

	it('flags cards, and refuses a flag outside 0-7', async () => {
		const ids = [card(userId, 0).id, card(userId, 1).id];
		expect(await me(() => edit.setFlag(userId, ids, 3))).toBe(2);
		expect((await nodeById(ids[0])).flag).toBe(3);
		await expect(me(() => edit.setFlag(userId, ids, 8))).rejects.toThrow(edit.EditError);
	});

	it('adds and removes tags across cards, removal ignoring case', async () => {
		const ids = [card(userId, 0).id, card(userId, 1).id];
		expect(await me(() => edit.retagCards(userId, ids, ['new', 'T1'], []))).toBe(2);
		expect((await nodeById(ids[0])).tags).toEqual(['t1', 'new']);
		expect(await me(() => edit.retagCards(userId, ids, [], ['T1']))).toBe(2);
		expect((await nodeById(ids[1])).tags).toEqual(['new']);
		// Nothing to change is not a change.
		expect(await me(() => edit.retagCards(userId, ids, ['new'], []))).toBe(0);
	});

	it('finds and replaces in text only, on the cards given', async () => {
		const id = card(userId, 0).id;
		await db
			.update(table.node)
			.set({ back: '<a href="https://front.test">front</a> front' })
			.where(eq(table.node.id, id));
		const n = await me(() =>
			edit.replaceInCards(userId, [id, card(userId, 1).id], 'front', 'face', 'both', true)
		);
		expect(n).toBe(2);
		const after = await nodeById(id);
		expect(after.front).toBe('face 0');
		expect(after.back).toBe(
			'<a href="https://front.test" target="_blank" rel="noopener noreferrer">face</a> face'
		);
		expect((await nodeById(card(userId, 2).id)).front).toBe('front 2');
	});

	it('finds a duplicate front across formatting and case, never the card itself', async () => {
		const id = card(userId, 0).id;
		const dupes = await me(() => edit.findDuplicates(userId, '<b>FRONT</b>&nbsp; 0 ', null));
		expect(dupes.map((d) => d.id)).toEqual([id]);
		expect(await me(() => edit.findDuplicates(userId, 'front 0', id))).toEqual([]);
		expect(await me(() => edit.findDuplicates(userId, '<br>', null))).toEqual([]);
	});

	it('forgets a schedule and keeps the review history', async () => {
		const id = await grade(0);
		expect(await me(() => edit.forgetCards(userId, [id]))).toBe(1);
		expect(await stateOf(id)).toBeUndefined();
		const logs = await db.select().from(table.reviewLog).where(eq(table.reviewLog.nodeId, id));
		expect(logs).toHaveLength(1);
		expect((await me(() => edit.getCard(userId, id)))!.state).toBe('new');
	});

	it.skipIf(!hasRls)("hides one tenant's trash from another at the row level", async () => {
		const gone = (await me(() => edit.deleteCards(userId, [card(userId, 0).id])))!;
		const seen = await asTenant(other, () =>
			db.select({ id: table.cardTrash.id }).from(table.cardTrash)
		);
		expect(seen.map((r) => r.id)).not.toContain(gone.trashId);
		await expect(
			asTenant(other, () =>
				db.insert(table.cardTrash).values({ id: `x-${run}`, userId, payload: {} })
			)
		).rejects.toThrow();
	});
});
