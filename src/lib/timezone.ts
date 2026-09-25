// The browser reports its IANA time zone in this cookie (see +layout.svelte) so
// "today", streaks, the heatmap and the daily new-card cap follow the user's
// calendar rather than UTC. Until the cookie arrives, days are UTC.
export const TZ_COOKIE = 'tz';

const IANA = /^[A-Za-z][A-Za-z0-9_+\-/]{0,63}$/;

/** A time zone both Intl and Postgres will accept, or UTC. */
export function toTimeZone(value: unknown): string {
	if (typeof value !== 'string' || !IANA.test(value)) return 'UTC';
	try {
		new Intl.DateTimeFormat('en-US', { timeZone: value });
		return value;
	} catch {
		return 'UTC';
	}
}
