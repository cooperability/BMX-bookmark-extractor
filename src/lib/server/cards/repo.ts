import { and, asc, desc, eq, isNotNull, isNull, sql } from 'drizzle-orm';
import type { Grade } from 'ts-fsrs';
import { db } from '$lib/server/db';
import * as table from '$lib/server/db/schema';
import { parseAnkiExport } from '$lib/server/ingest/anki-tsv';
import { classify, gradeRound, mergeStanding, standingOf } from './grading';
import { grade } from './scheduler';
import { NEW_PER_DAY, ROUND_SIZE, selectRound } from './select';

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

// An unfinished round this recent is resumed on the next visit. Older ones are
// closed: graded if they hold any grades, deleted if they hold none.
const RESUME_WITHIN_MS = 12 * 60 * 60 * 1000;

/** Ratings logged so far in a round, per card, in attempt order. */
async function roundProgress(userId: string, assessmentId: string) {
	const logs = await db
		.select({ nodeId: table.reviewLog.nodeId, rating: table.reviewLog.rating })
		.from(table.reviewLog)
		.where(and(eq(table.reviewLog.userId, userId), eq(table.reviewLog.assessmentId, assessmentId)))
		.orderBy(asc(table.reviewLog.id));
	const progress: Record<string, number[]> = {};
	for (const l of logs) (progress[l.nodeId] ??= []).push(l.rating);
	return progress;
}

/**
 * Open the study round for a deck: the unfinished one if it is recent, else a new
 * one. Loading the study page calls this, so it must be safe to repeat: a reload,
 * a second tab, or a link preload lands on the same round rather than opening
 * another and dropping the progress of the first.
 */
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
	const byId = new Map(rows.map((r) => [r.node.id, r.node]));
	const toCard = (id: string) => {
		const n = byId.get(id)!;
		return { id: n.id, front: n.front, back: n.back, tags: n.tags };
	};

	const open = await db
		.select()
		.from(table.assessment)
		.where(
			and(
				eq(table.assessment.userId, userId),
				eq(table.assessment.deck, deck),
				isNull(table.assessment.finishedAt)
			)
		)
		.orderBy(desc(table.assessment.startedAt));
	for (const a of open) {
		const fresh = now.getTime() - a.startedAt.getTime() < RESUME_WITHIN_MS;
		// A card deleted by a re-import since the round opened is dropped from it.
		const cardIds = a.cardIds.filter((id) => byId.has(id));
		if (fresh && cardIds.length > 0) {
			const prior = await latestAssessment(userId, deck);
			return {
				assessmentId: a.id,
				prior: prior && { score: prior.score, weak: prior.weak, strong: prior.strong },
				cards: cardIds.map(toCard),
				progress: await roundProgress(userId, a.id)
			};
		}
		await closeStaleRound(userId, a.id);
	}

	const prior = await latestAssessment(userId, deck);
	const picked = selectRound(
		rows.map((r) => ({ id: r.node.id, tags: r.node.tags, review: r.review })),
		prior,
		now,
		ROUND_SIZE,
		NEW_PER_DAY - (await introducedToday(userId, deck, now))
	);
	if (picked.length === 0) return null;

	const id = crypto.randomUUID();
	const cardIds = picked.map((p) => p.id);
	await db
		.insert(table.assessment)
		.values({ id, userId, deck, cardCount: cardIds.length, cardIds, startedAt: now });

	return {
		assessmentId: id,
		prior: prior && { score: prior.score, weak: prior.weak, strong: prior.strong },
		cards: cardIds.map(toCard),
		progress: {} as Record<string, number[]>
	};
}

/** Cards in the deck whose first ever review fell on the current UTC day. */
async function introducedToday(userId: string, deck: string, now: Date) {
	const dayStart = `${now.toISOString().slice(0, 10)}T00:00:00Z`;
	const [{ n }] = await db
		.select({ n: sql<number>`count(distinct ${table.reviewLog.nodeId})::int` })
		.from(table.reviewLog)
		.innerJoin(table.node, eq(table.node.id, table.reviewLog.nodeId))
		.where(
			and(
				eq(table.reviewLog.userId, userId),
				eq(table.reviewLog.state, 0),
				sql`${table.reviewLog.reviewedAt} >= ${dayStart}::timestamptz`,
				eq(table.node.deck, deck)
			)
		);
	return n;
}

/** Grade an abandoned round on what it has, or delete it if nothing was graded. */
async function closeStaleRound(userId: string, assessmentId: string) {
	const [last] = await db
		.select({ at: table.reviewLog.reviewedAt })
		.from(table.reviewLog)
		.where(and(eq(table.reviewLog.userId, userId), eq(table.reviewLog.assessmentId, assessmentId)))
		.orderBy(desc(table.reviewLog.reviewedAt))
		.limit(1);
	if (last) await finishRound(userId, assessmentId, last.at);
	else
		await db
			.delete(table.assessment)
			.where(and(eq(table.assessment.id, assessmentId), eq(table.assessment.userId, userId)));
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
	now = new Date()
): Promise<boolean> {
	const a = await ownedOpenAssessment(userId, assessmentId);
	if (!a || !a.cardIds.includes(nodeId)) return false;
	const [row] = await db
		.select({ node: table.node, review: table.reviewState })
		.from(table.node)
		.leftJoin(table.reviewState, eq(table.reviewState.nodeId, table.node.id))
		.where(
			and(eq(table.node.id, nodeId), eq(table.node.userId, userId), eq(table.node.deck, a.deck))
		);
	if (!row) return false;

	const { next, elapsedDays, priorState } = grade(row.review, rating, now);
	await db.transaction(async (tx) => {
		await tx
			.insert(table.reviewState)
			.values({ nodeId, userId, ...next })
			.onConflictDoUpdate({ target: table.reviewState.nodeId, set: next });
		await tx.insert(table.reviewLog).values({
			userId,
			nodeId,
			rating,
			state: priorState,
			elapsedDays,
			reviewedAt: now,
			surface: 'cards',
			assessmentId
		});
	});
	return true;
}

/**
 * Writes the grading artifact. The score and areas come from each card's first
 * attempt in this round; weak and strong come from the standing carried forward
 * from the deck's previous round plus this one.
 */
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

	const round = gradeRound([...first.values()]);
	const standing = mergeStanding(standingOf(await latestAssessment(userId, a.deck)), round.areas);
	const g = { ...round, ...classify(standing) };
	await db
		.update(table.assessment)
		.set({
			finishedAt: now,
			score: g.score,
			areas: g.areas,
			standing,
			strong: g.strong,
			weak: g.weak
		})
		.where(eq(table.assessment.id, assessmentId));
	return g;
}
