import { defineConfig } from 'vitest/config';

export default defineConfig({
	plugins: [],
	test: {
		environment: 'node',
		include: ['src/lib/server/**/*.test.ts']
	}
});
