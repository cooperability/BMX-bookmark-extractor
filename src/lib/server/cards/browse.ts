import { and, asc, count, desc, eq, ilike, isNull, or, sql, type SQL } from 'drizzle-orm';
// Relative, not $lib: the server vitest config has no SvelteKit alias.
import { db } from '../db';
import * as table from '../db/schema';

export const PAGE_SIZE = 50;
export const PREVIEW_CHARS = 140;
const MAX_QUERY = 200;
const DAY = 86_400_000;

export const STATES = ['new', 'learning', 'review', 'relearning'] as const;
export type CardState = (typeof STATES)[number];
export const SORTS = ['due', 'stability', 'lapses', 'recent'] as const;
export type Sort = (typeof SORTS)[number];

export interface BrowseParams {
	q: string;
	tag: string | null;
	state: CardState | null;
	sort: Sort;
	page: number;
}

const oneOf = <T extends string>(list: readonly T[], v: string | null): T | null =>
	list.includes(v as T) ? (v as T) : null;

/** Reads the browser's URL params. Anything unrecognised falls back to the default. */
export function parseBrowseParams(sp: URLSearchParams): BrowseParams {
	const page = Number.parseInt(sp.get('page') ?? '', 10);
	return {
		q: (sp.get('q') ?? '').trim().slice(0, MAX_QUERY),
		tag: sp.get('tag') || null,
		state: oneOf(STATES, sp.get('state')),
		sort: oneOf(SORTS, sp.get('sort')) ?? 'due',
		page: Number.isFinite(page) && page > 1 ? page : 1
	};
}

/** Escapes LIKE wildcards so user input matches literally (Postgres' default escape is `\`). */
export const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

const ENTITIES: Record<string, string> = {
	amp: '&',
	lt: '<',
	gt: '>',
	quot: '"',
	apos: "'",
	nbsp: ' '
};

/** Card HTML to a single line of plain text, cut at `max` characters. */
export function plainText(html: string, max = PREVIEW_CHARS): string {
	const text = html
		.replace(/<(script|style)\b[\s\S]*?<\/\1\s*>/gi, ' ')
		.replace(/<[^>]*>/g, ' ')
		.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
			if (e[0] !== '#') return ENTITIES[e.toLowerCase()] ?? m;
			const code = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1));
			return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : m;
		})
		.replace(/\s+/g, ' ')
		.trim();
	return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

/** "new", "in 3d", "overdue 2d"; hours and minutes below a day. */
export function dueLabel(state: CardState, due: Date | null, now: Date): string {
	if (state === 'new' || !due) return 'new';
	const ms = due.getTime() - now.getTime();
	const abs = Math.abs(ms);
	const span =
		abs >= DAY
			? `${Math.floor(abs / DAY)}d`
			: abs >= 3_600_000
				? `${Math.floor(abs / 3_600_000)}h`
				: `${Math.max(1, Math.floor(abs / 60_000))}m`;
	return ms > 0 ? `in ${span}` : `overdue ${span}`;
}

export const stateName = (state: number | null): CardState => STATES[state ?? 0] ?? 'new';

export async function browseCards(userId: string, deck: string, p: BrowseParams, now = new Date()) {
	const n = table.node;
	const rs = table.reviewState;
	const rl = table.reviewLog;
	const isNew = or(isNull(rs.nodeId), eq(rs.state, 0))!;
	const pattern = `%${escapeLike(p.q)}%`;
	const inDeck = and(eq(n.userId, userId), eq(n.deck, deck), eq(n.kind, 'card'));
	// Match visible text only: raw fields are HTML, and "div" or "nbsp" hit most cards.
	const visible = (col: typeof n.front | typeof n.back) =>
		sql`regexp_replace(regexp_replace(${col}, '<[^>]*>', ' ', 'g'), '&[a-z0-9#]+;', ' ', 'gi')`;
	const where = and(
		inDeck,
		p.q ? or(ilike(visible(n.front), pattern), ilike(visible(n.back), pattern)) : undefined,
		p.tag ? sql`${p.tag} = any(${n.tags})` : undefined,
		p.state === null ? undefined : p.state === 'new' ? isNew : eq(rs.state, STATES.indexOf(p.state))
	);
	const joined = and(eq(rs.nodeId, n.id), eq(rs.userId, userId));

	// New cards have no meaningful due date or stability, so they sink in every sort.
	const newLast = sql`(${isNew})`;
	const ORDER: Record<Sort, SQL[]> = {
		due: [asc(newLast), asc(rs.due)],
		stability: [asc(newLast), asc(rs.stability)],
		lapses: [desc(sql`coalesce(${rs.lapses}, 0)`), asc(newLast), asc(rs.due)],
		recent: [sql`${rs.lastReview} desc nulls last`]
	};

	const [[{ total }], tagRows] = await Promise.all([
		db.select({ total: count() }).from(n).leftJoin(rs, joined).where(where),
		db
			.selectDistinct({ tag: sql<string>`unnest(${n.tags})` })
			.from(n)
			.where(inDeck)
	]);
	const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
	const page = Math.min(p.page, pages);

	const rows = await db
		.select({
			id: n.id,
			front: n.front,
			back: n.back,
			tags: n.tags,
			state: rs.state,
			due: rs.due,
			stability: rs.stability,
			difficulty: rs.difficulty,
			reps: rs.reps,
			lapses: rs.lapses,
			lastRating: sql<number | null>`(
				select ${rl.rating} from ${rl}
				where ${rl.userId} = ${userId} and ${rl.nodeId} = ${n.id}
				order by ${rl.reviewedAt} desc, ${rl.id} desc limit 1
			)`
		})
		.from(n)
		.leftJoin(rs, joined)
		.where(where)
		.orderBy(...ORDER[p.sort], asc(n.id))
		.limit(PAGE_SIZE)
		.offset((page - 1) * PAGE_SIZE);

	return {
		params: { ...p, page },
		total,
		pages,
		pageSize: PAGE_SIZE,
		tags: tagRows.map((r) => r.tag).sort((a, b) => a.localeCompare(b)),
		cards: rows.map((r) => {
			const state = stateName(r.state);
			const seen = state !== 'new';
			return {
				id: r.id,
				front: plainText(r.front),
				back: plainText(r.back, 400),
				tags: r.tags,
				state,
				due: dueLabel(state, r.due, now),
				overdue: seen && r.due !== null && r.due <= now,
				stability: seen ? r.stability : null,
				difficulty: seen ? r.difficulty : null,
				reps: r.reps ?? 0,
				lapses: r.lapses ?? 0,
				lastRating: r.lastRating
			};
		})
	};
}

export type Browse = Awaited<ReturnType<typeof browseCards>>;
