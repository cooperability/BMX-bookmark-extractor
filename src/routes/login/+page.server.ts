import { fail, redirect } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { encodeBase32LowerCase } from '@oslojs/encoding';
import * as auth from '$lib/server/auth';
import { db } from '$lib/server/db';
import * as table from '$lib/server/db/schema';
import { checkDevPassword, isAllowed, normalizeEmail } from '$lib/server/otp';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	if (locals.user) redirect(303, '/cards');
};

export const actions: Actions = {
	login: async (event) => {
		const form = await event.request.formData();
		const email = normalizeEmail(String(form.get('email') ?? ''));
		const password = String(form.get('password') ?? '');
		// One answer for every failure, so the form does not reveal the allowlist.
		if (!isAllowed(email) || !checkDevPassword(password)) {
			return fail(400, { email, message: "Sorry, you don't have the dev password." });
		}

		let [user] = await db.select().from(table.user).where(eq(table.user.email, email));
		if (!user) {
			const id = encodeBase32LowerCase(crypto.getRandomValues(new Uint8Array(15)));
			[user] = await db.insert(table.user).values({ id, email }).returning();
		}
		const token = auth.generateSessionToken();
		const session = await auth.createSession(token, user.id);
		auth.setSessionTokenCookie(event, token, session.expiresAt);
		redirect(303, '/cards');
	},
	logout: async (event) => {
		if (event.locals.session) await auth.invalidateSession(event.locals.session.id);
		auth.deleteSessionTokenCookie(event);
		redirect(303, '/login');
	}
};
