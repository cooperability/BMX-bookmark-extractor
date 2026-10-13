import { describe, expect, it } from 'vitest';
import { normalizeDeck, normalizeTags, safeReturn, TAGS_PER_CARD } from './edit';
import { replaceText } from './sanitize';

describe('normalizeTags', () => {
	it('splits on whitespace, as a space commits a tag in Anki', () => {
		expect(normalizeTags(['a b', '  c\td  '])).toEqual(['a', 'b', 'c', 'd']);
	});

	it('drops case-insensitive duplicates, keeping the first spelling', () => {
		expect(normalizeTags(['Bio', 'bio', 'BIO', 'chem'])).toEqual(['Bio', 'chem']);
	});

	it('keeps commas and Anki hierarchy inside a tag, so imported tags round-trip', () => {
		expect(normalizeTags(['a,b', 'lang::fr'])).toEqual(['a,b', 'lang::fr']);
	});

	it('caps the count per card', () => {
		const many = Array.from({ length: TAGS_PER_CARD + 10 }, (_, i) => `t${i}`);
		expect(normalizeTags(many)).toHaveLength(TAGS_PER_CARD);
	});
});

describe('normalizeDeck', () => {
	it('trims each level of a nested deck', () => {
		expect(normalizeDeck('  Lang ::  French  vocab ::')).toBe('Lang::French vocab');
	});

	it('is null when nothing is left', () => {
		for (const d of ['', '   ', '::', ' :: :: ']) expect(normalizeDeck(d)).toBeNull();
	});
});

describe('safeReturn', () => {
	it('keeps a same-site path and its query', () => {
		expect(safeReturn('/cards/study?deck=a%2Fb')).toBe('/cards/study?deck=a%2Fb');
		expect(safeReturn('/quest')).toBe('/quest');
	});

	it('refuses anything that could leave the site', () => {
		for (const r of [
			'//evil.test/x',
			'/\\evil.test',
			// The URL parser collapses dot segments into a protocol-relative path.
			'/.//evil.test',
			'/x/..//evil.test',
			'/./\\evil.test',
			'https://evil.test',
			'javascript:alert(1)',
			'evil.test',
			'',
			null
		])
			expect(safeReturn(r)).toBeNull();
	});

	it('drops a fragment, which would not reach the server anyway', () => {
		expect(safeReturn('/quest#x')).toBe('/quest');
	});
});

describe('replaceText', () => {
	it('replaces in text and leaves tags and attributes alone', () => {
		const html = '<a href="https://a.test/a">a cat</a> a';
		// The result is sanitized, as every save is, so the link gains target and rel.
		expect(replaceText(html, 'a', 'the', false)).toBe(
			'<a href="https://a.test/a" target="_blank" rel="noopener noreferrer">the cthet</a> the'
		);
	});

	it('matches the stored entity for a typed &', () => {
		expect(replaceText('salt &amp; pepper', '&', 'and', false)).toBe('salt and pepper');
	});

	it('inserts the replacement as text, never as markup', () => {
		expect(replaceText('x', 'x', '<img src=x onerror=alert(1)>', false)).toBe(
			'&lt;img src=x onerror=alert(1)&gt;'
		);
	});

	it('treats regex characters in the search literally', () => {
		expect(replaceText('a.b axb', 'a.b', 'ok', false)).toBe('ok axb');
		// `$&` read as a regex substitution would give "$1$1". As text, its & is stored escaped.
		expect(replaceText('$1 $1', '$1', '$&', false)).toBe('$&amp; $&amp;');
	});

	it('ignores case unless asked to match it', () => {
		expect(replaceText('Cat cat', 'cat', 'dog', false)).toBe('dog dog');
		expect(replaceText('Cat cat', 'cat', 'dog', true)).toBe('Cat dog');
	});

	it('finds a double quote, which stored text keeps unescaped', () => {
		expect(replaceText('He said "hi"', '"hi"', 'bye', false)).toBe('He said bye');
	});

	it('leaves an attribute alone when its value holds a >', () => {
		const html = '<img alt="1>2 cats" src="https://a.test/c.png"> cats';
		expect(replaceText(html, 'cats', 'dogs', false)).toBe(
			'<img alt="1>2 cats" src="https://a.test/c.png"> dogs'
		);
	});

	it('leaves entity names alone and matches the character they stand for', () => {
		expect(replaceText('Paris&nbsp;is big, 1 &lt; 2', 's', 'z', false)).toBe(
			'Pariz&nbsp;iz big, 1 &lt; 2'
		);
		expect(replaceText('1 &lt; 2', 't', 'x', false)).toBe('1 &lt; 2');
		expect(replaceText('1 &lt; 2', '<', '>', false)).toBe('1 &gt; 2');
		expect(replaceText('salt &amp; pepper', 'salt & pepper', 'spice', false)).toBe('spice');
	});

	it('changes nothing for an empty search', () => {
		expect(replaceText('abc', '', 'x', false)).toBe('abc');
	});
});
