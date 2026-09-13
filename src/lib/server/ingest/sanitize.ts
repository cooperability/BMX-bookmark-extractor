import DOMPurify from 'isomorphic-dompurify';

DOMPurify.addHook('afterSanitizeAttributes', (node) => {
	if (node.tagName !== 'A') return;
	const href = node.getAttribute('href') ?? '';
	if (!/^(https?:|mailto:)/i.test(href)) node.removeAttribute('href');
	node.setAttribute('target', '_blank');
	node.setAttribute('rel', 'noopener noreferrer');
});

const ALLOWED_TAGS = [
	'b',
	'i',
	'u',
	'em',
	'strong',
	'div',
	'br',
	'p',
	'ul',
	'ol',
	'li',
	'code',
	'pre',
	'span',
	'img',
	'a',
	'sup',
	'sub',
	'table',
	'tr',
	'td',
	'th'
];

export function sanitizeCardHtml(dirty: string): string {
	return DOMPurify.sanitize(dirty, {
		ALLOWED_TAGS,
		ALLOWED_ATTR: ['src', 'alt', 'class', 'href', 'target', 'rel'],
		FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed', 'form', 'input', 'svg', 'math'],
		ALLOW_DATA_ATTR: false
	});
}
