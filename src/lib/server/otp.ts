import { and, eq, gt, lt, sql } from 'drizzle-orm';
import { sha256 } from '@oslojs/crypto/sha2';
import { encodeHexLowerCase } from '@oslojs/encoding';
import { env } from '$env/dynamic/private';
import { db } from '$lib/server/db';
import * as table from '$lib/server/db/schema';

const CODE_TTL_MS = 10 * 60 * 1000;
const RESEND_AFTER_MS = 60 * 1000;
const MAX_ATTEMPTS = 5;

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

/** Returns the code to send, or null if one was issued under a minute ago. */
export async function issueCode(email: string, now = new Date()): Promise<string | null> {
	const [existing] = await db
		.select()
		.from(table.loginCode)
		.where(eq(table.loginCode.email, email));
	if (existing && now.getTime() - existing.createdAt.getTime() < RESEND_AFTER_MS) return null;

	const code = newCode();
	const row = {
		email,
		codeHash: hash(code),
		attempts: 0,
		createdAt: now,
		expiresAt: new Date(now.getTime() + CODE_TTL_MS)
	};
	await db
		.insert(table.loginCode)
		.values(row)
		.onConflictDoUpdate({ target: table.loginCode.email, set: row });
	return code;
}

/** Single use. Burns the code on success, on expiry, and after MAX_ATTEMPTS misses. */
export async function verifyCode(email: string, code: string, now = new Date()): Promise<boolean> {
	const t = table.loginCode;
	// Count the attempt atomically before comparing, so parallel guesses cannot all
	// read attempts=0 and skip the limit.
	const [row] = await db
		.update(t)
		.set({ attempts: sql`${t.attempts} + 1` })
		.where(and(eq(t.email, email), lt(t.attempts, MAX_ATTEMPTS), gt(t.expiresAt, now)))
		.returning();
	if (!row) {
		await db.delete(t).where(eq(t.email, email));
		return false;
	}
	// Deleting on the hash makes success single-use even under concurrent submits.
	const used = await db
		.delete(t)
		.where(and(eq(t.email, email), eq(t.codeHash, hash(code.trim()))))
		.returning();
	return used.length > 0;
}
