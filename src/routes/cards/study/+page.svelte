<script lang="ts">
	import { invalidate } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { fly } from 'svelte/transition';
	import { prefersReducedMotion } from 'svelte/motion';
	import Flashcard from '$lib/components/study/Flashcard.svelte';
	import RatingBar from '$lib/components/study/RatingBar.svelte';
	import RoundIntro from '$lib/components/study/RoundIntro.svelte';
	import RoundResults from '$lib/components/study/RoundResults.svelte';
	import { RATINGS, type Grades } from '$lib/components/study/ratings';

	let { data } = $props();

	type Card = (typeof data.cards)[number];

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
	const total = $derived(data.cards.length);
	const still = $derived(prefersReducedMotion.current);

	async function post(path: string, body: unknown) {
		const res = await fetch(path, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify(body)
		});
		if (!res.ok) throw new Error(`${path} ${res.status}`);
		return res.json();
	}

	async function finish() {
		grades = await post('/api/review/finish', { assessmentId: data.assessmentId });
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
			if (queue.length === 0) await finish();
		} catch (e) {
			failed = String(e);
		} finally {
			busy = false;
		}
	}

	// A failed grade leaves the queue untouched, so dismissing lets the same card be
	// rated again. A failed finish has an empty queue, so it retries the finish.
	async function retry() {
		failed = null;
		if (queue.length > 0 || grades) return;
		busy = true;
		try {
			await finish();
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

<div class="mx-auto flex min-h-dvh max-w-3xl flex-col px-4 pb-10">
	<header class="sticky top-0 z-10 -mx-4 bg-bg/85 px-4 pt-4 pb-3 backdrop-blur">
		<div class="flex items-center gap-3 text-sm">
			<a href={resolve('/cards')} class="btn btn-ghost -ml-2 px-2 py-1 text-muted">
				<span aria-hidden="true">←</span> Decks
			</a>
			<span class="min-w-0 flex-1 truncate text-center font-medium">{data.deck}</span>
			{#if current && current.repeats > 0 && !grades}
				<span class="chip border-again/30 bg-again/10 text-again">relearning</span>
			{/if}
			<span class="font-mono text-xs text-muted tabular-nums">{done} / {total}</span>
		</div>
		<div
			class="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-2"
			role="progressbar"
			aria-label="Round progress"
			aria-valuemin={0}
			aria-valuemax={total}
			aria-valuenow={done}
		>
			<div
				class="h-full rounded-full bg-accent transition-[width] duration-300"
				style="width: {(done / total) * 100}%"
			></div>
		</div>
	</header>

	{#if failed}
		<div
			class="panel mt-6 flex flex-wrap items-center gap-3 border-again/40 bg-again/10 px-4 py-3 text-sm"
			role="alert"
			in:fly={{ y: still ? 0 : -8, duration: 200 }}
		>
			<span class="font-medium text-again">Could not save.</span>
			<span class="min-w-0 flex-1 truncate font-mono text-xs text-muted">{failed}</span>
			<button class="btn px-3 py-1" onclick={retry}>Retry</button>
			<button class="btn btn-ghost px-3 py-1" onclick={() => location.reload()}>Reload</button>
		</div>
	{/if}

	<main class="mt-6 flex flex-1 flex-col gap-6">
		{#if grades}
			<RoundResults
				{grades}
				priorScore={data.prior?.score ?? null}
				onnext={() => invalidate('cards:round')}
			/>
		{:else if current}
			{#if data.prior && done === 0 && current.repeats === 0}
				<RoundIntro prior={data.prior} />
			{/if}

			{#key `${current.card.id}:${current.repeats}`}
				<div in:fly={{ x: still ? 0 : 24, duration: still ? 0 : 220 }}>
					<Flashcard card={current.card} {flipped} />
				</div>
			{/key}

			<div class="sticky bottom-0 -mx-4 mt-auto bg-bg/85 px-4 py-3 backdrop-blur">
				<RatingBar {flipped} {busy} onflip={() => (flipped = true)} onrate={rate} />
			</div>
		{:else if busy}
			<p class="mt-16 text-center text-sm text-muted">Scoring the round…</p>
		{/if}
	</main>
</div>
