import { and, desc, eq, getTableColumns, gte, inArray, lt, ne, or, sql } from 'drizzle-orm';
import type { PgColumn } from 'drizzle-orm/pg-core';
import { db } from '$lib/server/db';
import * as table from '$lib/server/db/schema';
import { BULK_MAX, FIELD_MAX, normalizeDeck, normalizeTags } from '$lib/cards/edit';
import { replaceText, sanitizeCardHtml } from '$lib/cards/sanitize';
import { internalId } from '$lib/server/ingest/identity';
import { questLock, syncImportGraphIn } from '$lib/server/quest/repo';
import { plainText, stateName } from './browse';
import type { Tx } from './review';

// The card editor's writes (ROADMAP CRD-A). Every one takes questLock first, as
// importDeck does, then the card rows: the graph sync after a deck or tag change
// can reach the Quest run row, and any other order can deadlock a Quest grade.
// Review state is never touched by an edit. Anki keeps the schedule when the
// text changes, and so does this.

/** A message the editor can show as is. Anything else thrown is a server fault. */
export class EditError extends Error {}

export interface CardInput {
	front: string;
	back: string;
	deck: string;
	tags: string[];
}

/** How long a delete stays undoable. Older trash is purged on the next editor write. */
const TRASH_TTL_MS = 24 * 60 * 60 * 1000;

const n = table.node;
const expired = (now: Date) => new Date(now.getTime() - TRASH_TTL_MS);

// No scheduler runs here (ROADMAP: no cron), so every editor write purges the
// user's expired trash. Restore checks the age itself, so a late purge costs storage only.
function locked<T>(userId: string, fn: (tx: Tx) => Promise<T>): Promise<T> {
	return db.transaction(async (tx) => {
		await tx.execute(questLock(userId));
		const t = table.cardTrash;
		await tx.delete(t).where(and(eq(t.userId, userId), lt(t.createdAt, expired(new Date()))));
		return fn(tx);
	});
}

/** The caller's own cards among `ids`, row-locked. Other users' ids and non-cards drop out. */
async function ownCards(tx: Tx, userId: string, ids: string[]) {
	const list = [...new Set(ids)].slice(0, BULK_MAX);
	if (!list.length) return [];
	return tx
		.select({ id: n.id, front: n.front, back: n.back, deck: n.deck, tags: n.tags })
		.from(n)
		.where(and(eq(n.userId, userId), eq(n.kind, 'card'), inArray(n.id, list)))
		.for('update');
}

// An image alone is a front. Whitespace and empty tags are not.
const emptyFront = (front: string) => !plainText(front) && !/<img\b/i.test(front);

function cleanInput(input: CardInput) {
	if (input.front.length > FIELD_MAX || input.back.length > FIELD_MAX)
		throw new EditError('A field is over 64 KB. Split the card or trim the pasted text.');
	const deck = normalizeDeck(input.deck);
	if (!deck) throw new EditError('Pick a deck.');
	const front = sanitizeCardHtml(input.front);
	if (emptyFront(front)) throw new EditError('The front is empty.');
	return { front, back: sanitizeCardHtml(input.back), deck, tags: normalizeTags(input.tags) };
}

const sameTags = (a: string[], b: string[]) => a.join('\u0000') === b.join('\u0000');

/** Anki's GUID alphabet is base91. Base62 is a subset, safe in a TSV export and a URL. */
function randomGuid() {
	const abc = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
	return Array.from(crypto.getRandomValues(new Uint8Array(10)), (b) => abc[b % 62]).join('');
}

/**
 * A new Basic card, with no schedule until its first review. Returns its id and
 * the fields as stored, which the sanitizer may have changed.
 */
export async function createCard(userId: string, input: CardInput, now = new Date()) {
	const card = cleanInput(input);
	const guid = randomGuid();
	const id = internalId(userId, guid);
	await locked(userId, async (tx) => {
		await tx.insert(n).values({ id, userId, ankiGuid: guid, ...card, updatedAt: now });
		await syncImportGraphIn(tx, userId);
	});
	return { id, ...card };
}

