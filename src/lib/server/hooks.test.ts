import { beforeEach, describe, expect, it, vi } from 'vitest';

// No database here: the session lookup fails the way drizzle reports an outage, with
// the query and its params in the message and the driver error as the cause.
vi.mock('$lib/server/db', () => ({
	db: {},
	asTenant: vi.fn(async () => {
		throw new Error('asTenant must not run for a signed-out request');
	})
}));
vi.mock('$lib/server/auth', () => ({
	sessionCookieName: 'auth-session',
	validateSessionToken: vi.fn(async () => {
		throw new Error('Failed query: select ... from "session"\nparams: 5e55107dea5e', {
			cause: new Error('connect ECONNREFUSED 127.0.0.1:5432')
		});
	}),
	invalidateSession: vi.fn(),
	setSessionTokenCookie: vi.fn(),
	deleteSessionTokenCookie: vi.fn()
}));

const auth = await import('$lib/server/auth');
const { handle } = await import('../../hooks.server');

function event(path: string, method = 'GET') {
	return {
		url: new URL(`http://localhost${path}`),
		request: new Request(`http://localhost${path}`, { method }),
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
	});

	// The query error carries the session id (a hash of the token) and the SQL.
	it('logs the cause only, never the token, query or params', async () => {
		await handle({ event: event('/'), resolve: async () => new Response('page') });
		const logged = JSON.stringify(vi.mocked(console.error).mock.calls);
		expect(logged).toContain('ECONNREFUSED');
		expect(logged).not.toContain('stale-token');
		expect(logged).not.toContain('5e55107dea5e');
		expect(logged).not.toContain('select');
	});

	// Signing out every user would hide a broken query behind a login loop. Outside the
	// public pages the failure stays a failure.
	it('rethrows on pages that need a session', async () => {
		const resolve = vi.fn(async () => new Response('page'));
		await expect(handle({ event: event('/cards'), resolve })).rejects.toThrow('Failed query');
		expect(resolve).not.toHaveBeenCalled();
	});

	// A localhost URL makes node try ::1 and 127.0.0.1: the cause is an AggregateError
	// with an empty message and the code on the error itself.
	it('logs the error code when the cause has no message', async () => {
		vi.mocked(auth.validateSessionToken).mockRejectedValueOnce(
			new Error('Failed query', {
				cause: Object.assign(new AggregateError([], ''), { code: 'ECONNREFUSED' })
			})
		);
		await handle({ event: event('/'), resolve: async () => new Response('page') });
		expect(JSON.stringify(vi.mocked(console.error).mock.calls)).toContain('ECONNREFUSED');
	});

	// Logging out posts to /login. Rendering it signed out would clear the cookie and
	// report success while the session row lives on.
	it('rethrows on a public path when the request changes state', async () => {
		const resolve = vi.fn(async () => new Response('page'));
		await expect(handle({ event: event('/login?/logout', 'POST'), resolve })).rejects.toThrow(
			'Failed query'
		);
		expect(resolve).not.toHaveBeenCalled();
	});

	it('rethrows on API routes', async () => {
		const resolve = vi.fn(async () => new Response('page'));
		await expect(handle({ event: event('/api/review/grade'), resolve })).rejects.toThrow(
			'Failed query'
		);
		expect(resolve).not.toHaveBeenCalled();
	});
});
