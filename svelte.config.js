import adapter from '@sveltejs/adapter-vercel';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

const config = {
	preprocess: [vitePreprocess()],
	kit: {
		adapter: adapter(),
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
	},
	extensions: ['.svelte']
};

export default config;
