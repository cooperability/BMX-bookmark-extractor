import { error } from '@sveltejs/kit';
import { deckDetail } from '$lib/server/cards/stats';
import type { PageServerLoad } from './$types';

// Deck names contain '/', so the deck rides in the query string, not the path.
export const load: PageServerLoad = async ({ url, locals }) => {
	const deck = url.searchParams.get('deck');
	if (!deck) error(400, 'Pick a deck.');
	const detail = await deckDetail(locals.user!.id, deck);
	if (!detail) error(404, 'No cards in that deck.');
	return { deck, ...detail };
};
