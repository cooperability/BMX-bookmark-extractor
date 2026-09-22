import { and, asc, desc, eq, isNotNull, sql } from 'drizzle-orm';
import type { Grade } from 'ts-fsrs';
import { db } from '$lib/server/db';
import * as table from '$lib/server/db/schema';
import { parseAnkiExport } from '$lib/server/ingest/anki-tsv';
import { gradeRound } from './grading';
import { grade } from './scheduler';
import { selectRound } from './select';

export async function importDeck(userId: string, raw: string) {
	const { notes, warnings } = parseAnkiExport(raw, userId);
	const excluded = (col: string) => sql.raw(`excluded.${col}`);
	for (let i = 0; i < notes.length; i += 500) {
		await db
			.insert(table.node)
			.values(notes.slice(i, i + 500).map((n) => ({ ...n, userId })))
			.onConflictDoUpdate({
				target: table.node.id,
				set: {
					front: excluded('front'),
					back: excluded('back'),
					deck: excluded('deck'),
					tags: excluded('tags'),
					notetype: excluded('notetype')
				}
			});
	}
	return { imported: notes.length, warnings };
}

export async function listDecks(userId: string, now = new Date()) {
	const decks = await db
		.select({
			deck: table.node.deck,
			total: sql<number>`count(*)::int`,
			fresh: sql<number>`count(*) filter (where ${table.reviewState.nodeId} is null or ${table.reviewState.state} = 0)::int`,
			due: sql<number>`count(*) filter (where ${table.reviewState.state} != 0 and ${table.reviewState.due} <= ${now.toISOString()}::timestamptz)::int`
		})
		.from(table.node)
		.leftJoin(table.reviewState, eq(table.reviewState.nodeId, table.node.id))
		.where(and(eq(table.node.userId, userId), eq(table.node.kind, 'card')))
		.groupBy(table.node.deck)
		.orderBy(table.node.deck);

	const history = await db
		.select()
		.from(table.assessment)
		.where(and(eq(table.assessment.userId, userId), isNotNull(table.assessment.finishedAt)))
		.orderBy(desc(table.assessment.finishedAt));

	return decks.map((d) => ({ ...d, assessments: history.filter((a) => a.deck === d.deck) }));
}

async function latestAssessment(userId: string, deck: string) {
	const [a] = await db
		.select()
		.from(table.assessment)
		.where(
			and(
				eq(table.assessment.userId, userId),
				eq(table.assessment.deck, deck),
				isNotNull(table.assessment.finishedAt)
			)
		)
		.orderBy(desc(table.assessment.finishedAt))
		.limit(1);
	return a ?? null;
}

export async function startRound(userId: string, deck: string, now = new Date()) {
	const rows = await db
		.select({ node: table.node, review: table.reviewState })
		.from(table.node)
		.leftJoin(table.reviewState, eq(table.reviewState.nodeId, table.node.id))
		.where(
			and(eq(table.node.userId, userId), eq(table.node.deck, deck), eq(table.node.kind, 'card'))
		)
		.orderBy(asc(table.node.createdAt), asc(table.node.id));
	if (rows.length === 0) return null;

	const prior = await latestAssessment(userId, deck);
	const picked = selectRound(
		rows.map((r) => ({ id: r.node.id, tags: r.node.tags, review: r.review })),
		prior,
		now
	);
	const byId = new Map(rows.map((r) => [r.node.id, r.node]));

	const id = crypto.randomUUID();
	await db.insert(table.assessment).values({ id, userId, deck, cardCount: picked.length });

	return {
		assessmentId: id,
		prior: prior && { score: prior.score, weak: prior.weak, strong: prior.strong },
		cards: picked.map((p) => {
			const n = byId.get(p.id)!;
			return { id: n.id, front: n.front, back: n.back, tags: n.tags };
		})
	};
}

async function ownedOpenAssessment(userId: string, assessmentId: string) {
	const [a] = await db
		.select()
		.from(table.assessment)
		.where(and(eq(table.assessment.id, assessmentId), eq(table.assessment.userId, userId)));
	return a && !a.finishedAt ? a : null;
}

export async function recordGrade(
	userId: string,
	assessmentId: string,
	nodeId: string,
	rating: Grade,
	attempt: number,
	now = new Date()
): Promise<boolean> {
	const a = await ownedOpenAssessment(userId, assessmentId);
	if (!a) return false;
	const [row] = await db
		.select({ node: table.node, review: table.reviewState })
		.from(table.node)
		.leftJoin(table.reviewState, eq(table.reviewState.nodeId, table.node.id))
		.where(
			and(eq(table.node.id, nodeId), eq(table.node.userId, userId), eq(table.node.deck, a.deck))
		);
	if (!row) return false;

	const { next, elapsedDays } = grade(row.review, rating, now);
	await db.transaction(async (tx) => {
		// Log first: a duplicate attempt (a retried request) inserts nothing and must
		// not advance the schedule a second time.
		const logged = await tx
			.insert(table.reviewLog)
			.values({
				userId,
				nodeId,
				rating,
				elapsedDays,
				reviewedAt: now,
				surface: 'cards',
				assessmentId,
				attempt
			})
			.onConflictDoNothing()
			.returning({ id: table.reviewLog.id });
		if (logged.length === 0) return;
		await tx
			.insert(table.reviewState)
			.values({ nodeId, userId, ...next })
			.onConflictDoUpdate({ target: table.reviewState.nodeId, set: next });
	});
	return true;
}

/** Writes the grading artifact from each card's first attempt in the round. */
export async function finishRound(userId: string, assessmentId: string, now = new Date()) {
	const a = await ownedOpenAssessment(userId, assessmentId);
	if (!a) return null;

	const logs = await db
		.select({
			nodeId: table.reviewLog.nodeId,
			rating: table.reviewLog.rating,
			tags: table.node.tags
		})
		.from(table.reviewLog)
		.innerJoin(table.node, eq(table.node.id, table.reviewLog.nodeId))
		.where(and(eq(table.reviewLog.userId, userId), eq(table.reviewLog.assessmentId, assessmentId)))
		.orderBy(asc(table.reviewLog.id));

	const first = new Map<string, { tags: string[]; rating: number }>();
	for (const l of logs) if (!first.has(l.nodeId)) first.set(l.nodeId, l);

	const g = gradeRound([...first.values()]);
	await db
		.update(table.assessment)
		.set({ finishedAt: now, score: g.score, areas: g.areas, strong: g.strong, weak: g.weak })
		.where(eq(table.assessment.id, assessmentId));
	return g;
}
