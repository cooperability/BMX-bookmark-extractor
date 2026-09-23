import { expect, test } from '@playwright/test';

// hooks.server.ts gates every non-public pathname before SvelteKit's router runs, so a
// signed-out visit to an unmatched route never reaches the 404 the router would otherwise
// produce: it lands on /login first. That gate covers all four PUBLIC paths too (they all
// resolve normally), so +error.svelte's 404 branch has no anonymous entry point to test here.
test('signed-out visit to an unknown route redirects to login, not a raw 404', async ({ page }) => {
	const pageerrors: Error[] = [];
	page.on('pageerror', (e) => pageerrors.push(e));

	const response = await page.goto('/this-route-does-not-exist');

	expect(new URL(page.url()).pathname).toBe('/login');
	expect(response?.status()).toBe(200);
	expect(pageerrors).toEqual([]);
});
