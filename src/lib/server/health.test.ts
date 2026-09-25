import { beforeEach, describe, expect, it, vi } from 'vitest';

const execute = vi.fn();
vi.mock('$lib/server/db', () => ({ db: { execute: (...a: unknown[]) => execute(...a) } }));

const { databaseStatus } = await import('./health');

describe('databaseStatus', () => {
	// A block body: vitest runs a function returned from beforeEach as teardown.
	beforeEach(() => {
		execute.mockReset();
	});

	it('is ok when the database answers', async () => {
		execute.mockResolvedValue([{ '?column?': 1 }]);
		expect(await databaseStatus()).toBe('ok');
	});

	// DATABASE_URL unset reaches here only once db/index.ts checks it on use (#311).
	it('is down when the query fails', async () => {
		execute.mockImplementation(() => {
			throw new Error('DATABASE_URL is not set');
		});
		expect(await databaseStatus()).toBe('down');
	});

	// An unreachable host can hold a connect attempt for 30 s. The probe must not.
	it('is down when the database does not answer in time', async () => {
		execute.mockReturnValue(new Promise(() => {}));
		const started = Date.now();
		expect(await databaseStatus(50)).toBe('down');
		expect(Date.now() - started).toBeLessThan(1000);
	});
});
