import { sql, type TablesRelationalConfig } from 'drizzle-orm';
import type { PgDatabase, PgQueryResultHKT, PgTransaction } from 'drizzle-orm/pg-core';

// TDD §7.6. The tenant rides on a transaction-local setting that the
// tenant_isolation policies read, so a query missing its user_id filter returns
// zero rows instead of everyone's. is_local = true keeps it from leaking to the
// next checkout of a pooled connection. fn can call set_config itself and become
// any tenant, so fn must be trusted server code, never user-supplied SQL.
export async function withTenant<
	H extends PgQueryResultHKT,
	S extends Record<string, unknown>,
	R extends TablesRelationalConfig,
	T
>(
	db: PgDatabase<H, S, R>,
	userId: string,
	fn: (tx: PgTransaction<H, S, R>) => Promise<T>
): Promise<T> {
	return db.transaction(async (tx) => {
		await tx.execute(sql`SELECT set_config('app.user_id', ${userId}, true)`);
		return fn(tx);
	});
}
