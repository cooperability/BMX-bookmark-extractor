import { and, asc, eq, gt, isNotNull, sql } from 'drizzle-orm';
// Relative, not $lib: the server vitest config has no SvelteKit alias, and the
// pure helpers below are unit tested against this module.
import { db } from '../db';
import * as table from '../db/schema';
import { classify, standingOf, STRONG_AT, UNTAGGED, WEAK_BELOW, type Standing } from './grading';

// Days are calendar days in the user's time zone (`tz`, an IANA name checked by
// toTimeZone). Every function defaults to UTC.
const DAY = 86_400_000;

const formats = new Map<string, Intl.DateTimeFormat>();

/** `YYYY-MM-DD` of the calendar day containing `d` in time zone `tz`. */
export function dayIn(d: Date, tz = 'UTC'): string {
	let f = formats.get(tz);
	if (!f) {
		// en-CA formats as YYYY-MM-DD.
		f = new Intl.DateTimeFormat('en-CA', {
			timeZone: tz,
			year: 'numeric',
			month: '2-digit',
			day: '2-digit'
		});
		formats.set(tz, f);
	}
	return f.format(d);
}

/** `YYYY-MM-DD` of the UTC day containing `d`. */
export const utcDay = (d: Date) => d.toISOString().slice(0, 10);

/** Calendar arithmetic on `YYYY-MM-DD`, independent of any time zone. */
export const addDays = (day: string, n: number) =>
	utcDay(new Date(Date.parse(`${day}T00:00:00Z`) + n * DAY));

const daysBetween = (from: string, to: string) =>
	Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY);

/**
 * Consecutive days with at least one review, ending today. A day with no
 * review yet today does not break the streak until the day ends, so the count
 * then ends at yesterday.
 */
export function streakDays(reviewDays: Iterable<string>, now: Date, tz = 'UTC'): number {
	const days = new Set(reviewDays);
	let day = dayIn(now, tz);
	if (!days.has(day)) day = addDays(day, -1);
	let n = 0;
	while (days.has(day)) {
		n += 1;
		day = addDays(day, -1);
	}
	return n;
}

export interface HeatCell {
	day: string;
	count: number;
	/** 0 = none, 1..4 = quartile of the busiest day in the window. */
	level: number;
}

/**
 * GitHub-style grid: `weeks` columns of Monday..Sunday, the last column holding
 * today. Days after today are null.
 */
export function heatmap(
	counts: Map<string, number>,
	now: Date,
	weeks = 12,
	tz = 'UTC'
): (HeatCell | null)[][] {
	const today = dayIn(now, tz);
	const weekday = (new Date(`${today}T00:00:00Z`).getUTCDay() + 6) % 7; // Monday = 0
	const start = addDays(today, -weekday - 7 * (weeks - 1));
	const days = Array.from({ length: weeks * 7 }, (_, i) => addDays(start, i));
	const max = Math.max(0, ...days.filter((d) => d <= today).map((d) => counts.get(d) ?? 0));
	return Array.from({ length: weeks }, (_, w) =>
		days.slice(w * 7, w * 7 + 7).map((day) => {
			if (day > today) return null;
			const count = counts.get(day) ?? 0;
			return { day, count, level: count === 0 ? 0 : Math.ceil((count / max) * 4) };
		})
	);
}

/**
 * Cards coming due per day for `days` days from today. Overdue cards count
 * toward today, since that is when they will be shown.
 */
export function dueForecast(dues: Date[], now: Date, days = 14, tz = 'UTC') {
	const today = dayIn(now, tz);
	const out = Array.from({ length: days }, (_, i) => ({ day: addDays(today, i), count: 0 }));
	for (const due of dues) {
		const i = Math.max(0, daysBetween(today, dayIn(due, tz)));
		if (i < days) out[i].count += 1;
	}
	return out;
}

export type Band = 'strong' | 'mid' | 'weak';

export const band = (score: number | null): Band | null =>
	score === null ? null : score >= STRONG_AT ? 'strong' : score < WEAK_BELOW ? 'weak' : 'mid';

export interface MasteryCard {
	tags: string[];
	/** Null when the card has never been graded. */
	stability: number | null;
}

export interface TagMastery {
	tag: string;
	cards: number;
	reviewed: number;
	/** Mean FSRS stability in days over reviewed cards, null if none. */
	stability: number | null;
	/** The tag's standing carried across rounds (see grading.ts), null if never measured. */
	score: number | null;
	/** The same call the next round's selection makes: weak, strong, or neither. */
	band: Band | null;
}

