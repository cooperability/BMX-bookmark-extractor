// Seed a local database: upsert one user by email, then import every source_data/*.txt
// Anki export for them. Idempotent. Usage: yarn db:seed <email>
import { readdir, readFile } from 'node:fs/promises';
import { register } from 'node:module';
import { join } from 'node:path';
import { encodeBase32LowerCase } from '@oslojs/encoding';
import postgres from 'postgres';

// The ingest modules use extensionless relative imports, which Vite resolves and
// Node does not. Retry those with `.ts` so this script shares the app's parser.
const hook = `export async function resolve(spec, ctx, next) {
	try { return await next(spec, ctx); } catch (e) {
		if (spec.startsWith('.') && !/\\.\\w+$/.test(spec)) return next(spec + '.ts', ctx);
		throw e;
	}
}`;
register('data:text/javascript,' + encodeURIComponent(hook));
const { parseAnkiExport } = await import('../src/lib/server/ingest/anki-tsv.ts');

const email = process.argv[2]?.trim().toLowerCase();
if (!email) throw new Error('usage: yarn db:seed <email>');
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set');

const sql = postgres(process.env.DATABASE_URL, { onnotice: () => {} });
try {
	// Same id shape as the login action creates.
	const newId = encodeBase32LowerCase(crypto.getRandomValues(new Uint8Array(15)));
	await sql`insert into "user" (id, email) values (${newId}, ${email}) on conflict (email) do nothing`;
	const [{ id: userId }] = await sql`select id from "user" where email = ${email}`;

	const dir = 'source_data';
	const files = (await readdir(dir)).filter((f) => f.endsWith('.txt')).sort();
	let total = 0;
	await sql.begin(async (tx) => {
		for (const file of files) {
			const { notes, warnings } = parseAnkiExport(await readFile(join(dir, file), 'utf8'), userId);
			for (const n of notes) {
				await tx`
					insert into nodes (id, user_id, anki_guid, notetype, deck, front, back, tags)
					values (${n.id}, ${userId}, ${n.ankiGuid}, ${n.notetype}, ${n.deck}, ${n.front}, ${n.back}, ${tx.array(n.tags)})
					on conflict (id) do update set
						front = excluded.front, back = excluded.back, deck = excluded.deck,
						tags = excluded.tags, notetype = excluded.notetype`;
			}
			total += notes.length;
			console.log(`${file}: ${notes.length} notes, ${warnings.length} warnings`);
		}
	});
	const [{ count }] = await sql`select count(*)::int as count from nodes where user_id = ${userId}`;
	console.log(`user ${email} (${userId}): upserted ${total}, now owns ${count} nodes`);
} finally {
	await sql.end();
}