/** Saves a card's fields. Returns them as stored, or null when the card is not the caller's. */
export async function updateCard(userId: string, id: string, input: CardInput, now = new Date()) {
	const card = cleanInput(input);
	return locked(userId, async (tx) => {
		const [old] = await ownCards(tx, userId, [id]);
		if (!old) return null;
		const graphChanged = old.deck !== card.deck || !sameTags(old.tags, card.tags);
		// A save with nothing changed is not an edit: updated_at decides whether a
		// re-import may overwrite the card (importDeck).
		if (!graphChanged && old.front === card.front && old.back === card.back) return { id, ...card };
		await tx
			.update(n)
			.set({ ...card, updatedAt: now })
			.where(and(eq(n.id, id), eq(n.userId, userId)));
		if (graphChanged) await syncImportGraphIn(tx, userId);
		return { id, ...card };
	});
}

/** Everything the editor shows for one card, or null when it is not the caller's. */
export async function getCard(userId: string, id: string) {
	const rs = table.reviewState;
	const [row] = await db
		.select({
			id: n.id,
			front: n.front,
			back: n.back,
			deck: n.deck,
			tags: n.tags,
			notetype: n.notetype,
			flag: n.flag,
			suspended: n.suspended,
			createdAt: n.createdAt,
			updatedAt: n.updatedAt,
			state: rs.state,
			due: rs.due,
			stability: rs.stability,
			difficulty: rs.difficulty,
			reps: rs.reps,
			lapses: rs.lapses,
			lastReview: rs.lastReview
		})
		.from(n)
		.leftJoin(rs, and(eq(rs.nodeId, n.id), eq(rs.userId, userId)))
		.where(and(eq(n.id, id), eq(n.userId, userId), eq(n.kind, 'card')));
	if (!row) return null;
	const log = await db
		.select({
			reviewedAt: table.reviewLog.reviewedAt,
			rating: table.reviewLog.rating,
			surface: table.reviewLog.surface
		})
		.from(table.reviewLog)
		.where(and(eq(table.reviewLog.userId, userId), eq(table.reviewLog.nodeId, id)))
		.orderBy(desc(table.reviewLog.reviewedAt), desc(table.reviewLog.id))
		.limit(30);
	const state = stateName(row.state);
	return { ...row, state, scheduled: row.state !== null && row.state !== 0, log };
}

export type EditorCard = NonNullable<Awaited<ReturnType<typeof getCard>>>;

/** Deck names and tags across all the caller's cards, for the pickers' typeahead. */
export async function editorOptions(userId: string) {
	const mine = and(eq(n.userId, userId), eq(n.kind, 'card'));
	const [decks, tags] = await Promise.all([
		db.selectDistinct({ deck: n.deck }).from(n).where(mine),
		db
			.selectDistinct({ tag: sql<string>`unnest(${n.tags})` })
			.from(n)
			.where(mine)
	]);
	const byName = (a: string, b: string) => a.localeCompare(b);
	return {
		decks: decks.map((d) => d.deck).sort(byName),
		tags: tags.map((t) => t.tag).sort(byName)
	};
}

// Visible text, lowercased, whitespace collapsed: what Anki compares for "Duplicate".
const normalized = (html: unknown) =>
	sql`lower(btrim(regexp_replace(regexp_replace(regexp_replace(${html}, '<[^>]*>', ' ', 'g'), '&nbsp;', ' ', 'gi'), '\\s+', ' ', 'g')))`;

