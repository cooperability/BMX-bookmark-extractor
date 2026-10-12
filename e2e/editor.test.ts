// The card editor in a real browser against a real database, at a desktop and a
// phone width (ROADMAP CRD-A): create a card, find it by search, edit its back,
// and see the change in Study. Skips without DATABASE_URL.
//
// Signs in through a session row, as study.test.ts does. The web server must list
// E2E_EMAIL in ALLOWED_EMAILS (playwright.config.ts).
import { createHash, randomBytes } from 'node:crypto';
import { existsSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import postgres from 'postgres';

if (!process.env.DATABASE_URL && existsSync('.env')) process.loadEnvFile('.env');
const url = process.env.DATABASE_URL;
const E2E_EMAIL = 'e2e-editor@test.invalid';
const USER_ID = 'e2e-editor-user';
const TABLES = [
	'card_trash',
	'review_log',
	'review_state',
	'quest_runs',
	'edges',
	'assessments',
	'nodes',
	'session'
];

test.describe('card editor', () => {
	test.skip(!url, 'needs DATABASE_URL');
	test.describe.configure({ mode: 'serial' });

	const sql = url ? postgres(url, { onnotice: () => {} }) : null!;
	const token = randomBytes(18).toString('base64url');

	async function cleanup() {
		for (const t of TABLES) await sql`delete from ${sql(t)} where user_id = ${USER_ID}`;
		await sql`delete from "user" where id = ${USER_ID}`;
	}

	test.beforeAll(async () => {
		await cleanup();
		await sql`insert into "user" (id, email) values (${USER_ID}, ${E2E_EMAIL})`;
		const id = createHash('sha256').update(token).digest('hex');
		await sql`insert into session (id, user_id, expires_at) values (${id}, ${USER_ID}, now() + interval '1 day')`;
	});

	test.afterAll(async () => {
		await cleanup();
		await sql.end();
	});

	/** Replace a rich field's contents by typing, as a person would. */
	async function typeInto(page: Page, selector: string, text: string) {
		const field = page.locator(selector);
		await field.click();
		await page.keyboard.press('ControlOrMeta+a');
		await page.keyboard.type(text);
	}

	for (const [width, height] of [
		[1440, 900],
		[390, 844]
	]) {
		test(`create, search, edit and study at ${width}px`, async ({ page, context, baseURL }) => {
			const errors: string[] = [];
			page.on('pageerror', (e) => errors.push(e.message));
			await page.setViewportSize({ width, height });
			await context.addCookies([{ name: 'auth-session', value: token, url: baseURL! }]);
			// A deck per width: the second test must not resume the first one's round.
			const deck = `E2E Editor ${width}`;
			const marker = `zq${width}x`;

			await page.goto('/cards/browse?new=1');
			await page.locator('#edit-deck').fill(deck);
			await typeInto(page, '#edit-front', `Capital of France ${marker}?`);
			await typeInto(page, '#edit-back', 'Lyon');
			await page.locator('#edit-tags').fill('geo ');
			await page.getByRole('button', { name: /Add card/ }).click();
			await expect(page.getByText(`Added to ${deck}.`)).toBeVisible();

			if (width < 1024) {
				// The phone editor is a full-screen sheet. Close it to reach the list.
				await page.getByRole('link', { name: 'Close editor' }).click();
				const overflow = await page.evaluate(
					() => document.documentElement.scrollWidth - document.documentElement.clientWidth
				);
				expect(overflow).toBe(0);
			}

			await page.locator('#browse-q').fill(marker);
			const row = page.getByRole('link', { name: new RegExp(marker) });
			await expect(row).toHaveCount(1);
			await row.click();
			await expect(page).toHaveURL(/[?&]card=/);
			await expect(page.locator('#edit-back')).toHaveText('Lyon');
			await typeInto(page, '#edit-back', 'Paris');
			await page.getByRole('button', { name: /^Save/ }).click();
			await expect(page.getByText('Saved.')).toBeVisible();

			await page.goto(`/cards/study?deck=${encodeURIComponent(deck)}`);
			await page.keyboard.press('Space');
			await expect(page.locator('.card-html').filter({ hasText: 'Paris' })).toBeVisible();

			if (width >= 1024) {
				// E opens the current card, and Save comes back to the same round.
				await page.keyboard.press('e');
				await expect(page).toHaveURL(/\/cards\/browse\?card=.*&return=/);
				await typeInto(page, '#edit-back', 'Paris, on the Seine');
				await page.keyboard.press('ControlOrMeta+Enter');
				await expect(page).toHaveURL(/\/cards\/study\?deck=/);
				await page.keyboard.press('Space');
				await expect(page.getByText('Paris, on the Seine')).toBeVisible();
			}

			const [stored] =
				await sql`select tags from nodes where user_id = ${USER_ID} and deck = ${deck}`;
			expect(stored.tags).toEqual(['geo']);
			expect(errors).toEqual([]);
		});
	}
});
