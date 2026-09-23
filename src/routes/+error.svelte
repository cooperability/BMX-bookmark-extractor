<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import Logo from '$lib/components/brand/Logo.svelte';

	const is404 = $derived(page.status === 404);
	// A 5xx message can carry internals (a stack, a query fragment): never show it. A 4xx
	// message from a route's error() call is written for users. 'Not Found' is the
	// router's own, for a path that matches nothing.
	const own = $derived(page.error?.message && page.error.message !== 'Not Found');
	const message = $derived(
		page.status < 500 && own
			? page.error!.message
			: is404
				? 'That page does not exist.'
				: 'Something broke on our side.'
	);
</script>

<svelte:head>
	<title>{page.status} · Remediate</title>
</svelte:head>

<main class="grid min-h-dvh place-items-center px-4 py-12">
	<div class="w-full max-w-sm text-center">
		<a href={resolve('/')} class="mx-auto mb-8 flex w-fit" aria-label="Remediate home">
			<Logo size={32} />
		</a>

		<div class="panel p-6 sm:p-8">
			<p class="eyebrow">Error</p>
			<h1 class="mt-2 font-mono text-6xl font-semibold text-accent">{page.status}</h1>
			<p class="mt-3 text-sm text-muted">{message}</p>

			<div class="mt-6 flex flex-col items-center gap-2">
				<a href={resolve('/')} class="btn btn-primary w-full py-2.5">Go home</a>
				<!-- Signed-out visitors never get here: hooks send them to /login first. -->
				{#if is404 && page.data.user}
					<a href={resolve('/cards')} class="btn btn-ghost w-full py-2.5">Open decks</a>
				{/if}
			</div>
		</div>
	</div>
</main>
