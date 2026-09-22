import { readFileSync } from 'node:fs';
import { parse } from 'csv-parse/sync';
import { describe, expect, it } from 'vitest';
import { normalizeUrl } from './normalize-url';

describe('table: accepted rewrites', () => {
	const cases: Array<[string, string, string]> = [
		['lowercases scheme and host', 'HTTP://Example.COM/Path', 'http://example.com/Path'],
		['strips default http port', 'http://example.com:80/foo', 'http://example.com/foo'],
		['strips default https port', 'https://example.com:443/foo', 'https://example.com/foo'],
		['keeps a non-default port', 'https://example.com:8443/foo', 'https://example.com:8443/foo'],
		['drops the fragment', 'https://example.com/foo#section', 'https://example.com/foo'],
		['strips userinfo credentials', 'https://user:pass@example.com/a', 'https://example.com/a'],
		[
			'drops utm_* params',
			'https://example.com/a?utm_source=x&utm_medium=y&id=1',
			'https://example.com/a?id=1'
		],
		['drops fbclid', 'https://example.com/a?fbclid=abc&id=1', 'https://example.com/a?id=1'],
		['drops gclid', 'https://example.com/a?gclid=abc&id=1', 'https://example.com/a?id=1'],
		[
			'drops mc_cid and mc_eid',
			'https://example.com/a?mc_cid=1&mc_eid=2&id=1',
			'https://example.com/a?id=1'
		],
		[
			'drops tracking params case-insensitively',
			'https://example.com/a?UTM_Source=x&b=2',
			'https://example.com/a?b=2'
		],
		[
			'drops a percent-encoded tracking key (utm%5Fsource decodes to utm_source)',
			'https://example.com/a?utm%5Fsource=x&b=2',
			'https://example.com/a?b=2'
		],
		[
			'keeps non-tracking params in original order',
			'https://example.com/a?b=2&a=1&utm_source=x',
			'https://example.com/a?b=2&a=1'
		],
		[
			'strips trailing slash on non-root path',
			'https://example.com/foo/',
			'https://example.com/foo'
		],
		['keeps root path slash', 'https://example.com/', 'https://example.com/'],
		[
			'keeps www (not stripped, see decision note below)',
			'https://www.example.com/a',
			'https://www.example.com/a'
		]
	];

	it.each(cases)('%s', (_label, input, expected) => {
		expect(normalizeUrl(input)).toBe(expected);
	});
});

// URLSearchParams re-encodes every kept param on serialization, not just the
// dropped ones, so the kept query string must come from the raw, unparsed bytes.
describe('table: kept query bytes are preserved exactly', () => {
	const cases: Array<[string, string, string]> = [
		[
			'percent-encoded space stays %20, not +',
			'https://example.com/a?a=b%20c',
			'https://example.com/a?a=b%20c'
		],
		['a bare flag keeps no trailing =', 'https://example.com/a?flag', 'https://example.com/a?flag'],
		['tilde stays unescaped', 'https://example.com/a?q=~', 'https://example.com/a?q=~'],
		[
			'unescaped slash in a value stays unescaped',
			'https://example.com/a?b=/',
			'https://example.com/a?b=/'
		],
		[
			'malformed percent-encoding is left untouched',
			'https://example.com/a?a=%zz',
			'https://example.com/a?a=%zz'
		]
	];

	it.each(cases)('%s', (_label, input, expected) => {
		expect(normalizeUrl(input)).toBe(expected);
	});
});

describe('table: rejects', () => {
	const cases: Array<[string, string]> = [
		['javascript: scheme', 'javascript:alert(1)'],
		['data: scheme', 'data:text/plain;base64,aGVsbG8='],
		['ftp: scheme', 'ftp://example.com/file'],
		['garbage, not a URL', 'not a url'],
		['empty string', '']
	];

	it.each(cases)('rejects %s', (_label, input) => {
		expect(normalizeUrl(input)).toBeNull();
	});

	it('never throws on malformed input', () => {
		expect(() => normalizeUrl('http://')).not.toThrow();
		expect(() => normalizeUrl('::::')).not.toThrow();
	});
});

describe('runtime type guard', () => {
	it('rejects a non-string input (array) instead of stringifying it', () => {
		// An array whose lone element is a valid URL stringifies to that URL via
		// Array.prototype.toString, which `new URL()` would happily accept — the
		// guard has to run before that coercion, not rely on the constructor to throw.
		expect(normalizeUrl(['http://example.com'] as unknown as string)).toBeNull();
	});

	it('rejects undefined instead of throwing', () => {
		expect(normalizeUrl(undefined as unknown as string)).toBeNull();
	});
});

// Decision note: TDD §6's diagram text is "strip utm_* · fragment · trailing /"
// and the schema.ts comment on url_normalized says only "utm stripped, no
// fragment" — neither mentions a leading "www." A distinct host merge (e.g.
// www.example.com vs example.com) is exactly the kind of collision the dedupe
// story (apple.news vs the publisher) does NOT ask for, and TDD never lists
// it, so www is left untouched here.

describe('the real articles.csv corpus (utm_ and fragment coverage)', () => {
	const raw = readFileSync('source_data/articles.csv', 'utf8');
	const rows: Array<{ url: string }> = parse(raw, { columns: true, skip_empty_lines: true });

	// Measured against the fixture on 2026-09-18: 677 of 3861 rows carry a utm_
	// param, 1 carries a fragment, and 472 have a trailing path slash. Only the
	// first two change the corpus's distinct-URL count (see the "3858 distinct"
	// test below); trailing-slash/credentials/case/www rules don't shift it in
	// this data, so they're covered by the synthetic table tests above instead
	// of by a real-corpus assertion here.
	it('parses the fixture to exactly 3861 rows', () => {
		expect(rows.length).toBe(3861);
	});

	it('strips utm_ from all 677 rows that carry one, and the 1 fragment', () => {
		let utmRows = 0;
		let fragRows = 0;
		for (const row of rows) {
			const before = new URL(row.url);
			if (/utm_/i.test(before.search)) utmRows++;
			if (before.hash) fragRows++;

			const normalized = normalizeUrl(row.url);
			expect(normalized).not.toBeNull();
			expect(normalized).not.toContain('utm_');
			expect(normalized).not.toContain('#');
		}
		expect(utmRows).toBe(677);
		expect(fragRows).toBe(1);
	});

	it('is idempotent for every row: normalize(normalize(x)) === normalize(x)', () => {
		for (const row of rows) {
			const once = normalizeUrl(row.url);
			const twice = normalizeUrl(once as string);
			expect(twice).toBe(once);
		}
	});

	// Measured against the fixture on 2026-09-18 (see report): 3861 raw rows,
	// 3858 distinct raw URLs (3 exact-duplicate rows), 3858 distinct normalized
	// URLs, 0 rejects. Normalization merges no additional raw URLs in this
	// corpus beyond the exact duplicates already present.
	it('has exactly 3858 distinct normalized URLs from 3861 rows, 0 rejects', () => {
		const normalized = rows.map((row) => normalizeUrl(row.url));
		const rejected = normalized.filter((n) => n === null);
		expect(rejected).toHaveLength(0);

		const distinctRaw = new Set(rows.map((row) => row.url)).size;
		const distinctNormalized = new Set(normalized as string[]).size;
		expect(distinctRaw).toBe(3858);
		expect(distinctNormalized).toBe(3858);
	});
});
