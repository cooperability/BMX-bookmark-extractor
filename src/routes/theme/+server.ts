import { error, type RequestHandler } from '@sveltejs/kit';
import { THEMES, type Theme } from '$lib/theme';

export const POST: RequestHandler = async ({ request, cookies }) => {
	const body = await request.json().catch(() => null);
	const theme = body?.theme;
	if (!THEMES.includes(theme as Theme)) {
		error(400, 'theme must be system, light or dark');
	}
	// Not httpOnly: it holds a display preference, nothing secret.
	cookies.set('theme', theme, {
		path: '/',
		sameSite: 'lax',
		httpOnly: false,
		maxAge: 60 * 60 * 24 * 365
	});
	return new Response(null, { status: 204 });
};
