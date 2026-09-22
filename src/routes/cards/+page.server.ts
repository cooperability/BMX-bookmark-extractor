import { fail } from '@sveltejs/kit';
import { importDeck, listDecks } from '$lib/server/cards/repo';
import { overview } from '$lib/server/cards/stats';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const [decks, stats] = await Promise.all([listDecks(locals.user!.id), overview(locals.user!.id)]);
	return { decks, stats };
};

export const actions: Actions = {
	import: async ({ request, locals }) => {
		const file = (await request.formData()).get('file');
		if (!(file instanceof File) || file.size === 0) {
			return fail(400, { message: 'Choose an Anki .txt export.' });
		}
		const { imported, warnings } = await importDeck(locals.user!.id, await file.text());
		return { message: `Imported ${imported} cards.`, warnings };
	}
};
