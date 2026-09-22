import { fail, redirect } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { encodeBase32LowerCase } from '@oslojs/encoding';
import * as auth from '$lib/server/auth';
import { db } from '$lib/server/db';
import * as table from '$lib/server/db/schema';
import { sendLoginCode } from '$lib/server/mail';
import { isAllowed, issueCode, normalizeEmail, verifyCode } from '$lib/server/otp';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	if (locals.user) redirect(303, '/cards');
};

export const actions: Actions = {
	send: async ({ request }) => {
		const email = normalizeEmail(String((await request.formData()).get('email') ?? ''));
		if (!email) return fail(400, { email, message: 'Enter an email.' });
		// Same answer for allowed and unknown addresses, so the form does not reveal the allowlist.
		if (isAllowed(email)) {
			const code = await issueCode(email);
			// Awaited so serverless does not kill the send. Errors are logged, not returned,
			// so an SMTP failure does not single out an allowed address.
			if (code) await sendLoginCode(email, code).catch((e) => console.error('[auth] send', e));
		}
		return { email, sent: true };
	},
	verify: async (event) => {
		const form = await event.request.formData();
		const email = normalizeEmail(String(form.get('email') ?? ''));
		const code = String(form.get('code') ?? '');
		if (!isAllowed(email) || !(await verifyCode(email, code))) {
			return fail(400, { email, sent: true, message: 'Wrong or expired code.' });
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
