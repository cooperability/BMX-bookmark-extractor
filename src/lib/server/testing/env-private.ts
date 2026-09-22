// Stand-in for `$env/dynamic/private` under vitest. See vitest.server.config.ts.
export const env: Record<string, string | undefined> = process.env;
