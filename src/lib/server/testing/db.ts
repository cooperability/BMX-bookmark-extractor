// Database tests run against the database named by DATABASE_URL (read from .env
// when present) and skip without one, as in CI. Import this before any module
// that imports `$lib/server/db`, which throws when DATABASE_URL is unset.
import { existsSync } from 'node:fs';

if (!process.env.DATABASE_URL && existsSync('.env')) process.loadEnvFile('.env');

export const hasDb = Boolean(process.env.DATABASE_URL);
