import { hasDb } from './testing/db';
import { describe, expect, it } from 'vitest';

const { handle } = hasDb
	? await import('../../hooks.server')
	: ({} as typeof import('../../hooks.server'));

function event(path: string) {
	return {
		url: new URL(`http://localhost${path}`),
		cookies: { get: () => undefined, set: () => {}, delete: () => {} },
		locals: {}
	} as unknown as Parameters<typeof handle>[0]['event'];
}
const resolve = async () => new Response('page');

describe.skipIf(!hasDb)('auth hook without a session', () => {
	it('answers API routes with 401 JSON instead of a redirect', async () => {
		const res = await handle({ event: event('/api/review/grade'), resolve });
		expect(res.status).toBe(401);
		expect(await res.json()).toEqual({ message: 'Log in again.' });
	});

	it('redirects pages to /login', async () => {
		await expect(handle({ event: event('/cards'), resolve })).rejects.toMatchObject({
			status: 303,
			location: '/login'
		});
	});

	it('lets public paths through', async () => {
		const res = await handle({ event: event('/api/health'), resolve });
		expect(await res.text()).toBe('page');
	});
});
