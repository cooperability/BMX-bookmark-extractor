import { afterEach, describe, expect, it, vi } from 'vitest';

// hooks.server.ts imports this module, so a throw at import fails every route on
// the deployment, the public landing page and /api/health included.
describe('db without DATABASE_URL', () => {
	const saved = process.env.DATABASE_URL;
	afterEach(() => {
		if (saved === undefined) delete process.env.DATABASE_URL;
		else process.env.DATABASE_URL = saved;
		vi.resetModules();
	});

	it('imports, and refuses queries with a clear error', async () => {
		delete process.env.DATABASE_URL;
		vi.resetModules();
		const mod = await import('./index');
		expect(() => mod.db.select()).toThrow('DATABASE_URL is not set');
		await expect(mod.asTenant('u', async () => 1)).rejects.toThrow('DATABASE_URL is not set');
	});
});
