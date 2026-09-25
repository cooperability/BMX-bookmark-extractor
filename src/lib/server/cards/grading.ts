import { MIN_CARDS_FOR_STRONG, STRONG_AT, WEAK_BELOW, type AreaScore } from '$lib/cards/grading';

// Grading one round is pure and also runs in the browser (the landing page demo).
export * from '$lib/cards/grading';

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
