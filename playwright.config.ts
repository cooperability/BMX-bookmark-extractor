import { defineConfig } from '@playwright/test';

export default defineConfig({
	webServer: {
		command: 'npm run build && npm run preview',
		port: 4173,
		// e2e/study.test.ts signs in as this address through a session row it writes.
		env: { ALLOWED_EMAILS: 'e2e@test.invalid' }
	},
	use: {
		baseURL: 'http://localhost:4173',
		// A preinstalled Chromium whose build differs from this Playwright version.
		launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined }
	},
	testDir: 'e2e'
});
