import { eq, lt, sql } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { loginThrottle } from '$lib/server/db/schema';

/** Failed logins one address gets per window. A lockout lasts at most one window. */
const MAX_FAILURES = 5;
const windowStart = sql`now() - interval '15 minutes'`;

/**
 * Takes one login attempt for `email` and says whether it may proceed. Counting
 * before the password check means parallel guesses each take a slot, so a burst
 * cannot slip past the limit. Every address is counted, allowlisted or not, so
 * the database work does not reveal the allowlist.
 */
export async function takeLoginAttempt(email: string): Promise<boolean> {
	// Expired rows go first, so the upsert below only ever extends a live window,
	// and addresses an attacker sprays do not pile up.
	await db.delete(loginThrottle).where(lt(loginThrottle.windowStart, windowStart));
	const [row] = await db
		.insert(loginThrottle)
		.values({ email, windowStart: sql`now()`, failures: 1 })
		.onConflictDoUpdate({
			target: loginThrottle.email,
			set: { failures: sql`${loginThrottle.failures} + 1` }
		})
		.returning({ failures: loginThrottle.failures });
	return row.failures <= MAX_FAILURES;
}

/** A successful login wipes the address's count. */
export async function clearLoginAttempts(email: string): Promise<void> {
	await db.delete(loginThrottle).where(eq(loginThrottle.email, email));
}
