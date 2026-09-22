// Shared by the study page and the server, so both agree on how a round replays.

// Anki-style relearning inside a round: a missed card comes back at the end, at
// most this many times. Only the first attempt is graded.
export const MAX_REPEATS = 2;

export interface QueueItem<C> {
	card: C;
	/** 0 for the first try, n for the nth relearning repeat. */
	repeats: number;
}

/**
 * Rebuild a round's queue from the ratings already logged, so a reload resumes
 * where it stopped instead of starting over. `progress` maps a card id to its
 * ratings in attempt order. Cards not yet tried keep their serving order; missed
 * cards still owed a repeat follow, as they would have in the live queue.
 */
export function resumeQueue<C extends { id: string }>(
	cards: C[],
	progress: Record<string, number[]>
): { queue: QueueItem<C>[]; done: number } {
	const untried: QueueItem<C>[] = [];
	const owed: QueueItem<C>[] = [];
	let done = 0;
	for (const card of cards) {
		const ratings = progress[card.id] ?? [];
		if (ratings.length === 0) {
			untried.push({ card, repeats: 0 });
			continue;
		}
		done += 1;
		if (ratings.at(-1) === 1 && ratings.length <= MAX_REPEATS) {
			owed.push({ card, repeats: ratings.length });
		}
	}
	return { queue: [...untried, ...owed], done };
}
