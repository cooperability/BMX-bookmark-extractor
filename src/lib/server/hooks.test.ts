import { beforeEach, describe, expect, it, vi } from 'vitest';

// No database here: the session lookup fails the way it does during an outage.
vi.mock('$lib/server/db', () => ({
	db: {},
	asTenant: vi.fn(async () => {
		throw new Error('asTenant must not run for a signed-out request');
	})
}));
vi.mock('$lib/server/auth', () => ({
	sessionCookieName: 'auth-session',
	validateSessionToken: vi.fn(async () => {
		throw new Error('connect ECONNREFUSED');
	}),
	invalidateSession: vi.fn(),
	setSessionTokenCookie: vi.fn(),
	deleteSessionTokenCookie: vi.fn()
}));

const auth = await import('$lib/server/auth');
const { handle } = await import('../../hooks.server');

function event(path: string) {
	return {
		url: new URL(`http://localhost${path}`),
		cookies: {
			get: (name: string) => (name === 'auth-session' ? 'stale-token' : undefined),
			set: () => {},
			delete: () => {}
		},
		locals: {} as Record<string, unknown>
	} as unknown as Parameters<typeof handle>[0]['event'];
}

describe('auth hook when the session lookup throws', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.spyOn(console, 'error').mockImplementation(() => {});
	});

	it('still renders the public landing page, signed out', async () => {
		const e = event('/');
		const resolve = vi.fn(async () => new Response('page'));
		const res = await handle({ event: e, resolve });
		expect(resolve).toHaveBeenCalledOnce();
		expect(await res.text()).toBe('page');
		expect(e.locals.user).toBeNull();
		expect(e.locals.session).toBeNull();
		expect(auth.deleteSessionTokenCookie).not.toHaveBeenCalled();
		expect(console.error).toHaveBeenCalledOnce();
		expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain('stale-token');
	});

	it('redirects pages to /login', async () => {
		const resolve = vi.fn(async () => new Response('page'));
		await expect(handle({ event: event('/cards'), resolve })).rejects.toMatchObject({
			status: 303,
			location: '/login'
		});
		expect(resolve).not.toHaveBeenCalled();
	});

	it('answers API routes with 401', async () => {
		const resolve = vi.fn(async () => new Response('page'));
		const res = await handle({ event: event('/api/review/grade'), resolve });
		expect(res.status).toBe(401);
		expect(resolve).not.toHaveBeenCalled();
	});
});