export function tagMastery(cards: MasteryCard[], standing: Standing[] | null): TagMastery[] {
	const acc = new Map<string, { cards: number; reviewed: number; sum: number }>();
	for (const c of cards) {
		for (const tag of c.tags.length ? c.tags : [UNTAGGED]) {
			const a = acc.get(tag) ?? { cards: 0, reviewed: 0, sum: 0 };
			a.cards += 1;
			if (c.stability !== null) {
				a.reviewed += 1;
				a.sum += c.stability;
			}
			acc.set(tag, a);
		}
	}
	const scores = new Map(
		(standing ?? []).filter((s) => s.cards > 0).map((s) => [s.tag, s.credit / s.cards])
	);
	const { strong, weak } = classify(standing ?? []);
	const bandOf = (tag: string): Band | null =>
		!scores.has(tag) ? null : weak.includes(tag) ? 'weak' : strong.includes(tag) ? 'strong' : 'mid';
	return [...acc]
		.map(([tag, a]) => ({
			tag,
			cards: a.cards,
			reviewed: a.reviewed,
			stability: a.reviewed ? a.sum / a.reviewed : null,
			score: scores.get(tag) ?? null,
			band: bandOf(tag)
		}))
		.sort((x, y) => y.cards - x.cards || x.tag.localeCompare(y.tag));
}

const isCard = eq(table.node.kind, 'card');

// A relearning repeat inside a round writes a second review_log row. Stats count
// the first attempt per (round, card) only, the same rule the round grade uses.
const firstAttempt = eq(table.reviewLog.attempt, 0);

async function dailyReviewCounts(userId: string, tz: string) {
	const day = sql<string>`to_char(${table.reviewLog.reviewedAt} at time zone ${tz}, 'YYYY-MM-DD')`;
	const rows = await db
		.select({ day, count: sql<number>`count(*)::int` })
		.from(table.reviewLog)
		.where(and(eq(table.reviewLog.userId, userId), firstAttempt))
		// By position: the day expression binds `tz` as a parameter, and a second copy
		// of it in GROUP BY would be a different parameter Postgres cannot match.
		.groupBy(sql`1`);
	return new Map(rows.map((r) => [r.day, r.count]));
}

/** Home page numbers plus the review heatmap. */
export async function overview(userId: string, now = new Date(), tz = 'UTC') {
	const [[cards], [ret], counts] = await Promise.all([
		db
			.select({
				total: sql<number>`count(*)::int`,
				due: sql<number>`count(*) filter (where ${table.reviewState.state} != 0 and ${table.reviewState.due} <= ${now.toISOString()}::timestamptz)::int`
			})
			.from(table.node)
			.leftJoin(table.reviewState, eq(table.reviewState.nodeId, table.node.id))
			.where(and(eq(table.node.userId, userId), isCard)),
		db
			.select({
				total: sql<number>`count(*)::int`,
				passed: sql<number>`count(*) filter (where ${table.reviewLog.rating} > 1)::int`
			})
			.from(table.reviewLog)
			.where(
				and(
					eq(table.reviewLog.userId, userId),
					gt(table.reviewLog.reviewedAt, new Date(now.getTime() - 30 * DAY)),
					firstAttempt,
					// Retention is recall of cards already learned. New cards and learning
					// steps fail by design and would drag the figure down.
					eq(table.reviewLog.state, 2)
				)
			),
		dailyReviewCounts(userId, tz)
	]);
	return {
		cardsTotal: cards.total,
		dueNow: cards.due,
		reviewedToday: counts.get(dayIn(now, tz)) ?? 0,
		streakDays: streakDays(counts.keys(), now, tz),
		retention30d: ret.total ? ret.passed / ret.total : null,
		reviews30d: ret.total,
		heatmap: heatmap(counts, now, 12, tz)
	};
}

/** Everything the deck page shows. Null when the user has no cards in `deck`. */
export async function deckDetail(userId: string, deck: string, now = new Date(), tz = 'UTC') {
	const inDeck = and(eq(table.node.userId, userId), eq(table.node.deck, deck), isCard);
	const [cards, history] = await Promise.all([
		db
			.select({
				tags: table.node.tags,
				state: table.reviewState.state,
				due: table.reviewState.due,
				stability: table.reviewState.stability
			})
			.from(table.node)
			.leftJoin(table.reviewState, eq(table.reviewState.nodeId, table.node.id))
			.where(inDeck),
		db
			.select()
			.from(table.assessment)
			.where(
				and(
					eq(table.assessment.userId, userId),
					eq(table.assessment.deck, deck),
					isNotNull(table.assessment.finishedAt)
				)
			)
			.orderBy(asc(table.assessment.finishedAt))
	]);
	if (cards.length === 0) return null;

	const seen = (c: (typeof cards)[number]) => c.state !== null && c.state !== 0;
	const latest = history.at(-1);
	return {
		total: cards.length,
		fresh: cards.filter((c) => !seen(c)).length,
		due: cards.filter((c) => seen(c) && c.due! <= now).length,
		forecast: dueForecast(
			cards.filter(seen).map((c) => c.due!),
			now,
			14,
			tz
		),
		mastery: tagMastery(
			cards.map((c) => ({ tags: c.tags, stability: seen(c) ? c.stability : null })),
			standingOf(latest ?? null)
		),
		history: history.map((a) => ({
			id: a.id,
			finishedAt: a.finishedAt!,
			cardCount: a.cardCount,
			score: a.score,
			strong: a.strong,
			weak: a.weak
		}))
	};
}
