import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { expect, it, onTestFinished } from 'vitest';

const root = fileURLToPath(new URL('..', import.meta.url));

// A git worktree under .claude/worktrees sits inside another checkout. When that checkout's
// tsconfig.json extends $app/tsconfig before its install has created node_modules/$app,
// rolldown loaded it while pre-bundling SSR deps, and `vite dev` exited at startup.
it('pre-bundles SSR deps under a tsconfig.json that cannot load', { timeout: 60_000 }, async () => {
	const outer = mkdtempSync(join(tmpdir(), 'remediate-outer-'));
	const cwd = process.cwd();
	onTestFinished(() => {
		process.chdir(cwd);
		rmSync(outer, { recursive: true, force: true, maxRetries: 5 });
	});
	writeFileSync(join(outer, 'tsconfig.json'), '{ "extends": "$app/tsconfig" }');
	mkdirSync(join(outer, 'worktree'));
	process.chdir(join(outer, 'worktree'));

	const server = await createServer({
		root,
		configFile: join(root, 'vite.config.ts'),
		cacheDir: join(outer, 'vite'),
		logLevel: 'silent',
		server: { middlewareMode: true }
	});
	await server.close();

	expect(existsSync(join(outer, 'vite', 'deps_ssr', '_metadata.json'))).toBe(true);
});
