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
