import { PGlite } from '@electric-sql/pglite';
import { eq, sql, type SQL } from 'drizzle-orm';
import type { PgliteDatabase } from 'drizzle-orm/pglite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import * as schema from './schema';
import { withTenant } from './rls';
import { createTestDb } from './test-db';

const A = 'tenant-a';
const B = 'tenant-b';

// One insert per tenant table. A owns nodes a1 and a2, so every other row hangs
// off those.
const TENANT_TABLES: [string, (userId: string, key: string) => SQL][] = [
	[
		'nodes',
		(u, k) => sql`INSERT INTO nodes (id, user_id, front, deck) VALUES (${k}, ${u}, 'q', 'd')`
	],
	[
		'edges',
		(u, k) =>
			sql`INSERT INTO edges (user_id, src_id, dst_id, kind, provenance) VALUES (${u}, 'a1', 'a2', ${k}, 'import')`
	],
	[
		'review_state',
		(u) => sql`INSERT INTO review_state (user_id, node_id, due) VALUES (${u}, 'a2', now())`
	],
	[
		'review_log',
		(u) =>
			sql`INSERT INTO review_log (user_id, node_id, rating, surface) VALUES (${u}, 'a1', 3, 'cards')`
	],
	[
		'quest_runs',
		(u, k) => sql`INSERT INTO quest_runs (id, user_id, current_node_id) VALUES (${k}, ${u}, 'a1')`
	],
	['harvests', (u, k) => sql`INSERT INTO harvests (user_id, url_normalized) VALUES (${u}, ${k})`],
	['jobs', (u, k) => sql`INSERT INTO jobs (user_id, kind) VALUES (${u}, ${k})`]
];

let client: PGlite;
let db: PgliteDatabase<typeof schema>;

async function tenantRows(userId: string | null, table: string) {
	const q = sql`SELECT user_id FROM ${sql.identifier(table)}`;
	const res = userId ? await withTenant(db, userId, (tx) => tx.execute(q)) : await db.execute(q);
	return res.rows;
}

beforeAll(async () => {
	({ client, db } = await createTestDb());
	await db.insert(schema.user).values([
		{ id: A, username: 'a', passwordHash: 'x' },
		{ id: B, username: 'b', passwordHash: 'x' }
	]);
	await withTenant(db, A, async (tx) => {
		await tx.execute(TENANT_TABLES[0][1](A, 'a1'));
		for (const [, insert] of TENANT_TABLES) await tx.execute(insert(A, 'a2'));
	});
}, 60_000);

afterAll(async () => {
	await client.close();
});

