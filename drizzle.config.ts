import { defineConfig } from 'drizzle-kit';

// Migrate only. `push` diffs the schema alone and drops the hand-written
// extension and FORCE ROW LEVEL SECURITY migrations.
export default defineConfig({
	schema: './src/lib/server/db/schema.ts',
	out: './drizzle',
	dialect: 'postgresql',
	dbCredentials: { url: process.env.DATABASE_URL ?? '' },
	strict: true
});
