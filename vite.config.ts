import { sveltekit } from '@sveltejs/kit/vite';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';
import adapter from '@sveltejs/adapter-vercel';
import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
	plugins: [
		tailwindcss(),
		sveltekit({
			preprocess: [vitePreprocess()],
			adapter: adapter(),
			// Kit 3 stopped generating `$lib`. Keeping the alias avoids renaming it in every import.
			alias: { $lib: 'src/lib' },
			// The CSP lives here, not in vercel.json, because SvelteKit's hydration payload
			// is an inline script: only the framework can nonce it. A static header would
			// have to allow 'unsafe-inline' to keep the app working, which is no policy.
			csp: {
				mode: 'auto',
				directives: {
					'default-src': ['self'],
					'script-src': ['self'],
					// Tailwind and Svelte emit inline <style> during SSR. 'auto' nonces them;
					// browsers that honour the nonce ignore 'unsafe-inline'.
					'style-src': ['self', 'unsafe-inline'],
					// Imported Anki cards carry <img src> to arbitrary hosts, which discloses
					// the reader's IP on render. Tighten to 'self' once media is rehosted.
					'img-src': ['self', 'data:', 'https:'],
					'font-src': ['self', 'data:'],
					'connect-src': ['self'],
					'object-src': ['none'],
					'base-uri': ['none'],
					'form-action': ['self'],
					'frame-ancestors': ['none']
				}
			}
		})
	],
	server: {
		host: '0.0.0.0',
		port: 3000
	}
});
