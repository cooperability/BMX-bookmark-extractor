<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';

	let { data, form } = $props();

	const pct = (n: number | null) => (n === null ? '–' : `${Math.round(n * 100)}%`);
</script>

<svelte:head>
	<title>Decks · Remediate</title>
</svelte:head>

<main class="mx-auto max-w-3xl px-4 py-10">
	<header class="flex items-center justify-between">
		<h1 class="text-2xl font-bold text-gray-900">Decks</h1>
		<form method="POST" action="/login?/logout" class="text-sm text-gray-600">
			{data.email} · <button class="underline">Log out</button>
		</form>
	</header>

	{#each data.decks as d (d.deck)}
		{@const last = d.assessments[0]}
		<section class="mt-6 rounded border border-gray-200 p-4">
			<div class="flex items-start justify-between gap-4">
				<div>
					<h2 class="font-semibold text-gray-900">{d.deck}</h2>
					<p class="text-sm text-gray-600">
						{d.total} cards · {d.due} due · {d.fresh} new · {d.assessments.length} rounds
					</p>
				</div>
				<a
					href="{resolve('/cards/study')}?deck={encodeURIComponent(d.deck)}"
					data-sveltekit-preload-data="off"
					class="shrink-0 rounded bg-gray-900 px-4 py-2 text-white">Study</a
				>
			</div>
			{#if last}
				<p class="mt-3 text-sm text-gray-700">
					Last round {pct(last.score)}
					{#if last.weak.length}· weak: <span class="text-red-700">{last.weak.join(', ')}</span
						>{/if}
					{#if last.strong.length}· strong:
						<span class="text-green-700">{last.strong.join(', ')}</span>{/if}
				</p>
			{/if}
		</section>
	{:else}
		<p class="mt-6 text-gray-700">No decks yet. Import an Anki export to start.</p>
	{/each}

	<form
		method="POST"
		action="?/import"
		enctype="multipart/form-data"
		use:enhance
		class="mt-10 flex items-center gap-3 text-sm"
	>
		<input type="file" name="file" accept=".txt,.tsv,.csv" required aria-label="Anki export" />
		<button class="rounded border border-gray-400 px-3 py-1">Import deck</button>
	</form>
	{#if form?.message}
		<p class="mt-2 text-sm text-gray-700" role="status">{form.message}</p>
	{/if}
</main>