/** Other cards whose front reads the same as `front`. At most five. */
export async function findDuplicates(userId: string, front: string, excludeId: string | null) {
	if (!plainText(front)) return [];
	return db
		.select({ id: n.id, deck: n.deck })
		.from(n)
		.where(
			and(
				eq(n.userId, userId),
				eq(n.kind, 'card'),
				excludeId ? ne(n.id, excludeId) : undefined,
				sql`${normalized(n.front)} = ${normalized(front.slice(0, FIELD_MAX))}`
			)
		)
		.orderBy(n.deck, n.id)
		.limit(5);
}

/** What a delete removed. Timestamps are ISO strings once stored as JSON. */
type Json<T> = {
	[K in keyof T]: T[K] extends Date ? string : T[K] extends Date | null ? string | null : T[K];
};
export interface Trashed {
	nodes: Json<Omit<table.Node, 'embedding'>>[];
	states: Json<table.ReviewState>[];
	logs: Json<Omit<table.ReviewLog, 'id'>>[];
	edges: Omit<table.Edge, 'id'>[];
	harvests: { id: string; nodeId: string; status: string }[];
}

/* eslint-disable @typescript-eslint/no-unused-vars -- each named key is what the snapshot leaves out */
const { embedding: _embedding, ...nodeColumns } = getTableColumns(table.node);
const { id: _logId, ...logColumns } = getTableColumns(table.reviewLog);
const { id: _edgeId, ...edgeColumns } = getTableColumns(table.edge);
/* eslint-enable @typescript-eslint/no-unused-vars */

/**
 * Delete cards with everything that hangs off them, as deleteDeck does, and keep
 * a copy in card_trash for restoreCards. Returns the trash id, or null when none
 * of `ids` is the caller's.
 */
export async function deleteCards(userId: string, ids: string[], now = new Date()) {
	return locked(userId, async (tx) => {
		const got = (await ownCards(tx, userId, ids)).map((r) => r.id);
		if (!got.length) return null;
		const mine = (col: PgColumn) => eq(col, userId);
		const e = table.edge;
		const log = table.reviewLog;
		const rs = table.reviewState;
		const h = table.harvest;
		const [nodes, states, logs, edges, harvests] = await Promise.all([
			tx
				.select(nodeColumns)
				.from(n)
				.where(and(mine(n.userId), inArray(n.id, got))),
			tx
				.select()
				.from(rs)
				.where(and(mine(rs.userId), inArray(rs.nodeId, got))),
			tx
				.select(logColumns)
				.from(log)
				.where(and(mine(log.userId), inArray(log.nodeId, got))),
			tx
				.select(edgeColumns)
				.from(e)
				.where(and(mine(e.userId), or(inArray(e.srcId, got), inArray(e.dstId, got)))),
			tx
				.select({ id: h.id, nodeId: h.nodeId, status: h.status })
				.from(h)
				.where(and(mine(h.userId), inArray(h.nodeId, got)))
		]);

		await tx.delete(log).where(and(mine(log.userId), inArray(log.nodeId, got)));
		await tx.delete(rs).where(and(mine(rs.userId), inArray(rs.nodeId, got)));
		await tx.delete(e).where(and(mine(e.userId), or(inArray(e.srcId, got), inArray(e.dstId, got))));
		// A harvested link that became one of these cards goes back to review.
		await tx
			.update(h)
			.set({ nodeId: null, status: 'ready' })
			.where(and(mine(h.userId), inArray(h.nodeId, got)));
		await tx
			.update(table.questRun)
			.set({ currentNodeId: null })
			.where(and(mine(table.questRun.userId), inArray(table.questRun.currentNodeId, got)));
		await tx.delete(n).where(and(mine(n.userId), inArray(n.id, got)));

		const trashId = crypto.randomUUID();
		const payload: Trashed = JSON.parse(
			JSON.stringify({
				nodes,
				states,
				logs,
				edges,
				harvests: harvests.map((x) => ({ ...x, id: String(x.id) }))
			})
		);
		await tx.insert(table.cardTrash).values({ id: trashId, userId, payload, createdAt: now });
		await syncImportGraphIn(tx, userId);
		return { trashId, count: got.length };
	});
}

