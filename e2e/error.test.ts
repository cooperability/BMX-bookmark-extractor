// The branded error page. hooks.server.ts sends a signed-out visitor on any
// non-public path to /login before routing, so a signed-in visitor is how a 404 is
// normally reached. Signs in the way e2e/study.test.ts does: a session row plus its cookie.
import { createHash, randomBytes } from 'node:crypto';
import { existsSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import postgres from 'postgres';

if (!process.env.DATABASE_URL && existsSync('.env')) process.loadEnvFile('.env');
const url = process.env.DATABASE_URL;
// Not study.test.ts's address: user.email is unique and the files run in parallel.
const EMAIL = 'e2e-error@test.invalid';
const USER_ID = 'e2e-error-user';

test.describe('error page', () => {
	test.skip(!url, 'needs DATABASE_URL');

	const sql = url ? postgres(url, { onnotice: () => {} }) : null!;
	const token = randomBytes(18).toString('base64url');

	async function cleanup() {
		await sql`delete from session where user_id = ${USER_ID}`;
		await sql`delete from "user" where id = ${USER_ID}`;
	}

	test.beforeAll(async () => {
		await cleanup();
		await sql`insert into "user" (id, email) values (${USER_ID}, ${EMAIL})`;
		const id = createHash('sha256').update(token).digest('hex');
		await sql`insert into session (id, user_id, expires_at) values (${id}, ${USER_ID}, now() + interval '1 day')`;
	});

	test.afterAll(async () => {
		await cleanup();
		await sql.end();
	});

	test('a signed-in visitor on an unknown path gets the branded 404', async ({
		page,
		context,
		baseURL
	}) => {
		const errors: string[] = [];
		page.on('pageerror', (e) => errors.push(e.message));
		await context.addCookies([{ name: 'auth-session', value: token, url: baseURL! }]);

		const res = await page.goto('/cards/this-route-does-not-exist');
		expect(res?.status()).toBe(404);
		await expect(page.getByText('That page does not exist.')).toBeVisible();
		await expect(page.getByRole('link', { name: 'Go home' })).toHaveAttribute('href', '/');
		await expect(page.getByRole('link', { name: 'Open decks' })).toHaveAttribute('href', '/cards');
		await expect(page).toHaveTitle('404 · Remediate');
		await expect(page.getByRole('heading', { level: 1, name: '404' })).toBeVisible();
		expect(errors).toEqual([]);
	});

	// A route's own error() message says more than the generic line.
	test('a 404 raised by a route keeps its message', async ({ page, context, baseURL }) => {
		await context.addCookies([{ name: 'auth-session', value: token, url: baseURL! }]);
		const res = await page.goto('/cards/deck?deck=no-such-deck');
		expect(res?.status()).toBe(404);
		await expect(page.getByText('No cards in that deck.')).toBeVisible();
	});
});
