import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { sanitizeCardHtml } from './sanitize';

describe('script execution', () => {
	it.each([
		['<script>alert(1)</script>', 'alert'],
		['<img src=x onerror=alert(1)>', 'onerror'],
		['<svg/onload=alert(1)>', 'onload'],
		['<iframe src="https://evil.test"></iframe>', 'iframe'],
		['<body onload=alert(1)>', 'onload'],
		['<math><mtext><style><img src=x onerror=alert(1)>', 'onerror'],
		['<form action="https://evil.test"><input name="x">', 'form'],
		['<object data="data:text/html,<script>alert(1)</script>">', 'object'],
		['<embed src="https://evil.test">', 'embed'],
		['<style>@import "https://evil.test"</style>', 'import']
	])('removes %s', (dirty, forbidden) => {
		expect(sanitizeCardHtml(dirty).toLowerCase()).not.toContain(forbidden);
	});
});

describe('link hrefs', () => {
	it.each(['javascript:alert(1)', 'JaVaScRiPt:alert(1)', 'data:text/html,<b>x</b>', 'vbscript:x'])(
		'strips the href %s',
		(href) => {
			const out = sanitizeCardHtml(`<a href="${href}">click</a>`);
			expect(out).not.toContain('href');
			// The text survives; only the dangerous attribute goes.
			expect(out).toContain('click');
		}
	);

	it.each(['https://en.wikipedia.org/wiki/SSH', 'http://example.test', 'mailto:a@b.test'])(
		'keeps the href %s',
		(href) => {
			expect(sanitizeCardHtml(`<a href="${href}">x</a>`)).toContain(href);
		}
	);

	it('adds target and rel to every surviving link', () => {
		const out = sanitizeCardHtml('<a href="https://example.test">x</a>');
		expect(out).toContain('target="_blank"');
		expect(out).toContain('rel="noopener noreferrer"');
	});
});

describe('allowlist', () => {
	it('keeps the tags Anki actually writes', () => {
		const html =
			'<div><b>b</b><i>i</i><u>u</u><em>e</em><strong>s</strong><br><p>p</p>' +
			'<ul><li>li</li></ul><ol><li>li</li></ol><code>c</code><pre>p</pre>' +
			'<span>s</span><sup>1</sup><sub>2</sub><table><tr><th>h</th><td>d</td></tr></table></div>';
		const out = sanitizeCardHtml(html);

		for (const tag of ['div', 'b', 'i', 'u', 'em', 'strong', 'br', 'p', 'ul', 'ol', 'li', 'code', 'pre', 'span', 'sup', 'sub', 'table', 'tr', 'th', 'td']) {
			expect(out).toContain(`<${tag}`);
		}
	});

	it('drops data attributes', () => {
		expect(sanitizeCardHtml('<div data-guid="tNcJ[p<DNp">x</div>')).not.toContain('data-guid');
	});

	it('drops style and event attributes but keeps class, src and alt', () => {
		const out = sanitizeCardHtml('<img src="/a.png" alt="a" class="c" style="x" onclick="y">');
		expect(out).toContain('src="/a.png"');
		expect(out).toContain('alt="a"');
		expect(out).toContain('class="c"');
		expect(out).not.toContain('style');
		expect(out).not.toContain('onclick');
	});

	it('returns an empty string for empty input', () => {
		expect(sanitizeCardHtml('')).toBe('');
	});

	it('leaves plain text and entities alone', () => {
		expect(sanitizeCardHtml('400-700nm')).toBe('400-700nm');
		expect(sanitizeCardHtml('a &amp; b')).toBe('a &amp; b');
	});

	it('escapes a bare angle bracket rather than dropping the text', () => {
		expect(sanitizeCardHtml('a < b')).toContain('a ');
	});
});

describe('the real corpus', () => {
	const compsci = readFileSync('source_data/CompSci (AIML_Web3_Math_Logic_Tech).txt', 'utf8');

	it('preserves the Wikipedia links the cards depend on', () => {
		// Both exports declare #html:true and the cards carry live links.
		const out = sanitizeCardHtml(compsci);
		expect(out).toContain('https://en.wikipedia.org/wiki/Cryptography');
		expect(out).toContain('rel="noopener noreferrer"');
	});

	it('produces no script or event handlers from the whole file', () => {
		const out = sanitizeCardHtml(compsci).toLowerCase();
		expect(out).not.toContain('<script');
		expect(out).not.toContain('javascript:');
		expect(out).not.toContain('onerror');
	});
});