const at = (s: string | null) => (s === null ? null : new Date(s));

/**
 * Undo a delete from the server's own copy. A card whose id came back in the
 * meantime (a re-import) stays as it is now, and so does everything hung off it.
 * Returns the number of cards restored, or null when there is no such delete to
 * undo (already undone, over a day old, or another user's).
 */
export async function restoreCards(userId: string, trashId: string, now = new Date()) {
	return locked(userId, async (tx) => {
		const t = table.cardTrash;
		// Trash outlives its TTL until the next write purges it, so the age is checked here.
		const [row] = await tx
			.select()
			.from(t)
			.where(and(eq(t.id, trashId), eq(t.userId, userId), gte(t.createdAt, expired(now))));
		if (!row) return null;
		const p = row.payload as Trashed;
		// The payload is the server's own, but the user id is pinned anyway.
		const restored = p.nodes.length
			? await tx
					.insert(n)
					.values(
						p.nodes.map((x) => ({
							...x,
							userId,
							createdAt: new Date(x.createdAt),
							updatedAt: at(x.updatedAt)
						}))
					)
					.onConflictDoNothing()
					.returning({ id: n.id })
			: [];
		const back = new Set(restored.map((r) => r.id));
		const states = p.states.filter((s) => back.has(s.nodeId));
		if (states.length)
			await tx
				.insert(table.reviewState)
				.values(
					states.map((s) => ({ ...s, userId, due: new Date(s.due), lastReview: at(s.lastReview) }))
				)
				.onConflictDoNothing();

		const logs = p.logs.filter((l) => back.has(l.nodeId));
		const roundIds = [...new Set(logs.map((l) => l.assessmentId).filter((x) => x !== null))];
		const rounds = new Set(
			roundIds.length
				? (
						await tx
							.select({ id: table.assessment.id })
							.from(table.assessment)
							.where(
								and(eq(table.assessment.userId, userId), inArray(table.assessment.id, roundIds))
							)
					).map((r) => r.id)
				: []
		);
		if (logs.length)
			await tx
				.insert(table.reviewLog)
				.values(
					logs.map((l) => ({
						...l,
						userId,
						reviewedAt: new Date(l.reviewedAt),
						// A round deleted since (its deck went) keeps the review, not the link.
						assessmentId: l.assessmentId && rounds.has(l.assessmentId) ? l.assessmentId : null
					}))
				)
				.onConflictDoNothing();

		// Import edges are re-derived below. Others come back when both ends exist.
		const others = p.edges.filter(
			(e) => e.provenance !== 'import' && (back.has(e.srcId) || back.has(e.dstId))
		);
		if (others.length) {
			const ends = [...new Set(others.flatMap((e) => [e.srcId, e.dstId]))];
			const live = new Set(
				(
					await tx
						.select({ id: n.id })
						.from(n)
						.where(and(eq(n.userId, userId), inArray(n.id, ends)))
				).map((r) => r.id)
			);
			const keep = others.filter((e) => live.has(e.srcId) && live.has(e.dstId));
			if (keep.length)
				await tx
					.insert(table.edge)
					.values(keep.map((e) => ({ ...e, userId })))
					.onConflictDoNothing();
		}
		for (const hv of p.harvests.filter((x) => back.has(x.nodeId)))
			await tx
				.update(table.harvest)
				.set({ nodeId: hv.nodeId, status: hv.status })
				.where(
					and(
						eq(table.harvest.userId, userId),
						eq(table.harvest.id, BigInt(hv.id)),
						sql`${table.harvest.nodeId} is null`
					)
				);
		await tx.delete(t).where(eq(t.id, trashId));
		await syncImportGraphIn(tx, userId);
		return back.size;
	});
}

