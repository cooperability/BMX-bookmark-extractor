import { sql } from 'drizzle-orm';
import { db } from '$lib/server/db';

/**
 * Whether the database answers a trivial query. Reports only ok or down: the
 * endpoint is public, so the reason (unset URL, bad host, auth) stays in the logs.
 */
export async function databaseStatus(timeoutMs = 2000): Promise<'ok' | 'down'> {
	let timer: ReturnType<typeof setTimeout> | undefined;
	const timeout = new Promise<never>((_, reject) => {
		timer = setTimeout(() => reject(new Error(`no answer in ${timeoutMs} ms`)), timeoutMs);
	});
	try {
		await Promise.race([db.execute(sql`select 1`), timeout]);
		return 'ok';
	} catch (e) {
		console.error('[health] database check failed', e);
		return 'down';
	} finally {
		clearTimeout(timer);
	}
}
