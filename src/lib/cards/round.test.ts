import { describe, expect, it } from 'vitest';
import { MAX_REPEATS, resumeQueue } from './round';

const cards = ['a', 'b', 'c', 'd'].map((id) => ({ id }));
const ids = (q: { card: { id: string }; repeats: number }[]) =>
	q.map((x) => `${x.card.id}${x.repeats}`);

describe('resumeQueue', () => {
	it('serves every card in order when nothing is logged', () => {
		const r = resumeQueue(cards, {});
		expect(ids(r.queue)).toEqual(['a0', 'b0', 'c0', 'd0']);
		expect(r.done).toBe(0);
	});

	it('drops passed cards and re-queues a miss behind the untried cards', () => {
		const r = resumeQueue(cards, { a: [3], b: [1] });
		expect(ids(r.queue)).toEqual(['c0', 'd0', 'b1']);
		expect(r.done).toBe(2);
	});

	it('stops re-queueing a card after MAX_REPEATS misses', () => {
		const misses = Array.from({ length: MAX_REPEATS + 1 }, () => 1);
		expect(ids(resumeQueue(cards, { a: misses.slice(0, MAX_REPEATS) }).queue)).toContain(
			`a${MAX_REPEATS}`
		);
		expect(resumeQueue(cards, { a: misses }).queue.some((x) => x.card.id === 'a')).toBe(false);
	});

	it('treats a relearned card that passed as finished', () => {
		const r = resumeQueue(cards, { a: [1, 3] });
		expect(r.queue.some((x) => x.card.id === 'a')).toBe(false);
		expect(r.done).toBe(1);
	});

	it('returns an empty queue when every card is finished', () => {
		const r = resumeQueue(cards, { a: [3], b: [4], c: [2], d: [1, 1, 1] });
		expect(r.queue).toEqual([]);
		expect(r.done).toBe(4);
	});
});
