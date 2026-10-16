// The study loop in a real browser against a real database: import, grade,
// reload mid-round, relearn, finish, next round. Skips without DATABASE_URL.
//
// Logging in by email needs the dev console, so the test writes a session row
// directly, in the shape auth.createSession writes, and sets its cookie. The
// web server must list E2E_EMAIL in ALLOWED_EMAILS (playwright.config.ts).
import { createHash, randomBytes } from 'node:crypto';
import { existsSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import postgres from 'postgres';

if (!process.env.DATABASE_URL && existsSync('.env')) process.loadEnvFile('.env');
const url = process.env.DATABASE_URL;
const E2E_EMAIL = 'e2e@test.invalid';
const USER_ID = 'e2e-user';
const TABLES = [
	'review_log',
	'review_state',
	'quest_runs',
	'edges',
	'assessments',
	'nodes',
	'session'
];

test.describe('study round', () => {
	test.skip(!url, 'needs DATABASE_URL');

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

	/** Flip, rate, and wait for the server to store the grade. */
	async function grade(page: Page, key: string) {
		// Keys are ignored while the previous grade is in flight, so wait for each state.
		await expect(page.getByRole('button', { name: /Show answer/ })).toBeVisible();
		await page.keyboard.press('Space');
		await expect(page.getByRole('button', { name: /Good/ })).toBeEnabled();
		await Promise.all([
			page.waitForResponse((r) => r.url().endsWith('/api/review/grade') && r.ok()),
			page.keyboard.press(key)
		]);
	}

	test('import, grade, reload, relearn, finish, next round', async ({ page, context, baseURL }) => {
		const errors: string[] = [];
		page.on('pageerror', (e) => errors.push(e.message));
		await context.addCookies([{ name: 'auth-session', value: token, url: baseURL! }]);

		await page.goto('/cards');
		await page.setInputFiles(
			'input[type=file]',
			'source_data/CompSci (AIML_Web3_Math_Logic_Tech).txt'
		);
		await page.getByRole('button', { name: 'Import deck' }).click();
		await expect(page.getByText('Imported 137 cards.')).toBeVisible();

		// New cards are not due, so Up next offers a round in the new deck by name.
		await expect(page.getByText('All caught up')).toBeVisible();
		await page.getByRole('link', { name: /^Study \S/ }).click();
		const counter = page.locator('header .font-mono').first();
		await expect(counter).toHaveText('0 / 20');

		// Anki cards use <code> for literal code. The typography plugin's decorative
		// backticks around it read as part of the answer.
		const tick = await page
			.locator('.card-html')
			.first()
			.evaluate((el) => {
				const code = el.appendChild(document.createElement('code'));
				const content = getComputedStyle(code, '::before').content;
				code.remove();
				return content;
			});
		expect(tick).toBe('none');

		// Each rating shows the interval it would schedule. A new card: minutes for
		// Again, days for Easy. A tap on the question reveals it, clear of any link inside.
		await page.locator('.scene').click({ position: { x: 8, y: 8 } });
		await expect(page.getByRole('button', { name: /Again/ })).toContainText(/\d+m/);
		await expect(page.getByRole('button', { name: /Easy/ })).toContainText(/\d+d/);
		await Promise.all([
			page.waitForResponse((r) => r.url().endsWith('/api/review/grade') && r.ok()),
			page.keyboard.press('1') // Again: owed one relearning repeat
		]);
		await grade(page, '3');
		await expect(counter).toHaveText('2 / 20');

		// A reload resumes the same round rather than opening a new one.
		await page.reload();
		await expect(counter).toHaveText('2 / 20');

		// A keyboard user who tabs to a rating and presses Enter gets that rating: the
		// window shortcut must not swallow Enter as a flip.
		await page.keyboard.press('Space');
		await page.getByRole('button', { name: /Good/ }).focus();
		await Promise.all([
			page.waitForResponse((r) => r.url().endsWith('/api/review/grade') && r.ok()),
			page.keyboard.press('Enter')
		]);
		await expect(counter).toHaveText('3 / 20');

		// 17 more untried cards, then the missed one comes back marked as relearning.
		for (let i = 0; i < 17; i++) await grade(page, '3');
		await expect(counter).toHaveText('20 / 20');
		await expect(page.getByText('relearning')).toBeVisible();
		await grade(page, '3');

		// First attempts only: 19 of 20 recalled.
		await expect(page.getByText('Round score')).toBeVisible();
		await expect(page.getByText('95%').first()).toBeVisible();
		await expect(page.getByRole('link', { name: 'Explore the map' })).toHaveAttribute(
			'href',
			'/quest'
		);

		await page.getByRole('button', { name: 'Next round' }).click();
		await expect(counter).toHaveText('0 / 20');
		expect(errors).toEqual([]);
	});

	test('a deck card opens Browse on its deck, and Browse offers to study it', async ({
		page,
		context,
		baseURL
	}) => {
		await context.addCookies([{ name: 'auth-session', value: token, url: baseURL! }]);
		await page.goto('/cards');
		await page
			.getByRole('link', { name: /^Browse \S/ })
			.first()
			.click();
		await page.waitForURL(/\/cards\/browse\?deck=/);
		const deck = new URL(page.url()).searchParams.get('deck')!;
		await expect(page.getByRole('link', { name: 'Study', exact: true })).toHaveAttribute(
			'href',
			`/cards/study?deck=${encodeURIComponent(deck)}`
		);
	});

	test('Up next counts the cards due and offers their deck', async ({ page, context, baseURL }) => {
		await context.addCookies([{ name: 'auth-session', value: token, url: baseURL! }]);
		await sql`update review_state set due = now() - interval '1 minute' where user_id = ${USER_ID}`;
		await page.goto('/cards');
		await expect(page.getByText(/^\d+ cards due$/)).toBeVisible();
		await expect(page.getByText(/^Start with/)).toContainText(/,\s+\d+ due\./);
		await expect(page.getByRole('link', { name: /^Study \S/ })).toBeVisible();
	});

	// Runs after the round above, so the dashboard has a deck to show.
	test('signed-in pages fit a phone screen', async ({ page, context, baseURL }) => {
		await context.addCookies([{ name: 'auth-session', value: token, url: baseURL! }]);
		const overflow = () => page.evaluate(() => document.documentElement.scrollWidth - innerWidth);

		// 320 is the WCAG reflow width.
		for (const width of [375, 320]) {
			await page.setViewportSize({ width, height: 800 });
			await page.goto('/cards');
			await expect(page.getByRole('navigation', { name: 'Views' })).toBeVisible();
			expect(await overflow(), `/cards at ${width}px`).toBe(0);
			// A squeezed top bar wraps instead of overflowing, so check the items too.
			const account = (await page.getByLabel('Account').boundingBox())!;
			const toggle = (await page.getByRole('group', { name: 'Theme' }).boundingBox())!;
			expect(account.y + account.height, `top bar on one line at ${width}px`).toBeLessThan(56);
			expect(
				account.x + account.width,
				`account menu inside the gutter at ${width}px`
			).toBeLessThanOrEqual(width - 16);
			expect(toggle.x + toggle.width, `toggle left of the menu at ${width}px`).toBeLessThanOrEqual(
				account.x
			);
			await page.getByLabel('Account').click();
			// A trial click hit-tests the button: it fails if the page paints over the menu.
			const logOut = page.getByRole('button', { name: 'Log out' });
			await logOut.click({ trial: true, timeout: 2000 });
			await page.keyboard.press('Escape');
			await expect(logOut).toBeHidden();
			// A tap on plain content closes it. x 4 is the page gutter, clear of the panel.
			await page.getByLabel('Account').click();
			await expect(logOut).toBeVisible();
			await page.mouse.click(4, 400);
			await expect(logOut).toBeHidden();

			const tabs = page.getByRole('navigation', { name: 'Views' });
			await tabs.getByRole('link', { name: 'Browse' }).click();
			await page.waitForURL(/\/cards\/browse/);
			await expect(tabs.getByRole('link', { name: 'Browse' })).toHaveAttribute(
				'aria-current',
				'page'
			);
			// The layout outlives the page, so the menu must close on navigation itself.
			await page.getByLabel('Account').click();
			await expect(logOut).toBeVisible();
			await page.goBack();
			await page.waitForURL(/\/cards$/);
			await expect(logOut).toBeHidden();

			await page.getByRole('link', { name: 'Details' }).first().click();
			await page.waitForURL(/\/cards\/deck/);
			expect(await overflow(), `deck page at ${width}px`).toBe(0);
			// Reviewed and Stability drop out, each header with its cells.
			await expect(page.getByRole('columnheader', { name: 'Reviewed' })).toBeHidden();
			const shown = (row: string) => page.locator(`${row} > :is(th, td):visible`);
			await expect(shown('thead tr')).toHaveCount(3);
			await expect(shown('tbody tr:first-child')).toHaveCount(3);
		}
	});

	// The details element opens natively before hydration. Hydration must not shut it
	// under the thumb that opened it. Slow the scripts so the tap lands first every run.
	test('account menu opened before hydration stays open', async ({ page, context, baseURL }) => {
		await context.addCookies([{ name: 'auth-session', value: token, url: baseURL! }]);
		await page.route('**/_app/immutable/**/*.js', async (route) => {
			await new Promise((r) => setTimeout(r, 2000));
			await route.continue();
		});
		await page.goto('/cards', { waitUntil: 'commit' });
		await page.getByLabel('Account').click();
		const logOut = page.getByRole('button', { name: 'Log out' });
		await expect(logOut).toBeVisible();
		await page.waitForLoadState('networkidle');
		await expect(logOut).toBeVisible();
	});

	test('Browse folds its filters behind one button on a phone', async ({
		page,
		context,
		baseURL
	}) => {
		await context.addCookies([{ name: 'auth-session', value: token, url: baseURL! }]);
		await page.setViewportSize({ width: 375, height: 800 });
		// Slow the scripts: the server-rendered page must fold them already, or the card
		// list jumps up at hydration.
		await page.route('**/_app/immutable/**/*.js', async (route) => {
			await new Promise((r) => setTimeout(r, 2000));
			await route.continue();
		});
		await page.goto('/cards/browse?state=new', { waitUntil: 'commit' });
		const deck = page.locator('#browse-deck');
		await expect(deck).toBeAttached();
		// Unstyled, everything would read as hidden.
		await page.waitForFunction(() =>
			[...document.querySelectorAll<HTMLLinkElement>('link[rel=stylesheet]')].every((l) => l.sheet)
		);
		// Checked once, not retried: a retry would pass on the fold hydration makes.
		expect(await deck.isVisible()).toBe(false);

		const filters = page.getByRole('button', { name: 'Filters, 1 set' });
		await expect(filters).toBeEnabled();
		await filters.click();
		await expect(filters).toHaveAttribute('aria-expanded', 'true');
		await expect(deck).toBeVisible();
	});

	// Runs last among the signed-in tests: it removes the deck the others use.
	test('deletes a deck after confirmation', async ({ page, context, baseURL }) => {
		await context.addCookies([{ name: 'auth-session', value: token, url: baseURL! }]);
		await page.goto('/cards');
		await page.getByRole('link', { name: 'Details' }).first().click();
		await page.waitForURL(/\/cards\/deck/);
		await page.getByRole('checkbox', { name: /Delete \d+ cards/ }).check();
		await page.getByRole('button', { name: 'Delete deck' }).click();
		await page.waitForURL(/\/cards\?deleted=/);
		await expect(page.getByRole('status')).toContainText('Deleted');
		await expect(page.getByText('No decks yet')).toBeVisible();
	});

	// Also covers a file chosen before hydration: the server-rendered form must submit.
	test.describe('without JavaScript', () => {
		test.use({ javaScriptEnabled: false });

		test('imports a deck', async ({ page, context, baseURL }) => {
			await context.addCookies([{ name: 'auth-session', value: token, url: baseURL! }]);
			await page.goto('/cards');
			await page.setInputFiles(
				'input[type=file]',
				'source_data/CompSci (AIML_Web3_Math_Logic_Tech).txt'
			);
			await page.getByRole('button', { name: 'Import deck' }).click();
			await expect(page.getByText('Imported 137 cards.')).toBeVisible();
		});

		test('Browse shows its filters on a phone', async ({ page, context, baseURL }) => {
			await context.addCookies([{ name: 'auth-session', value: token, url: baseURL! }]);
			await page.setViewportSize({ width: 375, height: 800 });
			await page.goto('/cards/browse');
			await expect(page.locator('#browse-deck')).toBeVisible();
			await expect(page.getByRole('button', { name: /^Filters/ })).toBeHidden();
		});

		// Runs last: it ends the session the other tests sign in with.
		test('logs out from the account menu', async ({ page, context, baseURL }) => {
			await context.addCookies([{ name: 'auth-session', value: token, url: baseURL! }]);
			await page.setViewportSize({ width: 375, height: 800 });
			await page.goto('/cards');
			await page.getByLabel('Account').click();
			await page.getByRole('button', { name: 'Log out' }).click();
			await expect(page).toHaveURL('/login');
			const [{ n }] = await sql`select count(*)::int as n from session where user_id = ${USER_ID}`;
			expect(n).toBe(0);
		});
	});
});
