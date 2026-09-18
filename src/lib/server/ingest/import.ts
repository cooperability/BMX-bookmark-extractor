import { inArray, sql } from 'drizzle-orm';
import type { PgDatabase, PgQueryResultHKT, PgTransaction } from 'drizzle-orm/pg-core';
import type { TablesRelationalConfig } from 'drizzle-orm';
import { withTenant } from '../db/rls';
import * as table from '../db/schema';
import { parseAnkiExport, type AnkiNote } from './anki-tsv';

// Vercel caps request bodies at 4.5 MB, so a 25 MB cap is unreachable in
// production; larger imports are a later Blob-upload slice.
export const MAX_IMPORT_BYTES = 4 * 1024 * 1024;

// Bulk statements stay under Postgres's 65535 bind-param limit. The node
// upsert has 8 params/row, so 1000 rows/statement is well clear of the
// ~8191-row ceiling that hits at 8 params/row.
const BATCH_SIZE = 1000;

export class PayloadTooLargeError extends Error {}

/**
 * Reads a body stream into text, enforcing `limit` twice: once against the
 * declared Content-Length (cheap, spoofable) and once against bytes actually
 * read (expensive, authoritative). Rejects before the whole body is buffered.
 */
export async function readCappedText(
	body: ReadableStream<Uint8Array> | null,
	contentLength: string | null,
	limit: number
): Promise<string> {
	if (contentLength && Number(contentLength) > limit) {
		throw new PayloadTooLargeError(`content-length ${contentLength} exceeds ${limit} bytes`);
	}
	if (!body) return '';

	const reader = body.getReader();
	const chunks: Uint8Array[] = [];
	let total = 0;
	for (;;) {
		const { done, value } = await reader.read();
		if (done) break;
		total += value.byteLength;
		if (total > limit) {
			await reader.cancel();
			throw new PayloadTooLargeError(`body exceeds ${limit} bytes`);
		}
		chunks.push(value);
	}
	return new TextDecoder().decode(concat(chunks, total));
}

function concat(chunks: Uint8Array[], total: number): Uint8Array {
	const out = new Uint8Array(total);
	let offset = 0;
	for (const chunk of chunks) {
		out.set(chunk, offset);
		offset += chunk.length;
	}
	return out;
}

function chunk<T>(items: T[], size: number): T[][] {
	const out: T[][] = [];
	for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
	return out;
}

export interface ImportResult {
	imported: number;
	/** Rows that already existed and were upserted, changed or not. */
	matched: number;
	jobId: string;
}

type AnyDb = PgDatabase<PgQueryResultHKT, Record<string, unknown>, TablesRelationalConfig>;
type AnyTx = PgTransaction<PgQueryResultHKT, Record<string, unknown>, TablesRelationalConfig>;

/**
 * Warm path: parse -> sanitize (done inside parseAnkiExport) -> GUID upsert ->
 * enqueue, all inside one withTenant transaction. TDD §1.2, §5.2.
 */
export async function importAnkiExport(
	db: AnyDb,
	userId: string,
	raw: string,
	now: Date
): Promise<ImportResult> {
	const { notes } = parseAnkiExport(raw, userId);

	// A repeated GUID (or repeated content, on the guid-less path) yields a
	// repeated `id`. Two rows sharing an id in one INSERT..ON CONFLICT trips
	// "cannot affect row a second time" in Postgres, so dedupe first; the
	// later row in the file wins, matching Anki's own last-write-wins export.
	const deduped = new Map<string, AnkiNote>();
	for (const note of notes) deduped.set(note.id, note);
	const dedupedNotes = [...deduped.values()];

	if (dedupedNotes.length === 0) {
		return withTenant(db, userId, async (tx) => {
			const [job] = await tx
				.insert(table.job)
				.values({ userId, kind: 'embed', payload: { nodeIds: [] } })
				.returning({ id: table.job.id });
			return { imported: 0, matched: 0, jobId: String(job.id) };
		});
	}

	return withTenant(db, userId, async (tx: AnyTx) => {
		const ids = dedupedNotes.map((n) => n.id);
		const existing = await tx
			.select({ id: table.node.id })
			.from(table.node)
			.where(inArray(table.node.id, ids));
		const existingIds = new Set(existing.map((r) => r.id));
		const newIds = ids.filter((id) => !existingIds.has(id));

		// Bulk upsert on the primary key. `id` is already derived from
		// (userId, guid) — see identity.ts — so it re-identifies a card across
		// imports even for the guid-less content-id path, unlike a conflict
		// target on (user_id, anki_guid), which cannot match a null guid.
		for (const batch of chunk(dedupedNotes, BATCH_SIZE)) {
			await tx
				.insert(table.node)
				.values(
					batch.map((n) => ({
						id: n.id,
						userId,
						// "" (a declared-but-empty guid column) is not null, and
						// idx_guid's unique index treats two ""s as a collision the
						// way it would never treat two NULLs. Normalize here so the
						// column only ever holds a real guid or nothing.
						ankiGuid: n.ankiGuid || null,
						notetype: n.notetype,
						front: n.front,
						back: n.back,
						deck: n.deck,
						tags: n.tags
					}))
				)
				.onConflictDoUpdate({
					target: table.node.id,
					set: {
						ankiGuid: sql`excluded.anki_guid`,
						notetype: sql`excluded.notetype`,
						front: sql`excluded.front`,
						back: sql`excluded.back`,
						deck: sql`excluded.deck`,
						tags: sql`excluded.tags`
					}
				});
		}

		for (const batch of chunk(newIds, BATCH_SIZE)) {
			await tx
				.insert(table.reviewState)
				.values(batch.map((nodeId) => ({ userId, nodeId, due: now })))
				// A concurrent second import racing on the same new id must not 500
				// on the review_state primary key; losing that race is a no-op.
				.onConflictDoNothing({
					target: [table.reviewState.userId, table.reviewState.nodeId]
				});
		}

		const [job] = await tx
			.insert(table.job)
			.values({ userId, kind: 'embed', payload: { nodeIds: ids } })
			.returning({ id: table.job.id });

		return { imported: newIds.length, matched: existingIds.size, jobId: String(job.id) };
	});
}
