import { hasDb } from './testing/db';
import { eq } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import * as table from './db/schema';

const { db } = hasDb ? await import('./db') : ({} as typeof import('./db'));
const otp = hasDb ? await import('./otp') : ({} as typeof import('./otp'));

const MINUTE = 60_000;
const t0 = new Date('2026-09-01T12:00:00Z');
const at = (m: number) => new Date(t0.getTime() + m * MINUTE);

describe.skipIf(!hasDb)('login codes against the database', () => {
	const email = `otp-${crypto.randomUUID().slice(0, 8)}@test.invalid`;

	async function cleanup() {
		await db.delete(table.loginCode).where(eq(table.loginCode.email, email));
		await db.delete(table.loginThrottle).where(eq(table.loginThrottle.email, email));
	}
	beforeEach(cleanup);
	afterAll(cleanup);

	const wrong = (code: string) => (code === '000000' ? '111111' : '000000');

	it('accepts the right code once', async () => {
		const code = (await otp.issueCode(email, at(0)))!;
		expect(await otp.verifyCode(email, code, at(1))).toBe(true);
		expect(await otp.verifyCode(email, code, at(1))).toBe(false);
	});

	it('refuses a resend within a minute', async () => {
		expect(await otp.issueCode(email, at(0))).not.toBeNull();
		expect(await otp.issueCode(email, at(0.5))).toBeNull();
		expect(await otp.issueCode(email, at(1.5))).not.toBeNull();
	});

	it('issues one code when several sends race', async () => {
		const codes = await Promise.all(Array.from({ length: 10 }, () => otp.issueCode(email, at(0))));
		const issued = codes.filter((c) => c !== null);
		expect(issued).toHaveLength(1);
		expect(await otp.verifyCode(email, issued[0]!, at(1))).toBe(true);
	});

	it(`stops issuing after MAX_SENDS codes in a day, and resumes the next day`, async () => {
		for (let i = 0; i < otp.MAX_SENDS; i++)
			expect(await otp.issueCode(email, at(i * 2))).not.toBeNull();
		expect(await otp.issueCode(email, at(otp.MAX_SENDS * 2))).toBeNull();
		expect(await otp.issueCode(email, at(24 * 60 + 1))).not.toBeNull();
	});

	it('refuses even the right code once the address has MAX_FAILURES misses today', async () => {
		// New codes reset the per-code limit; the daily budget spans them.
		let minute = 0;
		let failures = 0;
		while (failures < otp.MAX_FAILURES) {
			const code = (await otp.issueCode(email, at(minute)))!;
			for (let i = 0; i < 4 && failures < otp.MAX_FAILURES; i++, failures++) {
				expect(await otp.verifyCode(email, wrong(code), at(minute))).toBe(false);
			}
			minute += 2;
		}
		// Sends are not exhausted: 5 codes for 20 failures.
		const code = (await otp.issueCode(email, at(minute)))!;
		expect(code).not.toBeNull();
		expect(await otp.verifyCode(email, code, at(minute))).toBe(false);

		// The window lapses a day after it opened.
		const next = (await otp.issueCode(email, at(24 * 60 + 1)))!;
		expect(await otp.verifyCode(email, next, at(24 * 60 + 1))).toBe(true);
	});
});
