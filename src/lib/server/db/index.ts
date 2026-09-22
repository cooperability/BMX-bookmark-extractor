import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';
import { building } from '$app/environment';
import { env } from '$env/dynamic/private';

// `vite build` imports server routes to analyse them, and CI builds without a database.
if (!env.DATABASE_URL && !building) throw new Error('DATABASE_URL is not set');

const client = postgres(env.DATABASE_URL ?? '');

export const db = drizzle(client, { schema });
