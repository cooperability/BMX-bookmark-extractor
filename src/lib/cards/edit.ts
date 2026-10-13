// Rules the card editor and its server actions share, so the browser shows what
// the server will store.

/** Per field. A pasted page can be large, and Vercel refuses bodies over 4.5 MB. */
export const FIELD_MAX = 64 * 1024;
export const DECK_MAX = 200;
export const TAG_MAX = 100;
export const TAGS_PER_CARD = 50;
/** Cards one bulk action may touch: two pages of the browser, with room to spare. */
export const BULK_MAX = 500;

/** Anki's seven browser flags, in Anki's order. `cls` colours a swatch. */
export const FLAGS = [
	{ value: 1, label: 'Red', cls: 'bg-again' },
	{ value: 2, label: 'Orange', cls: 'bg-hard' },
	{ value: 3, label: 'Green', cls: 'bg-good' },
	{ value: 4, label: 'Blue', cls: 'bg-easy' },
	{ value: 5, label: 'Pink', cls: 'bg-flag-pink' },
	{ value: 6, label: 'Turquoise', cls: 'bg-flag-teal' },
	{ value: 7, label: 'Purple', cls: 'bg-flag-purple' }
] as const;

export const flagOf = (n: number) => FLAGS.find((f) => f.value === n) ?? null;

/**
 * Anki tags hold no whitespace, so whitespace separates two tags, as typing a
 * space does in Anki's tag editor. Duplicates collapse case-insensitively, first
 * spelling wins. Commas are kept: an imported tag may contain one.
 */
export function normalizeTags(raw: Iterable<string>): string[] {
	const out: string[] = [];
	const seen = new Set<string>();
	for (const r of raw) {
		for (const part of r.split(/\s+/)) {
			const tag = part.trim().slice(0, TAG_MAX);
			if (!tag || seen.has(tag.toLowerCase())) continue;
			seen.add(tag.toLowerCase());
			out.push(tag);
		}
	}
	return out.slice(0, TAGS_PER_CARD);
}

/** A deck name, or null when there is nothing left after trimming. `::` nests, as in Anki. */
export function normalizeDeck(raw: string): string | null {
	const deck = raw
		.split('::')
		.map((p) => p.trim().replace(/\s+/g, ' '))
		.filter(Boolean)
		.join('::')
		.slice(0, DECK_MAX);
	return deck || null;
}

/**
 * Where Save sends the user back to: a path on this site, or null. Anything that
 * could leave the origin (`//host`, `/\host`, a scheme) is refused.
 */
export function safeReturn(raw: string | null): string | null {
	if (!raw || !raw.startsWith('/') || raw.startsWith('//') || raw.startsWith('/\\')) return null;
	try {
		const u = new URL(raw, 'http://x.invalid');
		// Dot segments collapse: `/.//host` parses to the path `//host`.
		if (u.origin !== 'http://x.invalid' || u.pathname.startsWith('//')) return null;
		return `${u.pathname}${u.search}`;
	} catch {
		return null;
	}
}
