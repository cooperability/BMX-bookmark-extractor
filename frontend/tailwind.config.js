import typography from '@tailwindcss/typography';

/** @type {import('tailwindcss').Config} */
export default {
	content: ['./src/**/*.{html,js,svelte,ts}'],
	theme: {
		extend: {
			colors: {
				'graph-node': '#4F46E5',
				'graph-edge': '#6B7280',
				'graph-highlight': '#F59E0B',
				'graph-background': '#1F2937'
			},
			animation: {
				'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
				'bounce-slow': 'bounce 2s infinite'
			}
		}
	},
	plugins: [typography]
};
