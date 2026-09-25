import { AsyncLocalStorage } from 'node:async_hooks';
import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';
import { env } from '$env/dynamic/private';

// Checked on use, not at import: hooks.server.ts imports this module, so a throw
// here fails every route, the public landing page included.
function requireUrl() {
	if (!env.DATABASE_URL) throw new Error('DATABASE_URL is not set');
}

// Serverless defaults. postgres.js waits 30 s on a connect and keeps idle
// connections forever. On Vercel that meant a request hung for 30 s while the
// database was unreachable, and a frozen instance held connections Neon had
// already dropped. Fail a connect in 10 s, and let idle ones go after 20 s.
const client = postgres(env.DATABASE_URL ?? '', {
	connect_timeout: 10,
	idle_timeout: 20,
	max_lifetime: 60 * 30
});
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
		requireUrl();
		const current = tenant.getStore() ?? target;
		const value = Reflect.get(current, prop, current);
		return typeof value === 'function' ? value.bind(current) : value;
	}
}) as typeof root;

// The role migration 0003 creates. It has no BYPASSRLS, so its tenant policies hold.
export const TENANT_ROLE = 'remediate_app';

let roleReady: Promise<boolean> | undefined;

/**
 * Whether this connection can switch to TENANT_ROLE and act through it. False
 * before migration 0003 runs in this database (a deploy that lands first) and on
 * a `db:push` database. Roles are cluster-wide but grants are per database, so the
 * role existing is not enough. Checked once per process.
 */
function tenantRoleReady(): Promise<boolean> {
	roleReady ??= root
		.execute<{ ok: boolean }>(
			sql`select exists (select 1 from pg_roles where rolname = ${TENANT_ROLE})
				and pg_has_role(current_user, ${TENANT_ROLE}, 'MEMBER')
				and has_table_privilege(${TENANT_ROLE}, 'public.nodes', 'SELECT') as ok`
		)
		.then(([r]) => {
			if (!r.ok) {
				console.warn(
					`[db] role ${TENANT_ROLE} is missing or not granted: requests run without row-level security. Run \`yarn db:migrate\`.`
				);
			}
			return r.ok;
		})
		.catch((e) => {
			roleReady = undefined; // a failed probe is retried on the next request
			throw e;
		});
	return roleReady;
}

/**
 * Run `fn` as one tenant: in a transaction that sets `app.user_id` and switches
 * to TENANT_ROLE, so Postgres itself hides and refuses other users' rows in the
 * tenant tables (drizzle/0003_rls.sql). The `user_id` filters in the queries
 * stay; this is the second wall behind them. Everything `fn` awaits sees `db`
 * as this transaction.
 *
 * Without the role (see tenantRoleReady) it still runs in the transaction, on
 * the query filters alone, and logs one warning: failing every signed-in request
 * because a migration has not run yet would be an outage, not a safeguard.
 */
export async function asTenant<T>(userId: string, fn: () => Promise<T>): Promise<T> {
	requireUrl();
	const role = await tenantRoleReady();
	return root.transaction(async (tx) => {
		await tx.execute(
			role
				? sql`select set_config('app.user_id', ${userId}, true), set_config('role', ${TENANT_ROLE}, true)`
				: sql`select set_config('app.user_id', ${userId}, true)`
		);
		return tenant.run(tx, fn);
	});
}
