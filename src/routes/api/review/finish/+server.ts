import { error, json } from '@sveltejs/kit';
import { finishRound } from '$lib/server/cards/repo';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) error(401);
	const { assessmentId } = await request.json();
	if (typeof assessmentId !== 'string') error(400);
	const grades = await finishRound(locals.user.id, assessmentId);
	if (!grades) error(404);
	return json(grades);
};
