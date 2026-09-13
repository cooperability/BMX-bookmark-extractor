import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseAnkiExport } from './anki-tsv';

const ANTHRO = 'source_data/Anthro (Psych_Soc_Econ_Health).txt';
const COMPSCI = 'source_data/CompSci (AIML_Web3_Math_Logic_Tech).txt';

const read = (p: string) => readFileSync(p, 'utf8');

const PREAMBLE = [
	'#separator:tab',
	'#html:true',
	'#guid column:1',
	'#notetype column:2',
	'#deck column:3',
	'#tags column:6'
].join('\n');

describe('the real Anki exports', () => {
	it('parses to exactly 457 records, not 4629 lines', () => {
		const anthro = parseAnkiExport(read(ANTHRO));
		const compsci = parseAnkiExport(read(COMPSCI));

		expect(anthro.notes).toHaveLength(320);
		expect(compsci.notes).toHaveLength(137);

		const guids = new Set([...anthro.notes, ...compsci.notes].map((n) => n.ankiGuid));
		expect(guids.size).toBe(457);
	});

	it('reads notetype from the declared column, so no <div> continuation lines leak in', () => {
		const { notes } = parseAnkiExport(read(COMPSCI));
		// A line-based parser reports notetypes of <div>, </div> and <ul> here.
		expect(notes.every((n) => n.notetype === 'Basic')).toBe(true);
	});

	it('keeps quoted fields that span lines intact', () => {
		const { notes } = parseAnkiExport(read(COMPSCI));
		const multiline = notes.filter((n) => n.back.includes('\n'));
		expect(multiline).toHaveLength(23);
	});

	it('treats deck names containing / as one flat deck', () => {
		const anthro = parseAnkiExport(read(ANTHRO));
		const compsci = parseAnkiExport(read(COMPSCI));
		const decks = new Set([...anthro.notes, ...compsci.notes].map((n) => n.deck));

		// Anki's hierarchy separator is ::, so the slashes are literal.
		expect(decks).toEqual(
			new Set(['Anthro (Psych/Soc/Econ/Health)', 'CompSci (AIML/Web3/Math/Logic/Tech)'])
		);
	});

	it('splits tags on whitespace rather than commas', () => {
		const { notes } = parseAnkiExport(read(COMPSCI));
		const tagged = notes.find((n) => n.tags.length > 1);

		expect(tagged).toBeDefined();
		expect(tagged!.tags).not.toContain('');
		// Real value in the corpus is "dataprivacy infosec", one column, space separated.
		expect(notes.some((n) => n.tags.includes('infosec'))).toBe(true);
		expect(notes.every((n) => n.tags.every((t) => !t.includes(' ')))).toBe(true);
	});

	it('derives a URL- and markup-safe id from GUIDs that contain < and %', () => {
		const { notes } = parseAnkiExport(read(ANTHRO));
		const hostile = notes.filter((n) => /[<>&/?#%]/.test(n.ankiGuid ?? ''));

		// The corpus really does contain these, e.g. IzyEE!<%K8 and pp<PWd+emQ.
		expect(hostile.length).toBeGreaterThan(0);
		for (const note of notes) {
			expect(note.id).toMatch(/^[A-Za-z0-9_-]{16}$/);
			expect(encodeURIComponent(note.id)).toBe(note.id);
		}
	});

	it('reports no warnings on the real corpus', () => {
		expect(parseAnkiExport(read(ANTHRO)).warnings).toEqual([]);
		expect(parseAnkiExport(read(COMPSCI)).warnings).toEqual([]);
	});

	it('is idempotent on ids, so re-import updates rather than duplicates', () => {
		const first = parseAnkiExport(read(COMPSCI)).notes;
		const second = parseAnkiExport(read(COMPSCI)).notes;
		expect(first.map((n) => n.id)).toEqual(second.map((n) => n.id));
	});
});

describe('the preamble drives column mapping', () => {
	it('follows declared positions instead of assuming them', () => {
		// Same data, columns reordered, declarations updated to match.
		const raw = [
			'#separator:tab',
			'#guid column:3',
			'#notetype column:1',
			'#deck column:2',
			'#tags column:6',
			['Basic', 'Deck A', 'guid-1', 'the front', 'the back', 'alpha beta'].join('\t')
		].join('\n');

		const { notes } = parseAnkiExport(raw);
		expect(notes).toHaveLength(1);
		expect(notes[0]).toMatchObject({
			ankiGuid: 'guid-1',
			notetype: 'Basic',
			deck: 'Deck A',
			front: 'the front',
			back: 'the back',
			tags: ['alpha', 'beta']
		});
	});

	it('honours a comma separator when declared', () => {
		const raw = ['#separator:comma', '#guid column:1', 'g1,the front,the back'].join('\n');
		const { notes } = parseAnkiExport(raw);
		expect(notes[0]).toMatchObject({ ankiGuid: 'g1', front: 'the front', back: 'the back' });
	});

	it('falls back to a content id when no guid column is declared', () => {
		const raw = ['#separator:tab', '#deck column:1', ['Deck A', 'front', 'back'].join('\t')].join(
			'\n'
		);
		const { notes } = parseAnkiExport(raw);

		expect(notes[0].ankiGuid).toBeNull();
		expect(notes[0].id).toMatch(/^[A-Za-z0-9_-]{16}$/);
		// Content-derived, so editing the card yields a different node.
		const edited = parseAnkiExport(raw.replace('back', 'edited back'));
		expect(edited.notes[0].id).not.toBe(notes[0].id);
	});

	it('uses the #deck fallback when no deck column is declared', () => {
		const raw = ['#separator:tab', '#deck:Imported', '#guid column:1', 'g1\tfront\tback'].join('\n');
		expect(parseAnkiExport(raw).notes[0].deck).toBe('Imported');
	});
});

describe('malformed input', () => {
	it('warns about short rows instead of dropping them', () => {
		const raw = [PREAMBLE, 'g1\tBasic\tDeck\tfront\tback\ttag', 'g2\tBasic\tDeck'].join('\n');
		const { notes, warnings } = parseAnkiExport(raw);

		expect(notes).toHaveLength(2);
		expect(warnings.some((w) => w.includes('Row 2'))).toBe(true);
	});

	it('warns on an empty front field', () => {
		const raw = [PREAMBLE, 'g1\tBasic\tDeck\t\tback\ttag'].join('\n');
		expect(parseAnkiExport(raw).warnings.some((w) => w.includes('empty front'))).toBe(true);
	});

	it('returns nothing for an empty file', () => {
		expect(parseAnkiExport('')).toEqual({ notes: [], warnings: [] });
	});

	it('returns nothing for a preamble with no records', () => {
		expect(parseAnkiExport(PREAMBLE)).toEqual({ notes: [], warnings: [] });
	});

	it('strips a UTF-8 BOM so the first preamble line still matches', () => {
		const raw = ['\uFEFF#separator:tab', '#guid column:1', 'g1\tfront\tback'].join('\n');
		expect(parseAnkiExport(raw).notes[0].ankiGuid).toBe('g1');
	});

	it('sanitizes card HTML on the way in', () => {
		const raw = [PREAMBLE, 'g1\tBasic\tDeck\t<img src=x onerror=alert(1)>\tback\ttag'].join('\n');
		const { notes } = parseAnkiExport(raw);
		expect(notes[0].front).not.toContain('onerror');
	});
});
