import { error, json } from '@sveltejs/kit';
import type { Grade } from 'ts-fsrs';
import { MAX_REPEATS } from '$lib/cards/round';
import { recordGrade } from '$lib/server/cards/repo';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) error(401);
	const { assessmentId, nodeId, rating, attempt } = await request.json();
	if (
		![1, 2, 3, 4].includes(rating) ||
		!(Number.isInteger(attempt) && attempt >= 0 && attempt <= MAX_REPEATS) ||
		typeof assessmentId !== 'string' ||
		typeof nodeId !== 'string'
	) {
		error(400, 'Bad grade.');
	}
	if (!(await recordGrade(locals.user.id, assessmentId, nodeId, rating as Grade, attempt)))
		error(404);
	return json({ ok: true });
};
