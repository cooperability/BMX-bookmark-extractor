import { sha256 } from '@oslojs/crypto/sha2';
import { constantTimeEqual } from '@oslojs/crypto/subtle';
import { env } from '$env/dynamic/private';

export function normalizeEmail(email: string): string {
	return email.trim().toLowerCase();
}

/** ALLOWED_EMAILS is a comma-separated list. Unset means nobody can log in. */
export function isAllowed(email: string, allowlist = env.ALLOWED_EMAILS ?? ''): boolean {
	const allowed = allowlist.split(',').map(normalizeEmail).filter(Boolean);
	return allowed.includes(normalizeEmail(email));
}

const hash = (s: string) => sha256(new TextEncoder().encode(s));

/** DEV_PASSWORD unset or empty means nobody can log in. */
export function checkDevPassword(password: string, secret = env.DEV_PASSWORD): boolean {
	if (!secret) return false;
	// Hashing first gives equal lengths, so the comparison leaks no timing.
	return constantTimeEqual(hash(password), hash(secret));
}
