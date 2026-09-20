import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import { vector } from '@electric-sql/pglite-pgvector';
import { drizzle, type PgliteDatabase } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import * as schema from './schema';

const migrationsFolder = fileURLToPath(new URL('../../../../drizzle', import.meta.url));

/**
 * Shared PGlite + role setup for RLS-sensitive tests. Superusers and
 * BYPASSRLS roles skip every policy, and a table owner can turn FORCE off. So
 * `owner` applies the migrations and callers run as `app`, a plain role
 * holding DML grants only — standing in for Neon's split between the
 * extension-capable owner role and the app's runtime role.
 */
export async function createTestDb(): Promise<{
	client: PGlite;
	db: PgliteDatabase<typeof schema>;
}> {
	const client = new PGlite({ extensions: { vector } });
	await client.exec(`
		CREATE EXTENSION vector;
		CREATE ROLE owner NOSUPERUSER NOBYPASSRLS;
		CREATE ROLE app NOSUPERUSER NOBYPASSRLS;
		GRANT CREATE ON DATABASE postgres TO owner;
		GRANT CREATE ON SCHEMA public TO owner;
		SET ROLE owner;
	`);
	const db = drizzle(client, { schema });
	await migrate(db, { migrationsFolder });
	await client.exec(`
		GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app;
		GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO app;
		RESET ROLE;
		SET ROLE app;
	`);
	return { client, db };
}