describe('tenant isolation', () => {
	it('runs as a role that RLS applies to and that owns nothing', async () => {
		const { rows } = await client.query(`
			SELECT r.rolsuper, r.rolbypassrls,
				(SELECT count(*)::int FROM pg_class WHERE relowner = r.oid) AS owned
			FROM pg_roles r WHERE r.rolname = current_user
		`);
		expect(rows).toEqual([{ rolsuper: false, rolbypassrls: false, owned: 0 }]);
	});

	it('forces the tenant policy on every table carrying user_id except session', async () => {
		const { rows } = await client.query<{ relname: string }>(`
			SELECT c.relname, c.relrowsecurity AND c.relforcerowsecurity AS forced,
				p.cmd, p.permissive, p.qual, p.with_check,
				(SELECT count(*)::int FROM pg_policies x WHERE x.tablename = c.relname) AS policies
			FROM pg_class c
			JOIN pg_attribute a ON a.attrelid = c.oid AND a.attname = 'user_id'
			LEFT JOIN pg_policies p ON p.tablename = c.relname
			WHERE c.relnamespace = 'public'::regnamespace AND c.relkind = 'r' AND c.relname <> 'session'
			ORDER BY c.relname
		`);
		expect(rows.map((r) => r.relname)).toEqual(TENANT_TABLES.map(([t]) => t).sort());
		for (const r of rows)
			expect(r, r.relname).toEqual({
				relname: r.relname,
				forced: true,
				cmd: 'ALL',
				permissive: 'PERMISSIVE',
				qual: "(user_id = current_setting('app.user_id'::text, true))",
				with_check: null,
				policies: 1
			});
	});

	it.each(TENANT_TABLES)('%s: app cannot switch FORCE off', async (table) => {
		await expect(client.exec(`ALTER TABLE ${table} NO FORCE ROW LEVEL SECURITY`)).rejects.toThrow(
			'must be owner'
		);
	});

	it.each(TENANT_TABLES)('%s: A sees its own rows with no user_id filter', async (table) => {
		const rows = await tenantRows(A, table);
		expect(rows.length).toBeGreaterThan(0);
		expect(rows.every((r) => r.user_id === A)).toBe(true);
	});

	it.each(TENANT_TABLES)("%s: B and no-tenant read none of A's rows", async (table) => {
		expect(await tenantRows(B, table)).toHaveLength(0);
		expect(await tenantRows(null, table)).toHaveLength(0);
	});

	it.each(TENANT_TABLES)("%s: B updates and deletes none of A's rows", async (table) => {
		const t = sql.identifier(table);
		const res = await withTenant(db, B, async (tx) => [
			await tx.execute(sql`UPDATE ${t} SET user_id = user_id RETURNING user_id`),
			await tx.execute(sql`DELETE FROM ${t} RETURNING user_id`)
		]);
		expect(res.map((r) => r.rows.length)).toEqual([0, 0]);
		expect((await tenantRows(A, table)).length).toBeGreaterThan(0);
	});

	it.each(TENANT_TABLES)('%s: B cannot insert a row owned by A', async (table, insert) => {
		await expect(withTenant(db, B, (tx) => tx.execute(insert(A, 'forged')))).rejects.toMatchObject({
			cause: { message: expect.stringContaining('row-level security') }
		});
	});

	it("drizzle queries under B leave A's nodes intact", async () => {
		await withTenant(db, B, (tx) =>
			tx.update(schema.node).set({ front: 'pwned' }).where(eq(schema.node.userId, A))
		);
		const rows = await withTenant(db, A, (tx) => tx.select().from(schema.node));
		expect(rows.map((r) => r.front)).toEqual(['q', 'q']);
	});

	it("B cannot hang an edge off A's nodes, and cannot tell A's ids from missing ones", async () => {
		await withTenant(db, B, (tx) =>
			tx.insert(schema.node).values({ id: 'b1', userId: B, front: 'q', deck: 'd' })
		);
		for (const [src, dst] of [
			['a1', 'b1'],
			['b1', 'a1'],
			['no-such-node', 'b1']
		])
			await expect(
				withTenant(db, B, (tx) =>
					tx
						.insert(schema.edge)
						.values({ userId: B, srcId: src, dstId: dst, kind: 'deck', provenance: 'import' })
				)
			).rejects.toMatchObject({ cause: { code: '23503' } });
	});

	it.each([
		[
			'review_log',
			(n: string) =>
				sql`INSERT INTO review_log (user_id, node_id, rating, surface) VALUES (${B}, ${n}, 3, 'cards')`
		],
		[
			'harvests',
			(n: string) =>
				sql`INSERT INTO harvests (user_id, url_normalized, node_id) VALUES (${B}, ${'u-' + n}, ${n})`
		],
		[
			'quest_runs',
			(n: string) =>
				sql`INSERT INTO quest_runs (id, user_id, current_node_id) VALUES (${'q-' + n}, ${B}, ${n})`
		]
	])("%s: B can reference its own node but not A's", async (_, insert) => {
		await withTenant(db, B, async (tx) => {
			await tx.execute(
				sql`INSERT INTO nodes (id, user_id, front, deck) VALUES ('b1', ${B}, 'q', 'd') ON CONFLICT DO NOTHING`
			);
			await tx.execute(insert('b1'));
		});
		await expect(withTenant(db, B, (tx) => tx.execute(insert('a1')))).rejects.toMatchObject({
			cause: { code: '23503' }
		});
	});

	it("B cannot schedule A's node, and A still can", async () => {
		await expect(
			withTenant(db, B, (tx) =>
				tx.insert(schema.reviewState).values({ userId: B, nodeId: 'a1', due: new Date() })
			)
		).rejects.toMatchObject({ cause: { code: '23503' } });
		await withTenant(db, A, (tx) =>
			tx.insert(schema.reviewState).values({ userId: A, nodeId: 'a1', due: new Date() })
		);
		const rows = await withTenant(db, A, (tx) => tx.select().from(schema.reviewState));
		expect(rows.map((r) => r.nodeId).sort()).toEqual(['a1', 'a2']);
	});

	it('leaves no tenant set once withTenant commits', async () => {
		const { rows } = await client.query<{ v: string | null }>(
			`SELECT current_setting('app.user_id', true) AS v`
		);
		expect(rows[0].v || null).toBeNull();
	});
});
