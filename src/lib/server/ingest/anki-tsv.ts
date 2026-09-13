import { parse } from 'csv-parse/sync';
import { contentId, internalId } from './identity';
import { sanitizeCardHtml } from './sanitize';

export interface AnkiNote {
	/** URL-safe. Derived from the GUID, or from content when the export declares none. */
	id: string;
	/** Raw base91. Unique per note, stable across edits. Never render or route on this. */
	ankiGuid: string | null;
	notetype: string;
	deck: string;
	front: string;
	back: string;
	tags: string[];
}

export interface ParseResult {
	notes: AnkiNote[];
	/** Rows that parsed but looked wrong. Never drop a row silently. */
	warnings: string[];
}

const PREAMBLE = /^#(\w[\w ]*):(.*)$/;

const NAMED_SEPARATORS: Record<string, string> = {
	tab: '\t',
	comma: ',',
	semicolon: ';',
	space: ' ',
	pipe: '|'
};

function resolveDelimiter(declared: string | undefined): string {
	if (!declared) return ',';
	return NAMED_SEPARATORS[declared.toLowerCase()] ?? declared;
}

/**
 * Parse a real Anki export.
 *
 * Anki writes tab-separated but CSV-quoted fields: `"` delimits, `""` escapes an
 * internal quote, and a quoted field may contain literal newlines. Splitting on
 * newlines reads 4,629 records where 457 exist, and it does not error. So this
 * runs a real RFC4180 parser, and takes column positions from the `#…column:N`
 * preamble rather than assuming them.
 */
export function parseAnkiExport(raw: string): ParseResult {
	const warnings: string[] = [];
	const text = raw.replace(/^\uFEFF/, '');
	const lines = text.split('\n');

	const header: Record<string, string> = {};
	let firstDataLine = 0;
	for (; firstDataLine < lines.length && lines[firstDataLine].startsWith('#'); firstDataLine++) {
		const m = PREAMBLE.exec(lines[firstDataLine]);
		if (m) header[m[1].trim()] = m[2].trim();
	}

	const delimiter = resolveDelimiter(header['separator']);

	const rows: string[][] = parse(lines.slice(firstDataLine).join('\n'), {
		delimiter,
		quote: '"',
		escape: '"',
		relax_column_count: true,
		relax_quotes: true,
		skip_empty_lines: true
	});

	// Preamble columns are 1-indexed. Absent means "not declared".
	const col = (key: string) => (header[key] ? Number(header[key]) - 1 : -1);
	const guidCol = col('guid column');
	const notetypeCol = col('notetype column');
	const deckCol = col('deck column');
	const tagsCol = col('tags column');

	// Field columns are whatever the declared columns do not claim.
	const claimed = new Set([guidCol, notetypeCol, deckCol, tagsCol].filter((n) => n >= 0));
	const width = rows.reduce((max, r) => Math.max(max, r.length), 0);
	const fieldCols: number[] = [];
	for (let n = 0; n < width; n++) if (!claimed.has(n)) fieldCols.push(n);

	if (fieldCols.length === 0 && rows.length > 0) {
		warnings.push('No field columns: the preamble claims every column. Nothing to import.');
	}

	const notes = rows.map((row, i) => {
		if (row.length < width) {
			warnings.push(`Row ${i + 1}: ${row.length} columns, expected ${width}.`);
		}

		const ankiGuid = guidCol >= 0 ? (row[guidCol] ?? null) : null;
		// Deck names contain `/`. Anki's hierarchy separator is `::`, so do not split.
		const deck = deckCol >= 0 ? (row[deckCol] ?? '') : (header['deck'] ?? 'Default');
		const front = sanitizeCardHtml(row[fieldCols[0]] ?? '');
		const back = sanitizeCardHtml(row[fieldCols[1]] ?? '');

		if (!front) warnings.push(`Row ${i + 1}: empty front field.`);

		return {
			id: ankiGuid ? internalId(ankiGuid) : contentId(deck, front, back),
			ankiGuid,
			notetype: notetypeCol >= 0 ? (row[notetypeCol] || 'Basic') : 'Basic',
			deck,
			front,
			back,
			// Tags are space-separated inside one column: "dataflow fullstack webdev".
			tags: tagsCol >= 0 ? (row[tagsCol] ?? '').split(/\s+/).filter(Boolean) : []
		};
	});

	return { notes, warnings };
}
