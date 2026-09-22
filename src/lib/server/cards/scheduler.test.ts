import { describe, expect, it } from 'vitest';
import { grade, retrievability } from './scheduler';

const DAY = 86_400_000;
const now = new Date('2026-09-01T12:00:00Z');

const reviewCard = (at: Date) => ({
	stability: 5,
	difficulty: 5,
	due: at,
	reps: 5,
	lapses: 0,
	state: 2,
	learningSteps: 0,
	scheduledDays: 5,
	lastReview: new Date(at.getTime() - 5 * DAY)
});

describe('grade', () => {
	it('moves a new card rated Good out of state 0 and schedules it after now', () => {
		const { next } = grade(null, 3, now);
		expect(next.state).not.toBe(0);
		expect(next.due.getTime()).toBeGreaterThan(now.getTime());
		expect(next.reps).toBe(1);
	});

	it('increments lapses when a Review-state card is rated Again', () => {
		const { next } = grade(reviewCard(now), 1, now);
		expect(next.lapses).toBe(1);
		expect(next.state).toBe(3);
	});

	it('gives higher stability after Easy than after Again from the same state', () => {
		const easy = grade(reviewCard(now), 4, now).next.stability;
		const again = grade(reviewCard(now), 1, now).next.stability;
		expect(easy).toBeGreaterThan(again);
		expect(easy).toBeGreaterThan(5);
		expect(again).toBeLessThan(5);
	});

	it('reports elapsed days since the last review', () => {
		expect(grade(reviewCard(now), 3, now).elapsedDays).toBe(5);
	});
});

describe('retrievability', () => {
	it('is null for a missing or new card', () => {
		expect(retrievability(null, now)).toBeNull();
		expect(retrievability({ ...reviewCard(now), state: 0 }, now)).toBeNull();
	});

	it('is about 1 right after a review and decays over weeks', () => {
		const { next } = grade(reviewCard(now), 3, now);
		const r0 = retrievability(next, now)!;
		const r2w = retrievability(next, new Date(now.getTime() + 14 * DAY))!;
		const r6w = retrievability(next, new Date(now.getTime() + 42 * DAY))!;
		expect(r0).toBeGreaterThan(0.99);
		expect(r0).toBeLessThanOrEqual(1);
		expect(r2w).toBeLessThan(r0);
		expect(r6w).toBeLessThan(r2w);
		expect(r6w).toBeGreaterThan(0);
	});
});
