import { error } from '@sveltejs/kit';
import { browseCards, parseBrowseParams } from '$lib/server/cards/browse';
import { deckDetail } from '$lib/server/cards/stats';
import { TZ_COOKIE, toTimeZone } from '$lib/timezone';
import type { PageServerLoad } from './$types';

// Deck names contain '/', so the deck rides in the query string, not the path.
export const load: PageServerLoad = async ({ url, cookies, locals }) => {
	const deck = url.searchParams.get('deck');
	if (!deck) error(400, 'Pick a deck.');
	const userId = locals.user!.id;
	const [detail, browse] = await Promise.all([
		deckDetail(userId, deck, new Date(), toTimeZone(cookies.get(TZ_COOKIE))),
		browseCards(userId, deck, parseBrowseParams(url.searchParams))
	]);
	if (!detail) error(404, 'No cards in that deck.');
	return { deck, ...detail, browse };
};
