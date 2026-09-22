<script lang="ts">
	import '../app.css';
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import Logo from '$lib/components/brand/Logo.svelte';
	import ThemeToggle from '$lib/components/brand/ThemeToggle.svelte';

	let { data, children } = $props();

	// The study screen is a focus mode: it carries its own minimal header.
	const focus = $derived(page.url.pathname.startsWith('/cards/study'));
</script>

<div class="min-h-dvh bg-bg text-fg">
	{#if data.user && !focus}
		<nav class="sticky top-0 z-20 border-b border-line bg-bg/80 backdrop-blur">
			<div class="mx-auto flex h-14 max-w-6xl items-center gap-6 px-4">
				<a href={resolve('/cards')} aria-label="Remediate decks"><Logo /></a>
				<a
					href={resolve('/cards')}
					class="text-sm text-muted hover:text-fg"
					aria-current={page.url.pathname === '/cards' ? 'page' : undefined}>Decks</a
				>
				<form method="POST" action="/login?/logout" class="ml-auto flex items-center gap-3">
					<span class="hidden font-mono text-xs text-muted sm:inline">{data.user.email}</span>
					<button class="btn btn-ghost">Log out</button>
				</form>
				<ThemeToggle theme={data.theme} />
			</div>
		</nav>
	{:else if !data.user && !focus}
		<div class="fixed right-4 bottom-4 z-20"><ThemeToggle theme={data.theme} /></div>
	{/if}
	{@render children()}
</div>