/** Move cards to a deck, new or existing. Returns the number moved. */
export async function moveCards(userId: string, ids: string[], deckName: string, now = new Date()) {
	const deck = normalizeDeck(deckName);
	if (!deck) throw new EditError('Pick a deck.');
	return locked(userId, async (tx) => {
		const got = (await ownCards(tx, userId, ids)).map((r) => r.id);
		if (!got.length) return 0;
		await tx
			.update(n)
			.set({ deck, updatedAt: now })
			.where(and(eq(n.userId, userId), inArray(n.id, got)));
		await syncImportGraphIn(tx, userId);
		return got.length;
	});
}

/** Add and remove tags across cards. Removal ignores case, as Anki's does. */
export async function retagCards(
	userId: string,
	ids: string[],
	add: string[],
	remove: string[],
	now = new Date()
) {
	const adding = normalizeTags(add);
	const dropping = new Set(normalizeTags(remove).map((t) => t.toLowerCase()));
	return locked(userId, async (tx) => {
		let changed = 0;
		for (const c of await ownCards(tx, userId, ids)) {
			const tags = normalizeTags([
				...c.tags.filter((t) => !dropping.has(t.toLowerCase())),
				...adding
			]);
			if (sameTags(tags, c.tags)) continue;
			await tx
				.update(n)
				.set({ tags, updatedAt: now })
				.where(and(eq(n.id, c.id), eq(n.userId, userId)));
			changed += 1;
		}
		if (changed) await syncImportGraphIn(tx, userId);
		return changed;
	});
}

/** Anki's flag and suspend are card state, not an edit of the note: updated_at stays. */
async function setCardState(
	userId: string,
	ids: string[],
	set: { flag: number } | { suspended: boolean }
) {
	return locked(userId, async (tx) => {
		const got = (await ownCards(tx, userId, ids)).map((r) => r.id);
		if (got.length)
			await tx
				.update(n)
				.set(set)
				.where(and(eq(n.userId, userId), inArray(n.id, got)));
		return got.length;
	});
}

export const setSuspended = (userId: string, ids: string[], suspended: boolean) =>
	setCardState(userId, ids, { suspended });

export function setFlag(userId: string, ids: string[], flag: number) {
	if (!Number.isInteger(flag) || flag < 0 || flag > 7) throw new EditError('Pick a flag.');
	return setCardState(userId, ids, { flag });
}

/**
 * Anki's Forget: the cards become new. Their review history stays, so stats and
 * past rounds still count what happened.
 */
export async function forgetCards(userId: string, ids: string[]) {
	return locked(userId, async (tx) => {
		const got = (await ownCards(tx, userId, ids)).map((r) => r.id);
		if (got.length)
			await tx
				.delete(table.reviewState)
				.where(and(eq(table.reviewState.userId, userId), inArray(table.reviewState.nodeId, got)));
		return got.length;
	});
}

export type Field = 'front' | 'back' | 'both';

/** Find and replace in the cards' text (see replaceText). Returns the cards changed. */
export async function replaceInCards(
	userId: string,
	ids: string[],
	find: string,
	replacement: string,
	field: Field,
	matchCase: boolean,
	now = new Date()
) {
	if (!find) throw new EditError('Type what to find.');
	return locked(userId, async (tx) => {
		let changed = 0;
		for (const c of await ownCards(tx, userId, ids)) {
			const edit = (html: string, on: boolean) => {
				const next = on ? replaceText(html, find, replacement, matchCase) : html;
				return next === html ? html : sanitizeCardHtml(next);
			};
			const front = edit(c.front, field !== 'back');
			const back = edit(c.back, field !== 'front');
			if (front === c.front && back === c.back) continue;
			if (front.length > FIELD_MAX || back.length > FIELD_MAX)
				throw new EditError('A replacement would make a field over 64 KB.');
			if (emptyFront(front)) throw new EditError('A replacement would leave a front empty.');
			await tx
				.update(n)
				.set({ front, back, updatedAt: now })
				.where(and(eq(n.id, c.id), eq(n.userId, userId)));
			changed += 1;
		}
		return changed;
	});
}
