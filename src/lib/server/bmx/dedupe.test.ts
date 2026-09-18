import { describe, expect, it } from 'vitest';
import { contentHash, findDuplicate, type HarvestCandidate } from './dedupe';

// Real full-tier extraction is always well over the 500-char floor; these fixtures
// repeat a sentence to land safely above it without the tests being about length.
const ARTICLE =
	'Full extracted article body text that is long enough to be treated as real content rather than metadata. '.repeat(
		5
	);

// ~277 chars: representative of paywall/cookie-notice boilerplate, well below the
// 500-char floor but above what a 200-char floor would have let through.
const PAYWALL_BOILERPLATE =
	'To continue reading this article, please subscribe. Already a subscriber? Log in. This content is available only to subscribers who have an active account in good standing with full access privileges granted upon successful payment verification and identity confirmation steps.';

describe('contentHash', () => {
	it('collides on whitespace-only differences', () => {
		expect(contentHash(ARTICLE.replace(/ /g, '   '))).toBe(contentHash(ARTICLE));
		expect(contentHash(ARTICLE.replace(/ /g, '\n'))).toBe(contentHash(ARTICLE));
		expect(contentHash(`  ${ARTICLE}  `)).toBe(contentHash(ARTICLE));
	});

	it('collides on case-only differences', () => {
		expect(contentHash(ARTICLE.toUpperCase())).toBe(contentHash(ARTICLE));
	});

	it('collides on Unicode normalization form (NFC vs NFD é)', () => {
		const nfc = `${ARTICLE}café`; // é as U+00E9
		const nfd = `${ARTICLE}café`; // e + combining acute U+0301
		expect(contentHash(nfc)).toBe(contentHash(nfd));
	});

	it('collides across zero-width characters', () => {
		const zeroWidthSpace = String.fromCharCode(0x200b);
		const withZeroWidth = `${ARTICLE.slice(0, 10)}${zeroWidthSpace}${ARTICLE.slice(10)}`;
		expect(contentHash(withZeroWidth)).toBe(contentHash(ARTICLE));
	});

	it('does not collide on different text', () => {
		expect(contentHash(ARTICLE)).not.toBe(contentHash(ARTICLE.replace('Full', 'Empty')));
	});

	it('is deterministic', () => {
		expect(contentHash(ARTICLE)).toBe(contentHash(ARTICLE));
	});

	it('returns null for empty text', () => {
		expect(contentHash('')).toBeNull();
	});

	it('returns null for whitespace-only text', () => {
		expect(contentHash('  \n')).toBeNull();
	});

	it('returns null for text under the metadata floor', () => {
		expect(contentHash('short text, not an article')).toBeNull();
	});

	// A 200-char floor would have let this collide unrelated stories that share
	// boilerplate; 500 does not.
	it('returns null for ~300-char paywall-style boilerplate', () => {
		expect(PAYWALL_BOILERPLATE.length).toBeLessThan(500);
		expect(contentHash(PAYWALL_BOILERPLATE)).toBeNull();
	});

	// Blocker: 93 apple.news rows in articles.csv share this exact title +
	// description. Hashing metadata (instead of full-tier body text) would
	// collapse 92 distinct stories into one false duplicate.
	it('returns null for the literal Apple News placeholder metadata', () => {
		expect(contentHash('Apple News An Article in Apple News')).toBeNull();
	});
});

describe('findDuplicate', () => {
	const existing: HarvestCandidate[] = [
		{ urlNormalized: 'https://example.com/a', contentHash: 'hash-a' },
		{ urlNormalized: 'https://example.com/b', contentHash: 'hash-b' }
	];

	it('reports "url" when the normalized URL already exists', () => {
		const candidate: HarvestCandidate = {
			urlNormalized: 'https://example.com/a',
			contentHash: 'hash-different'
		};
		expect(findDuplicate(candidate, existing)).toBe('url');
	});

	it('reports "content" when the URL is new but the content hash matches (apple.news vs publisher)', () => {
		const candidate: HarvestCandidate = {
			urlNormalized: 'https://apple.news/xyz',
			contentHash: 'hash-a'
		};
		expect(findDuplicate(candidate, existing)).toBe('content');
	});

	it('reports null when neither URL nor content hash matches', () => {
		const candidate: HarvestCandidate = {
			urlNormalized: 'https://example.com/c',
			contentHash: 'hash-c'
		};
		expect(findDuplicate(candidate, existing)).toBeNull();
	});

	it('reports null against an empty existing set', () => {
		const candidate: HarvestCandidate = {
			urlNormalized: 'https://example.com/a',
			contentHash: 'hash-a'
		};
		expect(findDuplicate(candidate, [])).toBeNull();
	});

	it('a null content hash never matches another null content hash', () => {
		const rows: HarvestCandidate[] = [
			{ urlNormalized: 'https://example.com/z', contentHash: null }
		];
		const candidate: HarvestCandidate = {
			urlNormalized: 'https://example.com/y',
			contentHash: null
		};
		expect(findDuplicate(candidate, rows)).toBeNull();
	});

	it('prefers "url" over "content" when both would match', () => {
		const candidate: HarvestCandidate = {
			urlNormalized: 'https://example.com/a',
			contentHash: 'hash-b'
		};
		expect(findDuplicate(candidate, existing)).toBe('url');
	});

	// Blocker: contentHash('') === contentHash('  \n') would previously match as
	// 'content', flagging two unrelated URLs with unextracted text as duplicates.
	it('two candidates with unhashable (empty/whitespace) text are never flagged as content dupes', () => {
		const rows: HarvestCandidate[] = [
			{ urlNormalized: 'https://example.com/a', contentHash: contentHash('') }
		];
		const candidate: HarvestCandidate = {
			urlNormalized: 'https://example.com/b',
			contentHash: contentHash('  \n')
		};
		expect(findDuplicate(candidate, rows)).toBeNull();
	});

	it('apple.news placeholder metadata does not create a false content dupe', () => {
		const metaHash = contentHash('Apple News An Article in Apple News');
		expect(metaHash).toBeNull();
		const rows: HarvestCandidate[] = [
			{ urlNormalized: 'https://apple.news/1', contentHash: metaHash }
		];
		const candidate: HarvestCandidate = {
			urlNormalized: 'https://apple.news/2',
			contentHash: contentHash('Apple News An Article in Apple News')
		};
		expect(findDuplicate(candidate, rows)).toBeNull();
	});
});
