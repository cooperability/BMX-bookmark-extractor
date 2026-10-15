import { expect, test } from '@playwright/test';

test('home page has expected h1', async ({ page }) => {
	await page.goto('/');
	await expect(page.locator('h1')).toBeVisible();
});

// The landing demo runs the real study components in the browser, signed out.
test('landing demo round: flip, relearn, finish, restart', async ({ page }) => {
	const errors: string[] = [];
	page.on('pageerror', (e) => errors.push(e.message));
	await page.goto('/');

	const demo = page.getByRole('group', { name: 'Demo study round' });
	await demo.scrollIntoViewIfNeeded();
	await expect(demo.getByText('0 / 5')).toBeVisible();

	// First card by mouse, graded Again, so it must come back.
	await demo.getByRole('button', { name: /Show answer/ }).click();
	await demo.getByRole('button', { name: /Again/ }).click();
	await expect(demo.getByText('1 / 5')).toBeVisible();

	// The rest by keyboard, straight after the clicks: the clicked buttons unmount,
	// and the shortcuts must still reach the demo.
	for (let i = 0; i < 4; i++) {
		await page.keyboard.press('Space');
		await page.keyboard.press('3');
	}
	await expect(demo.getByText('relearning')).toBeVisible();
	await page.keyboard.press('Space');
	await page.keyboard.press('3');

	await expect(demo.getByText('Round score')).toBeVisible();
	// 4 Good and 1 Again on first attempts: 4 / 5.
	await expect(demo.getByText('80%', { exact: true })).toBeVisible();
	// Signed out, the map is behind a login: the demo offers no way there.
	await expect(demo.getByRole('link', { name: 'Explore the map' })).toHaveCount(0);

	await demo.getByRole('button', { name: 'Next round' }).click();
	await expect(demo.getByText('0 / 5')).toBeVisible();
	await page.keyboard.press('Space');
	await expect(demo.getByRole('button', { name: /Good/ })).toBeVisible();
	expect(errors).toEqual([]);
});

// The server-rendered button has no handler until hydration. Slow the app's scripts so a
// click lands in that window every run, instead of on a slow CI runner now and then.
test('landing demo: Show answer clicked before hydration still flips', async ({ page }) => {
	await page.route('**/_app/immutable/**/*.js', async (route) => {
		await new Promise((r) => setTimeout(r, 2000));
		await route.continue();
	});
	await page.goto('/', { waitUntil: 'commit' });

	const demo = page.getByRole('group', { name: 'Demo study round' });
	await demo.getByRole('button', { name: /Show answer/ }).click();
	await expect(demo.getByRole('button', { name: /Again/ })).toBeVisible();
});
