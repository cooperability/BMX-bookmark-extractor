/**
 * update() options for the browser's side forms. SvelteKit 3's update() lands on
 * the action's URL by default, which drops the page's query: the filters, the
 * page and the open card.
 */
export const STAY = { reset: false, navigate: false } as const;
