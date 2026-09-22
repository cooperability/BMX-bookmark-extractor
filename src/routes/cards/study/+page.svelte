<script lang="ts">
	import { invalidate } from '$app/navigation';
	import { resolve } from '$app/paths';

	let { data } = $props();

	type Card = (typeof data.cards)[number];
	type AreaScore = { tag: string; cards: number; again: number; score: number };
	type Grades = { score: number | null; areas: AreaScore[]; strong: string[]; weak: string[] };

	const RATINGS = [
		{ value: 1, label: 'Again', key: '1', class: 'bg-red-700' },
		{ value: 2, label: 'Hard', key: '2', class: 'bg-amber-600' },
		{ value: 3, label: 'Good', key: '3', class: 'bg-green-700' },
		{ value: 4, label: 'Easy', key: '4', class: 'bg-sky-700' }
	];
	// Anki-style relearning inside the round: a missed card comes back at the end,
	// at most this many times. Only the first attempt is graded.
	const MAX_REPEATS = 2;

	let queue = $state<{ card: Card; repeats: number }[]>([]);
	let done = $state(0);
	let flipped = $state(false);
	let busy = $state(false);
	let grades = $state<Grades | null>(null);
	let failed = $state<string | null>(null);

	$effect.pre(() => {
		queue = data.cards.map((card) => ({ card, repeats: 0 }));
		done = 0;
		flipped = false;
		grades = null;
		failed = null;
	});

	const current = $derived(queue[0]);
	const pct = (n: number | null) => (n === null ? '–' : `${Math.round(n * 100)}%`);

	async function post(path: string, body: unknown) {
		const res = await fetch(path, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify(body)
		});
		if (!res.ok) throw new Error(`${path} ${res.status}`);
		return res.json();
	}

	async function rate(rating: number) {
		if (!current || !flipped || busy) return;
		busy = true;
		try {
			await post('/api/review/grade', {
				assessmentId: data.assessmentId,
				nodeId: current.card.id,
				rating
			});
			const [head, ...rest] = queue;
			if (head.repeats === 0) done += 1;
			queue =
				rating === 1 && head.repeats < MAX_REPEATS
					? [...rest, { ...head, repeats: head.repeats + 1 }]
					: rest;
			flipped = false;
			if (queue.length === 0)
				grades = await post('/api/review/finish', { assessmentId: data.assessmentId });
		} catch (e) {
			failed = String(e);
		} finally {
			busy = false;
		}
	}

	function onkeydown(e: KeyboardEvent) {
		if (grades || failed || !current || e.ctrlKey || e.metaKey || e.altKey) return;
		if (e.key === ' ' || e.key === 'Enter') {
			e.preventDefault();
			flipped = true;
		}
		const r = RATINGS.find((x) => x.key === e.key);
		if (r) rate(r.value);
	}
</script>

<svelte:window {onkeydown} />

<svelte:head>
	<title>{data.deck} · Remediate</title>
</svelte:head>

<main class="mx-auto max-w-3xl px-4 py-8">
	<header class="flex items-baseline justify-between gap-4 text-sm text-gray-600">
		<a href={resolve('/cards')} class="underline">Decks</a>
		<span class="truncate">{data.deck}</span>
		<span>{done} / {data.cards.length}</span>
	</header>
	<div class="mt-2 h-1 rounded bg-gray-200">
		<div class="h-1 rounded bg-gray-900" style="width: {(done / data.cards.length) * 100}%"></div>
	</div>

	{#if data.prior && !grades && done === 0}
		<p class="mt-4 text-sm text-gray-600">
			Last round {pct(data.prior.score)}.
			{#if data.prior.weak.length}This round leans on weak areas: {data.prior.weak.join(', ')}.{/if}
		</p>
	{/if}

	{#if failed}
		<p class="mt-6 text-red-700" role="alert">Something failed: {failed}. Reload to retry.</p>
	{:else if grades}
		<section class="mt-8">
			<h1 class="text-2xl font-bold text-gray-900">Round score {pct(grades.score)}</h1>
			<p class="mt-2 text-sm text-gray-700">
				{#if grades.weak.length}Weak: <span class="text-red-700">{grades.weak.join(', ')}</span
					>.{/if}
				{#if grades.strong.length}
					Strong: <span class="text-green-700">{grades.strong.join(', ')}</span>.{/if}
			</p>
			<table class="mt-4 w-full text-left text-sm">
				<thead class="text-gray-600">
					<tr><th class="py-1">Area</th><th>Cards</th><th>Again</th><th>Score</th></tr>
				</thead>
				<tbody>
					{#each grades.areas as a (a.tag)}
						<tr class="border-t border-gray-200">
							<td class="py-1">{a.tag}</td><td>{a.cards}</td><td>{a.again}</td><td
								>{pct(a.score)}</td
							>
						</tr>
					{/each}
				</tbody>
			</table>
			<div class="mt-6 flex gap-3">
				<button
					class="rounded bg-gray-900 px-4 py-2 text-white"
					onclick={() => invalidate('cards:round')}>Next round</button
				>
				<a href={resolve('/cards')} class="rounded border border-gray-400 px-4 py-2"
					>Back to decks</a
				>
			</div>
		</section>
	{:else if current}
		<!-- Card HTML is DOMPurify-sanitized at import (ingest/sanitize.ts) before it is stored. -->
		<article class="mt-8 rounded border border-gray-200 p-6">
			<!-- eslint-disable-next-line svelte/no-at-html-tags -->
			<div class="prose max-w-none">{@html current.card.front}</div>
			{#if flipped}
				<hr class="my-6 border-gray-200" />
				<!-- eslint-disable-next-line svelte/no-at-html-tags -->
				<div class="prose max-w-none">{@html current.card.back}</div>
			{/if}
			{#if current.card.tags.length}
				<p class="mt-6 text-xs text-gray-500">{current.card.tags.join(' · ')}</p>
			{/if}
		</article>

		<div class="mt-6">
			{#if !flipped}
				<button
					class="w-full rounded bg-gray-900 px-4 py-3 text-white"
					onclick={() => (flipped = true)}
					>Show answer <span class="text-gray-400">(space)</span></button
				>
			{:else}
				<div class="grid grid-cols-4 gap-2">
					{#each RATINGS as r (r.value)}
						<button
							class="rounded px-2 py-3 text-white {r.class} disabled:opacity-50"
							disabled={busy}
							onclick={() => rate(r.value)}
							>{r.label} <span class="opacity-70">({r.key})</span></button
						>
					{/each}
				</div>
			{/if}
		</div>
	{/if}
</main>
