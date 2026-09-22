import { json, redirect, type Handle } from '@sveltejs/kit';
import * as auth from '$lib/server/auth';
import { asTenant } from '$lib/server/db';
import { isAllowed } from '$lib/server/otp';
import { toTheme } from '$lib/theme';

const PUBLIC = ['/', '/login', '/api/health', '/theme'];

export const handle: Handle = async ({ event, resolve }) => {
	const token = event.cookies.get(auth.sessionCookieName);
	if (token) {
		let { session, user } = await auth.validateSessionToken(token);
		// Dropping an address from ALLOWED_EMAILS ends its sessions on the next request.
		if (session && user && !isAllowed(user.email)) {
			await auth.invalidateSession(session.id);
			session = null;
			user = null;
		}
		if (session) auth.setSessionTokenCookie(event, token, session.expiresAt);
		else auth.deleteSessionTokenCookie(event);
		event.locals.user = user;
		event.locals.session = session;
	} else {
		event.locals.user = null;
		event.locals.session = null;
	}

	if (!event.locals.user && !PUBLIC.includes(event.url.pathname)) {
		// A fetch follows a redirect to the login page's HTML and then fails to parse
		// it. API callers get a status they can act on.
		if (event.url.pathname.startsWith('/api/')) {
			return json({ message: 'Log in again.' }, { status: 401 });
		}
		redirect(303, '/login');
	}

	// Rendered server-side so the first paint is right: the CSP forbids an inline script.
	const theme = toTheme(event.cookies.get('theme'));
	const render = async () =>
		resolve(event, { transformPageChunk: ({ html }) => html.replace('%theme%', theme) });
	// Signed-in work runs under row-level security for that user (db/index.ts).
	const user = event.locals.user;
	return user ? asTenant(user.id, render) : render();
};
