<script lang="ts">
	import { enhance } from '$app/forms';

	let { form } = $props();
</script>

<svelte:head>
	<title>Log in · Remediate</title>
</svelte:head>

<main class="mx-auto max-w-sm px-4 py-16">
	<h1 class="text-2xl font-bold text-gray-900">Log in</h1>

	{#if form?.sent}
		<p class="mt-4 text-sm text-gray-700">
			If {form.email} is allowed, a 6-digit code is on its way. It expires in 10 minutes.
		</p>
		<form method="POST" action="?/verify" use:enhance class="mt-6 space-y-3">
			<input type="hidden" name="email" value={form.email} />
			<input
				name="code"
				inputmode="numeric"
				autocomplete="one-time-code"
				pattern={'[0-9]{6}'}
				maxlength="6"
				required
				placeholder="123456"
				aria-label="Login code"
				class="w-full rounded border-gray-300 text-center text-2xl tracking-widest"
			/>
			<button class="w-full rounded bg-gray-900 px-4 py-2 text-white">Verify</button>
		</form>
		<form method="POST" action="?/send" use:enhance class="mt-2">
			<input type="hidden" name="email" value={form.email} />
			<button class="text-sm text-gray-600 underline">Send a new code</button>
		</form>
	{:else}
		<form method="POST" action="?/send" use:enhance class="mt-6 space-y-3">
			<input
				name="email"
				type="email"
				autocomplete="email"
				required
				placeholder="you@example.com"
				aria-label="Email"
				value={form?.email ?? ''}
				class="w-full rounded border-gray-300"
			/>
			<button class="w-full rounded bg-gray-900 px-4 py-2 text-white">Email me a code</button>
		</form>
	{/if}

	{#if form?.message}
		<p class="mt-4 text-sm text-red-700" role="alert">{form.message}</p>
	{/if}
</main>
