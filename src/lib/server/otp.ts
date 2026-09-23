import { and, eq, gt, lt, sql } from 'drizzle-orm';
import { sha256 } from '@oslojs/crypto/sha2';
import { encodeHexLowerCase } from '@oslojs/encoding';
import { env } from '$env/dynamic/private';
import { db } from '$lib/server/db';
import * as table from '$lib/server/db/schema';

const CODE_TTL_MS = 10 * 60 * 1000;
const RESEND_AFTER_MS = 60 * 1000;
const MAX_ATTEMPTS = 5;
// Per address per rolling day, across codes. 20 wrong guesses a day against a
// 6-digit code is about a 0.7% chance a year for a patient attacker. The cost is
// that someone who knows the address can lock its owner out of new logins for a
// day; existing 30-day sessions are unaffected.
const WINDOW_MS = 24 * 60 * 60 * 1000;
export const MAX_SENDS = 10;
export const MAX_FAILURES = 20;

export function normalizeEmail(email: string): string {
	return email.trim().toLowerCase();
}

/** ALLOWED_EMAILS is a comma-separated list. Unset means nobody can log in. */
export function isAllowed(email: string, allowlist = env.ALLOWED_EMAILS ?? ''): boolean {
	const allowed = allowlist.split(',').map(normalizeEmail).filter(Boolean);
	return allowed.includes(normalizeEmail(email));
}

const hash = (code: string) => encodeHexLowerCase(sha256(new TextEncoder().encode(code)));

function newCode(): string {
	// Rejection sampling keeps the six digits uniform.
	const buf = new Uint32Array(1);
	do crypto.getRandomValues(buf);
	while (buf[0] >= 4_294_000_000);
	return String(buf[0] % 1_000_000).padStart(6, '0');
}

/**
 * Count one send or failure against the address, atomically, starting a fresh
 * window when the last one has lapsed. Returns the counts including this one.
 */
async function spend(email: string, kind: 'sends' | 'failures', now: Date) {
	const t = table.loginThrottle;
	const lapsed = sql`${t.windowStart} <= ${new Date(now.getTime() - WINDOW_MS).toISOString()}::timestamptz`;
	const add = (col: 'sends' | 'failures') => (col === kind ? 1 : 0);
	const next = (col: typeof t.sends | typeof t.failures, name: 'sends' | 'failures') =>
		sql`case when ${lapsed} then ${add(name)} else ${col} + ${add(name)} end`;
	const [row] = await db
		.insert(t)
		.values({ email, windowStart: now, sends: add('sends'), failures: add('failures') })
		.onConflictDoUpdate({
			target: t.email,
			set: {
				windowStart: sql`case when ${lapsed} then ${now.toISOString()}::timestamptz else ${t.windowStart} end`,
				sends: next(t.sends, 'sends'),
				failures: next(t.failures, 'failures')
			}
		})
		.returning();
	return row;
}

async function failuresToday(email: string, now: Date): Promise<number> {
	const t = table.loginThrottle;
	const [row] = await db.select().from(t).where(eq(t.email, email));
	if (!row || now.getTime() - row.windowStart.getTime() >= WINDOW_MS) return 0;
	return row.failures;
}

/**
 * Returns the code to send, or null if one was issued under a minute ago or the
 * address has used its daily sends.
 */
export async function issueCode(email: string, now = new Date()): Promise<string | null> {
	const t = table.loginCode;
	const code = newCode();
	const row = {
		email,
		codeHash: hash(code),
		attempts: 0,
		createdAt: now,
		expiresAt: new Date(now.getTime() + CODE_TTL_MS)
	};
	// One statement: a code younger than RESEND_AFTER_MS blocks the overwrite, so
	// two sends in flight at once cannot both issue a code.
	const cutoff = new Date(now.getTime() - RESEND_AFTER_MS).toISOString();
	const issued = await db
		.insert(t)
		.values(row)
		.onConflictDoUpdate({
			target: t.email,
			set: row,
			setWhere: sql`${t.createdAt} <= ${cutoff}::timestamptz`
		})
		.returning({ email: t.email });
	if (issued.length === 0) return null;
	if ((await spend(email, 'sends', now)).sends > MAX_SENDS) {
		// Over budget: withdraw the code before anyone has seen it.
		await db.delete(t).where(and(eq(t.email, email), eq(t.codeHash, row.codeHash)));
		return null;
	}
	return code;
}

/**
 * Single use. Burns the code on success, on expiry, after MAX_ATTEMPTS misses,
 * and once the address has MAX_FAILURES misses in the window.
 */
export async function verifyCode(email: string, code: string, now = new Date()): Promise<boolean> {
	const t = table.loginCode;
	if ((await failuresToday(email, now)) >= MAX_FAILURES) {
		await db.delete(t).where(eq(t.email, email));
		return false;
	}
	// Count the attempt atomically before comparing, so parallel guesses cannot all
	// read attempts=0 and skip the limit.
	const [row] = await db
		.update(t)
		.set({ attempts: sql`${t.attempts} + 1` })
		.where(and(eq(t.email, email), lt(t.attempts, MAX_ATTEMPTS), gt(t.expiresAt, now)))
		.returning();
	if (!row) {
		await db.delete(t).where(eq(t.email, email));
		await spend(email, 'failures', now);
		return false;
	}
	// Deleting on the hash makes success single-use even under concurrent submits.
	const used = await db
		.delete(t)
		.where(and(eq(t.email, email), eq(t.codeHash, hash(code.trim()))))
		.returning();
	if (used.length === 0) await spend(email, 'failures', now);
	return used.length > 0;
}
