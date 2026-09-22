import { error } from '@sveltejs/kit';
import { startRound } from '$lib/server/cards/repo';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url, locals, depends }) => {
	depends('cards:round');
	const deck = url.searchParams.get('deck');
	if (!deck) error(400, 'Pick a deck.');
	const round = await startRound(locals.user!.id, deck);
	if (!round) error(404, 'No cards in that deck.');
	return { deck, ...round };
};
