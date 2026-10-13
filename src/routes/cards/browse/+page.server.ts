import { fail } from '@sveltejs/kit';
import { safeReturn } from '$lib/cards/edit';
import { browseCards, parseBrowseParams } from '$lib/server/cards/browse';
import {
	createCard,
	deleteCards,
	EditError,
	editorOptions,
	forgetCards,
	getCard,
	moveCards,
	replaceInCards,
	restoreCards,
	retagCards,
	setFlag,
	setSuspended,
	updateCard,
	type Field
} from '$lib/server/cards/edit';
import type { Actions, PageServerLoad } from './$types';

// Anki's browser: every card across decks, a deck filter, and the editor beside
// the list. The selection rides in the URL (?card=, ?new) so reload and Back work.
export const load: PageServerLoad = async ({ url, locals }) => {
	const userId = locals.user!.id;
	const sp = url.searchParams;
	const deck = sp.get('deck') || null;
	const cardId = sp.get('card');
	const [browse, options, card] = await Promise.all([
		browseCards(userId, deck, parseBrowseParams(sp)),
		editorOptions(userId),
		cardId ? getCard(userId, cardId.slice(0, 64)) : null
	]);
	return {
		deck,
		browse,
		options,
		card,
		creating: !card && sp.has('new'),
		// Asked for a card that is not there: deleted in another tab, or not this user's.
		missing: Boolean(cardId) && !card,
		returnTo: safeReturn(sp.get('return'))
	};
};

const idsOf = (f: FormData) =>
	f
		.getAll('id')
		.map(String)
		.filter((id) => id.length > 0 && id.length <= 64);
const text = (f: FormData, key: string) => String(f.get(key) ?? '');
const plural = (n: number, word = 'card') => `${n} ${word}${n === 1 ? '' : 's'}`;

/** EditError is the user's to fix and becomes a 400. Anything else is ours. */
async function attempt<T>(fn: () => Promise<T>) {
	try {
		return await fn();
	} catch (e) {
		if (e instanceof EditError) return fail(400, { message: e.message });
		throw e;
	}
}

export const actions: Actions = {
	save: async ({ request, locals }) => {
		const f = await request.formData();
		const userId = locals.user!.id;
		const id = text(f, 'id');
		const input = {
			front: text(f, 'front'),
			back: text(f, 'back'),
			deck: text(f, 'deck'),
			tags: f.getAll('tag').map(String)
		};
		return attempt(async () => {
			if (!id) return { created: true, ...(await createCard(userId, input)) };
			const saved = await updateCard(userId, id, input);
			if (!saved) return fail(404, { message: 'That card is gone. It may have been deleted.' });
			return { created: false, ...saved };
		});
	},

	delete: async ({ request, locals }) => {
		const gone = await deleteCards(locals.user!.id, idsOf(await request.formData()));
		if (!gone) return fail(404, { message: 'Those cards are already gone.' });
		return gone;
	},

	undo: async ({ request, locals }) => {
		const trashId = text(await request.formData(), 'trash').slice(0, 64);
		const restored = await restoreCards(locals.user!.id, trashId);
		if (restored === null)
			return fail(404, {
				message: 'Nothing to undo. It was undone already, or is over a day old.'
			});
		if (!restored) return { message: 'Nothing to restore. Those cards are back already.' };
		return { message: `Restored ${plural(restored)}.` };
	},

	bulk: async ({ request, locals }) => {
		const f = await request.formData();
		const userId = locals.user!.id;
		const ids = idsOf(f);
		if (!ids.length) return fail(400, { message: 'Select cards first.' });
		const field = (['front', 'back', 'both'] as Field[]).find((x) => x === text(f, 'field'));
		return attempt(async () => {
			switch (text(f, 'op')) {
				case 'move': {
					const n = await moveCards(userId, ids, text(f, 'deck'));
					return { message: `Moved ${plural(n)}.` };
				}
				case 'tag':
				case 'untag': {
					const tags = f.getAll('tags').map(String);
					if (!tags.join('').trim()) return fail(400, { message: 'Type a tag.' });
					const n =
						text(f, 'op') === 'tag'
							? await retagCards(userId, ids, tags, [])
							: await retagCards(userId, ids, [], tags);
					return { message: `Retagged ${plural(n)}.` };
				}
				case 'flag': {
					const n = await setFlag(userId, ids, Number(text(f, 'flag')));
					return { message: `Flagged ${plural(n)}.` };
				}
				case 'suspend':
				case 'unsuspend': {
					const on = text(f, 'op') === 'suspend';
					const n = await setSuspended(userId, ids, on);
					return { message: `${on ? 'Suspended' : 'Unsuspended'} ${plural(n)}.` };
				}
				case 'forget': {
					const n = await forgetCards(userId, ids);
					return { message: `Reset ${plural(n)} to new.` };
				}
				case 'replace': {
					const n = await replaceInCards(
						userId,
						ids,
						text(f, 'find').slice(0, 1000),
						text(f, 'replace').slice(0, 1000),
						field ?? 'both',
						f.get('matchCase') === 'on'
					);
					return { message: n ? `Changed ${plural(n)}.` : 'No matches.' };
				}
				default:
					return fail(400, { message: 'Pick an action.' });
			}
		});
	}
};
