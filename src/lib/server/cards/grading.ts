export const UNTAGGED = '(untagged)';

/** Credit per rating. Hard is a recall, but a costly one. */
const CREDIT: Record<number, number> = { 1: 0, 2: 0.5, 3: 1, 4: 1 };

// A tag needs this many cards in a round before it can be called strong. One
// lucky card is not mastery. A single miss is enough to call it weak, because
// the cost of an extra drill is lower than the cost of a hidden gap.
export const MIN_CARDS_FOR_STRONG = 2;
export const STRONG_AT = 0.85;
export const WEAK_BELOW = 0.6;

export interface GradedCard {
	tags: string[];
	/** First attempt in the round only. Re-queued repeats never reach the grade. */
	rating: number;
}

export interface AreaScore {
	tag: string;
	cards: number;
	again: number;
	score: number; // 0..1
}

export interface Grades {
	score: number | null;
	areas: AreaScore[];
	strong: string[];
	weak: string[];
}

export function areasOf(tags: string[]): string[] {
	return tags.length ? tags : [UNTAGGED];
}

export function gradeRound(cards: GradedCard[]): Grades {
	if (cards.length === 0) return { score: null, areas: [], strong: [], weak: [] };

	const byTag = new Map<string, { cards: number; again: number; credit: number }>();
	let total = 0;
	for (const c of cards) {
		const credit = CREDIT[c.rating] ?? 0;
		total += credit;
		for (const tag of areasOf(c.tags)) {
			const a = byTag.get(tag) ?? { cards: 0, again: 0, credit: 0 };
			a.cards += 1;
			a.credit += credit;
			if (c.rating === 1) a.again += 1;
			byTag.set(tag, a);
		}
	}

	const areas = [...byTag]
		.map(([tag, a]) => ({ tag, cards: a.cards, again: a.again, score: a.credit / a.cards }))
		.sort((x, y) => x.score - y.score || y.cards - x.cards || x.tag.localeCompare(y.tag));

	return {
		score: total / cards.length,
		areas,
		strong: areas
			.filter((a) => a.cards >= MIN_CARDS_FOR_STRONG && a.score >= STRONG_AT)
			.map((a) => a.tag),
		weak: areas.filter((a) => a.score < WEAK_BELOW).map((a) => a.tag)
	};
}

/**
 * What the grader believes about one tag, carried from round to round. `cards`
 * and `credit` are evidence weights: each round that measures the tag keeps 3/4 of
 * the old evidence and adds its own, and a round that does not measure it leaves it
 * alone.
 *
 * One round alone is too thin to call a tag weak or strong. Anki cards carry
 * several tags and a 20-card round spreads over dozens of them, so most tags get
 * one card per round: a single miss would flag every tag on that card, and a tag
 * the next round skipped would lose its flag without being re-tested.
 */
export interface Standing {
	tag: string;
	cards: number;
	credit: number;
}

// With one card per round, evidence tends to 1 / (1 - decay) cards. It must clear
// MIN_CARDS_FOR_STRONG, or a tag sampled once a round could never become strong.
export const STANDING_DECAY = 0.75;

export function mergeStanding(
	prior: Standing[],
	round: AreaScore[],
	decay = STANDING_DECAY
): Standing[] {
	const out = new Map(prior.map((s) => [s.tag, s]));
	for (const a of round) {
		const p = out.get(a.tag);
		out.set(a.tag, {
			tag: a.tag,
			cards: (p?.cards ?? 0) * decay + a.cards,
			credit: (p?.credit ?? 0) * decay + a.score * a.cards
		});
	}
	return [...out.values()].sort((x, y) => x.tag.localeCompare(y.tag));
}

/** Weak tags weakest first, strong tags strongest first. */
export function classify(standing: Standing[]): { strong: string[]; weak: string[] } {
	const scored = standing
		.filter((s) => s.cards > 0)
		.map((s) => ({ ...s, score: s.credit / s.cards }))
		.sort((x, y) => x.score - y.score || x.tag.localeCompare(y.tag));
	return {
		strong: scored
			.filter((s) => s.cards >= MIN_CARDS_FOR_STRONG && s.score >= STRONG_AT)
			.reverse()
			.map((s) => s.tag),
		weak: scored.filter((s) => s.score < WEAK_BELOW).map((s) => s.tag)
	};
}

/** Standing before the first round that stored one: that round's own areas. */
export function standingOf(a: { standing: unknown; areas: unknown } | null): Standing[] {
	if (!a) return [];
	if (Array.isArray(a.standing)) return a.standing as Standing[];
	return mergeStanding([], (a.areas as AreaScore[] | null) ?? []);
}
