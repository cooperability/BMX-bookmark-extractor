import { describe, expect, it, vi } from 'vitest';

// The client needs DATABASE_URL and $app modules. Only the pure helpers run here.
vi.mock('../db', () => ({ db: {} }));

import { dueLabel, escapeLike, parseBrowseParams, plainText, stateName } from './browse';

const parse = (qs: string) => parseBrowseParams(new URLSearchParams(qs));

describe('parseBrowseParams', () => {
	it('defaults to page 1, sorted by due, unfiltered', () => {
		expect(parse('deck=a%2Fb')).toEqual({ q: '', tag: null, state: null, sort: 'due', page: 1 });
	});

	it('keeps recognised values', () => {
		expect(parse('q=+verb+&tag=grammar&state=relearning&sort=lapses&page=3')).toEqual({
			q: 'verb',
			tag: 'grammar',
			state: 'relearning',
			sort: 'lapses',
			page: 3
		});
	});

	it('drops an unknown state or sort instead of passing it to SQL', () => {
		const p = parse('state=deleted&sort=id;drop');
		expect(p.state).toBeNull();
		expect(p.sort).toBe('due');
	});

	it('clamps a zero, negative or garbage page to 1', () => {
		expect(parse('page=0').page).toBe(1);
		expect(parse('page=-4').page).toBe(1);
		expect(parse('page=abc').page).toBe(1);
	});

	it('caps the search text at 200 characters', () => {
		expect(parse(`q=${'x'.repeat(500)}`).q).toHaveLength(200);
	});
});

describe('escapeLike', () => {
	it('makes % and _ literal', () => {
		expect(escapeLike('100%_done')).toBe('100\\%\\_done');
	});

	it('escapes the escape character itself', () => {
		expect(escapeLike('a\\b')).toBe('a\\\\b');
	});
});

describe('plainText', () => {
	it('strips tags and decodes entities', () => {
		expect(plainText('<b>Fish</b> &amp; <i>chips</i>&nbsp;&lt;3&#33;')).toBe('Fish & chips <3!');
	});

	it('drops script and style bodies entirely', () => {
		expect(plainText('a<script>alert(1)</script><style>p{}</style>b')).toBe('a b');
	});

	it('separates block elements with a space', () => {
		expect(plainText('<div>one</div><div>two</div>')).toBe('one two');
	});

	it('truncates to the limit with an ellipsis', () => {
		const out = plainText('word '.repeat(100), 20);
		expect(out.length).toBeLessThanOrEqual(20);
		expect(out.endsWith('…')).toBe(true);
	});

	it('leaves text at the limit untouched', () => {
		expect(plainText('abcde', 5)).toBe('abcde');
	});
});

describe('dueLabel', () => {
	const now = new Date('2026-09-21T12:00:00Z');
	const at = (iso: string) => new Date(iso);

	it('says new for unseen cards whatever the date', () => {
		expect(dueLabel('new', at('2020-01-01T00:00:00Z'), now)).toBe('new');
		expect(dueLabel('review', null, now)).toBe('new');
	});

	it('counts whole days ahead and behind', () => {
		expect(dueLabel('review', at('2026-09-24T13:00:00Z'), now)).toBe('in 3d');
		expect(dueLabel('review', at('2026-09-19T11:00:00Z'), now)).toBe('overdue 2d');
	});

	it('drops to hours and minutes under a day', () => {
		expect(dueLabel('learning', at('2026-09-21T17:30:00Z'), now)).toBe('in 5h');
		expect(dueLabel('relearning', at('2026-09-21T12:10:00Z'), now)).toBe('in 10m');
		expect(dueLabel('review', at('2026-09-21T12:00:00Z'), now)).toBe('overdue 1m');
	});
});

describe('stateName', () => {
	it('maps the FSRS smallint, treating a missing row as new', () => {
		expect([null, 0, 1, 2, 3].map(stateName)).toEqual([
			'new',
			'new',
			'learning',
			'review',
			'relearning'
		]);
	});
});
