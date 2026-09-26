<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import Logo from '$lib/components/brand/Logo.svelte';

	let { form } = $props();
</script>

<svelte:head>
	<title>Log in · Remediate</title>
</svelte:head>

<main class="grid min-h-dvh place-items-center px-4 py-12">
	<div class="w-full max-w-sm">
		<a href={resolve('/')} class="mx-auto mb-8 flex w-fit" aria-label="Remediate home">
			<Logo size={32} />
		</a>

		<div class="panel p-6 sm:p-8">
			<h1 class="text-2xl font-bold tracking-tight">Log in</h1>
			<form method="POST" action="?/login" use:enhance class="mt-6 space-y-4">
				<input
					name="email"
					type="email"
					autocomplete="email"
					required
					placeholder="you@example.com"
					aria-label="Email"
					value={form?.email ?? ''}
					class="input py-2.5"
				/>
				<input
					name="password"
					type="password"
					autocomplete="current-password"
					required
					placeholder="Dev password"
					aria-label="Dev password"
					class="input py-2.5"
				/>
				<button class="btn btn-primary w-full py-2.5">Log in</button>
			</form>

			{#if form?.message}
				<p
					class="border-again/30 bg-again/10 text-again mt-4 rounded-xl border px-3 py-2 text-sm"
					role="alert"
				>
					{form.message}
				</p>
			{/if}
		</div>
	</div>
</main>
