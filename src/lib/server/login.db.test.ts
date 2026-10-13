import { hasDb } from './testing/db';
import { eq, inArray, sql } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import * as table from './db/schema';

const run = crypto.randomUUID().slice(0, 8);
const alice = `throttle-a-${run}@test.invalid`;
const bob = `throttle-b-${run}@test.invalid`;
const password = `right-${run}`;

// `$app/env/private` reads these at import, so set them before the action loads.
const env = { ALLOWED_EMAILS: process.env.ALLOWED_EMAILS, DEV_PASSWORD: process.env.DEV_PASSWORD };
process.env.ALLOWED_EMAILS = `${alice},${bob}`;
process.env.DEV_PASSWORD = password;

const { db } = hasDb ? await import('./db') : ({} as typeof import('./db'));
const { actions } = hasDb
	? await import('../../routes/login/+page.server')
	: ({} as typeof import('../../routes/login/+page.server'));

/** Posts the login form and reports whether it signed in. */
async function login(email: string, pw: string): Promise<'in' | 'refused'> {
	const body = new FormData();
	body.set('email', email);
	body.set('password', pw);
	const event = {
		request: new Request('http://localhost/login?/login', { method: 'POST', body }),
		cookies: { get: () => undefined, set: () => {}, delete: () => {} }
	} as unknown as Parameters<typeof actions.login>[0];
	try {
		const result = await actions.login(event);
		expect(result).toMatchObject({ status: 400 });
		return 'refused';
	} catch (e) {
		expect(e).toMatchObject({ status: 303, location: '/cards' });
		return 'in';
	}
}

async function fail(email: string, times: number) {
	for (let i = 0; i < times; i++) expect(await login(email, 'wrong')).toBe('refused');
}

describe.skipIf(!hasDb)('login throttle', () => {
	async function cleanup() {
		const emails = [alice, bob];
		await db.delete(table.loginThrottle).where(inArray(table.loginThrottle.email, emails));
		const users = await db
			.select({ id: table.user.id })
			.from(table.user)
			.where(inArray(table.user.email, emails));
		for (const { id } of users) {
			await db.delete(table.session).where(eq(table.session.userId, id));
			await db.delete(table.user).where(eq(table.user.id, id));
		}
	}

	beforeEach(cleanup);
	afterAll(async () => {
		await cleanup();
		Object.assign(process.env, env);
	});

	it('refuses the right password after five wrong ones, for that address only', async () => {
		await fail(alice, 5);
		expect(await login(alice, password)).toBe('refused');
		expect(await login(bob, password)).toBe('in');
	});

	it('lets the right password in once the window has passed', async () => {
		await fail(alice, 6);
		await db
			.update(table.loginThrottle)
			.set({ windowStart: sql`${table.loginThrottle.windowStart} - interval '16 minutes'` })
			.where(eq(table.loginThrottle.email, alice));
		expect(await login(alice, password)).toBe('in');
	});

	it('resets the count on a successful login', async () => {
		await fail(alice, 4);
		expect(await login(alice, password)).toBe('in');
		await fail(alice, 4);
		expect(await login(alice, password)).toBe('in');
	});

	it('counts guesses fired in parallel', async () => {
		const guesses = await Promise.all(Array.from({ length: 10 }, () => login(alice, 'wrong')));
		expect(guesses.every((g) => g === 'refused')).toBe(true);
		expect(await login(alice, password)).toBe('refused');
	});
});
