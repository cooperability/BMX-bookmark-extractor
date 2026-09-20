import { error, json } from '@sveltejs/kit';
import {
	importAnkiExport,
	MalformedImportError,
	MAX_IMPORT_BYTES,
	PayloadTooLargeError,
	readCappedText
} from '../../../lib/server/ingest/import';
import type { RequestHandler } from './$types';

// Raw text body, not multipart: an Anki export is one text file, and a raw
// body streams straight into readCappedText's byte count with no boundary
// parser sitting in front of it buffering first.
export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) return error(401, 'Unauthorized');

	let raw: string;
	try {
		raw = await readCappedText(
			request.body,
			request.headers.get('content-length'),
			MAX_IMPORT_BYTES
		);
	} catch (e) {
		if (e instanceof PayloadTooLargeError) return error(413, 'Payload too large');
		throw e;
	}

	// Deferred past the auth/size gates: db/index.ts throws without a real
	// DATABASE_URL, and route-level tests exercise those gates without one.
	const { db } = await import('../../../lib/server/db');
	try {
		const { imported, matched, jobId, warnings } = await importAnkiExport(
			db,
			locals.user.id,
			raw,
			new Date()
		);
		return json({ imported, matched, jobId, warnings }, { status: 202 });
	} catch (e) {
		// The body is user-supplied and the preamble picks the delimiter, so an
		// unparseable export is the client's error. Never echo the parser message:
		// it quotes the failing row back.
		if (e instanceof MalformedImportError) return error(400, 'Malformed Anki export');
		throw e;
	}
};
