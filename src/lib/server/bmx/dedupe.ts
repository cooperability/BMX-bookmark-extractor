import { sha256 } from '@oslojs/crypto/sha2';
import { encodeHexLowerCase } from '@oslojs/encoding';

// Zero-width and BOM characters that make visually-identical text hash differently.
const ZERO_WIDTH = new RegExp('[\\u200B-\\u200D\\uFEFF]', 'g');

// Guards against empty/near-empty input colliding, not against metadata: 2109 of
// 3861 articles.csv title+description pairs are already >=200 chars (median 207),
// so "some text" is not proof of full-tier body copy — a 200-char floor would still
// let unrelated stories collide on shared paywall/cookie-notice boilerplate (roughly
// 200-300 chars). 500 sits above that boilerplate. The actual guard against hashing
// metadata is contractual: only full-tier extracted article text should ever reach
// this function, never a title or description.
const MIN_CONTENT_LENGTH = 500;

/**
 * Content hash for cross-domain duplicate detection (`harvests.content_hash`):
 * the same story reaches the corpus via `apple.news` and the publisher, with
 * whitespace, case, and Unicode normalization form differing between the two
 * extractions. NFKC-normalizing, stripping zero-width characters, collapsing
 * whitespace, and lowercasing before hashing makes those two collide.
 *
 * Only full-tier extracted article text should be passed in here, never a
 * title or description. Text shorter than the metadata floor returns null, so
 * two short or empty inputs never collide as false duplicates.
 */
export function contentHash(text: string): string | null {
	const normalized = text
		.normalize('NFKC')
		.replace(ZERO_WIDTH, '')
		.replace(/\s+/g, ' ')
		.trim()
		.toLowerCase();
	if (normalized.length < MIN_CONTENT_LENGTH) return null;
	return encodeHexLowerCase(sha256(new TextEncoder().encode(normalized)));
}

export type DuplicateReason = 'url' | 'content' | null;

export interface HarvestCandidate {
	urlNormalized: string;
	contentHash: string | null;
}

/**
 * Which rule, if any, marks `candidate` as a duplicate of something already
 * harvested. URL match is checked first since it's the cheaper, more certain
 * signal; content match catches the same story reached by a different URL. A
 * null content hash (too short, or not full-tier) never matches anything.
 */
export function findDuplicate(
	candidate: HarvestCandidate,
	existing: Iterable<HarvestCandidate>
): DuplicateReason {
	let contentMatch = false;
	for (const row of existing) {
		if (row.urlNormalized === candidate.urlNormalized) return 'url';
		if (candidate.contentHash !== null && row.contentHash === candidate.contentHash) {
			contentMatch = true;
		}
	}
	return contentMatch ? 'content' : null;
}
