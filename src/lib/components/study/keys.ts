import { RATINGS } from './ratings';

/**
 * The study shortcut a keydown means: 'flip' for Space or Enter, a rating for 1-4,
 * or null. Enter and Space on a focused control belong to that control, so a
 * keyboard user who tabs to "Hard" or "← Decks" and presses Enter gets that, not
 * a flip that cancels the click.
 */
export function studyKey(e: KeyboardEvent): 'flip' | number | null {
	if (e.ctrlKey || e.metaKey || e.altKey) return null;
	const onControl =
		e.target instanceof Element && e.target.closest('button, a, input, select, textarea') !== null;
	if (e.key === ' ' || e.key === 'Enter') return onControl ? null : 'flip';
	return RATINGS.find((r) => r.key === e.key)?.value ?? null;
}
