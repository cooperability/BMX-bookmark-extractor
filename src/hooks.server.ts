import type { Handle } from '@sveltejs/kit';

export const handle: Handle = async ({ event, resolve }) => {
	// This is a minimal passthrough handle function.
	// Add any future global SvelteKit hooks here.
	const response = await resolve(event);
	return response;
};
