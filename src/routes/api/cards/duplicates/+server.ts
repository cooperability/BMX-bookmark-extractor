import { error, json } from '@sveltejs/kit';
import { FIELD_MAX } from '$lib/cards/edit';
import { findDuplicates } from '$lib/server/cards/edit';
import type { RequestHandler } from './$types';

// The editor asks while the front is typed, as Anki marks a duplicate field live.
// POST, not GET: the front is card text, and a query string lands in access logs.
export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) error(401);
	const body = await request.json().catch(() => ({}));
	const { front, exclude } = body ?? {};
	if (typeof front !== 'string' || front.length > FIELD_MAX) error(400, 'Bad front.');
	if (exclude !== null && !(typeof exclude === 'string' && exclude.length <= 64))
		error(400, 'Bad card.');
	return json(await findDuplicates(locals.user.id, front, exclude));
};
