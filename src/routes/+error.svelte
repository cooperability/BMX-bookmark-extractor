<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import Logo from '$lib/components/brand/Logo.svelte';

	const is404 = $derived(page.status === 404);
	// A 5xx message can carry internals (a stack, a query fragment): never show it.
	// A non-404 4xx message (e.g. from an `error()` call) is written for users, so it is safe.
	const message = $derived(
		is404
			? 'That page does not exist.'
			: page.status < 500 && page.error?.message
				? page.error.message
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
			<p class="mt-2 font-mono text-6xl font-semibold text-accent">{page.status}</p>
			<p class="mt-3 text-sm text-muted">{message}</p>

			<div class="mt-6 flex flex-col items-center gap-2">
				<a href={resolve('/')} class="btn btn-primary w-full py-2.5">Go home</a>
				{#if is404}
					<a href={resolve('/login')} class="btn btn-ghost w-full py-2.5">Log in</a>
				{/if}
			</div>
		</div>
	</div>
</main>
