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

			// Ctrl+Delete in a field deletes a word, never the card. A save after it
			// is the barrier: a delete it fired would have been sent first.
			const deletes: string[] = [];
			page.on('request', (r) => {
				if (r.method() === 'POST' && r.url().includes('/delete')) deletes.push(r.url());
			});
			await page.locator('#edit-back').click();
			await page.keyboard.press('End');
			await page.keyboard.press('ControlOrMeta+Delete');
			await Promise.all([
				page.waitForResponse((r) => r.url().includes('/save') && r.request().method() === 'POST'),
				page.keyboard.press('ControlOrMeta+Enter')
			]);
			expect(deletes).toEqual([]);
			await expect(page).toHaveURL(/[?&]card=/);

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

			// kind = 'card': the Quest graph keeps a concept row with the same deck and no tags.
			const [stored] =
				await sql`select tags from nodes where user_id = ${USER_ID} and deck = ${deck} and kind = 'card'`;
			expect(stored.tags).toEqual(['geo']);
			expect(errors).toEqual([]);
		});
	}

	test('side actions keep the filters and the open card', async ({ page, context, baseURL }) => {
		await page.setViewportSize({ width: 1440, height: 900 });
		await context.addCookies([{ name: 'auth-session', value: token, url: baseURL! }]);
		const deck = 'E2E Editor actions';
		const [a, b] = ['e2e-editor-a', 'e2e-editor-b'];
		await sql`insert into nodes (id, user_id, deck, front, back) values
			(${a}, ${USER_ID}, ${deck}, 'alpha front', 'alpha back'),
			(${b}, ${USER_ID}, ${deck}, 'beta front', 'beta back')`;
		const dialogs: string[] = [];
		page.on('dialog', (d) => {
			dialogs.push(d.message());
			void d.dismiss();
		});
		const start = `/cards/browse?deck=${encodeURIComponent(deck)}&sort=created&card=${a}`;
		const here = () => new URL(page.url()).pathname + new URL(page.url()).search;
		await page.goto(start);
		const bulk = page.getByRole('region', { name: 'Bulk actions' });

		// Each filter shows its whole label beside the open editor.
		const clipped = await page.locator('#browse-q').evaluate((q) =>
			[...q.form!.querySelectorAll('select')].flatMap((s) => {
				const css = getComputedStyle(s);
				const ctx = document.createElement('canvas').getContext('2d')!;
				ctx.font = css.font;
				const room = s.clientWidth - parseFloat(css.paddingLeft) - parseFloat(css.paddingRight);
				const label = s.selectedOptions[0].text;
				return ctx.measureText(label).width > room ? [label] : [];
			})
		);
		expect(clipped).toEqual([]);

		// The editor's shortcuts belong to the editor. In the search box they do nothing.
		const saves: string[] = [];
		page.on('request', (r) => {
			if (r.method() === 'POST' && r.url().includes('/save')) saves.push(r.url());
		});
		await page.locator('#browse-q').focus();
		await page.keyboard.press('ControlOrMeta+Enter');
		await page.keyboard.press('Escape');
		await page.waitForLoadState('networkidle');
		expect(saves).toEqual([]);
		expect(here()).toBe(start);

		await page.locator(`[data-row="${b}"] input[type=checkbox]`).check();
		await bulk.getByRole('button', { name: 'Suspend', exact: true }).click();
		await expect(page.getByText('Suspended 1 card.')).toBeVisible();
		expect(here()).toBe(start);

		// Ctrl+J with unsaved text: no discard prompt, and the text is still there.
		await typeInto(page, '#edit-back', 'unsaved words');
		await page.keyboard.press('ControlOrMeta+j');
		await expect(page.getByRole('heading', { name: /Edit card\s+suspended/ })).toBeVisible();
		await expect(page.locator('#edit-back')).toHaveText('unsaved words');
		await page.getByRole('button', { name: 'Revert' }).click();

		await page.getByTitle('Flag').click();
		await page.getByRole('button', { name: 'Purple' }).click();
		await expect(page.locator(`summary[aria-label="Flag: Purple"]`)).toBeVisible();
		expect(here()).toBe(start);

		await page.locator(`[data-row="${b}"] input[type=checkbox]`).check();
		await bulk.getByRole('button', { name: 'Delete', exact: true }).click();
		await bulk.getByRole('button', { name: 'Delete 1 card' }).click();
		await expect(page.locator(`[data-row="${b}"]`)).toHaveCount(0);
		// A double click is one Undo. The second must not report the spent trash as a failure.
		await page.getByRole('button', { name: 'Undo' }).dblclick();
		await expect(page.getByText('Restored 1 card.')).toBeVisible();
		await page.waitForLoadState('networkidle');
		await expect(page.getByRole('status').filter({ hasText: 'Restored 1 card.' })).toBeVisible();
		await expect(page.locator(`[data-row="${b}"]`)).toHaveCount(1);
		expect(here()).toBe(start);
		expect(dialogs).toEqual([]);

		const rows =
			await sql`select id, flag, suspended from nodes where id in ${sql([a, b])} order by id`;
		expect(rows).toEqual([
			{ id: a, flag: 7, suspended: true },
			{ id: b, flag: 0, suspended: true }
		]);
	});

	test('a double Ctrl+Enter adds one card, with the tag still being typed', async ({
		page,
		context,
		baseURL
	}) => {
		await page.setViewportSize({ width: 1440, height: 900 });
		await context.addCookies([{ name: 'auth-session', value: token, url: baseURL! }]);
		const deck = 'E2E Editor twice';
		await page.goto('/cards/browse?new=1');
		await page.locator('#edit-deck').fill(deck);
		await typeInto(page, '#edit-front', 'pressed twice');
		const saves: string[] = [];
		page.on('request', (r) => {
			if (r.method() === 'POST' && r.url().includes('/save')) saves.push(r.url());
		});
		await page.locator('#edit-tags').fill('halfway');
		await page.keyboard.press('ControlOrMeta+Enter');
		await page.keyboard.press('ControlOrMeta+Enter');
		await expect(page.getByText(`Added to ${deck}.`)).toBeVisible();
		await page.waitForLoadState('networkidle');
		expect(saves).toHaveLength(1);
		const rows =
			await sql`select tags from nodes where user_id = ${USER_ID} and deck = ${deck} and kind = 'card'`;
		expect(rows).toEqual([{ tags: ['halfway'] }]);
	});

	test('keyboard shortcuts, and pasted or typed HTML is sanitized', async ({
		page,
		context,
		baseURL
	}) => {
		await page.setViewportSize({ width: 1440, height: 900 });
		await context.addCookies([{ name: 'auth-session', value: token, url: baseURL! }]);
		const dialogs: string[] = [];
		page.on('dialog', (d) => {
			dialogs.push(d.message());
			void d.dismiss();
		});
		const deck = 'E2E Editor keys';
		const [k1, k2, k3] = ['e2e-keys-1', 'e2e-keys-2', 'e2e-keys-3'];
		// Newest first under sort=created: k3, k2, k1.
		await sql`insert into nodes (id, user_id, deck, front, back, created_at) values
			(${k1}, ${USER_ID}, ${deck}, 'one', 'b', now() - interval '3 minutes'),
			(${k2}, ${USER_ID}, ${deck}, 'two', 'b', now() - interval '2 minutes'),
			(${k3}, ${USER_ID}, ${deck}, 'three', 'b', now() - interval '1 minute')`;
		await page.goto(`/cards/browse?deck=${encodeURIComponent(deck)}&sort=created`);
		// Keys reach the page's handlers once it has hydrated.
		await page.waitForLoadState('networkidle');

		await page.keyboard.press('/');
		await expect(page.locator('#browse-q')).toBeFocused();
		await page.locator('#browse-q').blur();

		await page.keyboard.press('j');
		await expect(page).toHaveURL(new RegExp(`card=${k3}`));
		await page.keyboard.press('j');
		await expect(page).toHaveURL(new RegExp(`card=${k2}`));
		await page.keyboard.press('k');
		await expect(page).toHaveURL(new RegExp(`card=${k3}`));

		const preview = page.getByRole('tab', { name: /Preview/ });
		await page.keyboard.press('ControlOrMeta+Shift+p');
		await expect(preview).toHaveAttribute('aria-selected', 'true');
		await page.keyboard.press('ControlOrMeta+Shift+p');
		await expect(preview).toHaveAttribute('aria-selected', 'false');

		await page.keyboard.press('Escape');
		await expect(page).not.toHaveURL(/card=/);
		await page.keyboard.press('n');
		await expect(page).toHaveURL(/new=1/);
		await expect(page.getByRole('heading', { name: 'New card' })).toBeVisible();

		// Paste goes through the card sanitizer before it reaches the field.
		const front = page.locator('div#edit-front');
		await front.click();
		await front.evaluate((el) => {
			const data = new DataTransfer();
			data.setData('text/html', '<b>bold</b><img src="https://a.test/x.png" onerror="alert(1)">');
			data.setData('text/plain', 'bold');
			el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true }));
		});
		await expect(front.locator('b')).toHaveText('bold');
		expect(await front.innerHTML()).not.toMatch(/onerror/);

		// Ctrl+Shift+X shows the HTML source, and leaving it sanitizes what was typed there.
		await page.keyboard.press('ControlOrMeta+Shift+x');
		const source = page.locator('textarea#edit-front');
		await expect(source).toHaveValue(/<b>bold<\/b>/);
		await source.fill('<i>it</i><img src="https://a.test/y.png" onerror="alert(2)">');
		await source.press('ControlOrMeta+Shift+x');
		await expect(front.locator('i')).toHaveText('it');
		expect(await front.innerHTML()).not.toMatch(/onerror/);
		expect(dialogs).toEqual([]);
	});

	test('a re-import keeps a card edited here, and says so', async ({ page, context, baseURL }) => {
		await page.setViewportSize({ width: 1440, height: 900 });
		await context.addCookies([{ name: 'auth-session', value: token, url: baseURL! }]);
		const deck = 'E2E Editor import';
		const tsv = (front: string) =>
			`#separator:tab\n#html:true\n#guid column:1\n#deck column:2\ne2eKeepGuid\t${deck}\t${front}\tback\n`;
		async function upload(front: string) {
			await page.goto('/cards');
			await page.getByLabel('Anki export').setInputFiles({
				name: 'deck.txt',
				mimeType: 'text/plain',
				buffer: Buffer.from(tsv(front))
			});
			await page.getByRole('button', { name: 'Import deck' }).click();
		}

		await upload('from anki');
		await expect(page.getByText('Imported 1 cards.')).toBeVisible();
		const [{ id }] =
			await sql`select id from nodes where user_id = ${USER_ID} and deck = ${deck} and kind = 'card'`;
		await page.goto(`/cards/browse?card=${id}`);
		await typeInto(page, '#edit-front', 'fixed here');
		await page.keyboard.press('ControlOrMeta+Enter');
		await expect(page.getByText('Saved.')).toBeVisible();

		await upload('from anki again');
		await expect(page.getByText(/Imported 0 cards\. Kept your edits to 1/)).toBeVisible();
		const [row] = await sql`select front from nodes where id = ${id}`;
		expect(row.front).toBe('fixed here');
	});
});
