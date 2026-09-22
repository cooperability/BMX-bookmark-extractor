import { AsyncLocalStorage } from 'node:async_hooks';
import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';
import { building } from '$app/environment';
import { env } from '$env/dynamic/private';

// `vite build` imports server routes to analyse them, and CI builds without a database.
if (!env.DATABASE_URL && !building) throw new Error('DATABASE_URL is not set');

const client = postgres(env.DATABASE_URL ?? '');
const root = drizzle(client, { schema });

type Tx = Parameters<Parameters<typeof root.transaction>[0]>[0];
const tenant = new AsyncLocalStorage<Tx>();

/**
 * The database handle every module imports. Inside `asTenant` it is that call's
 * transaction, so the code path is unchanged whether or not RLS is in force;
 * outside it is the pool, running as the connection's own role.
 */
export const db = new Proxy(root, {
	get(target, prop) {
		const current = tenant.getStore() ?? target;
		const value = Reflect.get(current, prop, current);
		return typeof value === 'function' ? value.bind(current) : value;
	}
}) as typeof root;

// The role migration 0003 creates. It has no BYPASSRLS, so its tenant policies hold.
export const TENANT_ROLE = 'remediate_app';

/**
 * Run `fn` as one tenant: in a transaction that sets `app.user_id` and switches
 * to TENANT_ROLE, so Postgres itself hides and refuses other users' rows in the
 * tenant tables (drizzle/0003_rls.sql). The `user_id` filters in the queries
 * stay; this is the second wall behind them. Everything `fn` awaits sees `db`
 * as this transaction.
 */
export function asTenant<T>(userId: string, fn: () => Promise<T>): Promise<T> {
	return root.transaction(async (tx) => {
		await tx.execute(
			sql`select set_config('app.user_id', ${userId}, true), set_config('role', ${TENANT_ROLE}, true)`
		);
		return tenant.run(tx, fn);
	});
}
