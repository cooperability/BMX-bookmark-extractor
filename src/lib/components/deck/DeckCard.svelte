<script lang="ts">
	import { resolve } from '$app/paths';
	import Sparkline from '$lib/components/charts/Sparkline.svelte';
	import StudyLink from './StudyLink.svelte';
	import ChartColumn from '@lucide/svelte/icons/chart-column';
	import Library from '@lucide/svelte/icons/library';
	import Play from '@lucide/svelte/icons/play';

	type Round = { finishedAt: Date | null; score: number | null; weak: string[] };
	let {
		deck,
		total,
		due,
		fresh,
		assessments
	}: { deck: string; total: number; due: number; fresh: number; assessments: Round[] } = $props();

	// listDecks returns rounds newest first; the sparkline reads oldest first.
	const scores = $derived(
		assessments
			.map((a) => a.score)
			.filter((s): s is number => s !== null)
			.reverse()
	);
	const last = $derived(assessments[0]);
	const pct = (n: number | null | undefined) => (n == null ? '–' : `${Math.round(n * 100)}%`);
</script>

<article class="panel hover:border-accent flex flex-col gap-4 p-5 transition">
	<div class="flex items-start justify-between gap-3">
		<h2 class="leading-snug font-semibold break-words">{deck}</h2>
		{#if due > 0}
			<span class="chip bg-accent-soft text-fg shrink-0 border-transparent font-mono"
				>{due} due</span
			>
		{/if}
	</div>

	<dl class="grid grid-cols-3 gap-2 font-mono">
		<div>
			<dt class="eyebrow text-[10px]">Cards</dt>
			<dd class="text-lg">{total}</dd>
		</div>
		<div>
			<dt class="eyebrow text-[10px]">Due</dt>
			<dd class="text-lg">{due}</dd>
		</div>
		<div>
			<dt class="eyebrow text-[10px]">New</dt>
			<dd class="text-lg">{fresh}</dd>
		</div>
	</dl>

	<div class="flex items-end justify-between gap-3">
		<div>
			<p class="eyebrow text-[10px]">Last round</p>
			<p class="font-mono text-lg">{pct(last?.score)}</p>
		</div>
		{#if scores.length}
			<Sparkline
				values={scores}
				label="Round scores for {deck}: {scores.map((s) => pct(s)).join(', ')}"
				class="text-accent"
				width={120}
			/>
		{:else}
			<span class="text-muted text-xs">No rounds yet</span>
		{/if}
	</div>

	{#if last?.weak.length}
		<div class="flex flex-wrap gap-1.5">
			{#each last.weak.slice(0, 6) as tag (tag)}
				<span class="chip border-again/40 text-again">{tag}</span>
			{/each}
			{#if last.weak.length > 6}<span class="chip">+{last.weak.length - 6}</span>{/if}
		</div>
	{/if}

	<div class="mt-auto flex gap-2 pt-1">
		<StudyLink {deck} class="btn btn-primary min-h-11 flex-1">
			<Play class="size-4 fill-current" /> Study
		</StudyLink>
		<a
			href="{resolve('/cards/browse')}?deck={encodeURIComponent(deck)}"
			class="btn size-11 shrink-0 p-0"
			aria-label="Browse {deck}"
			title="Browse cards"><Library class="size-4" /></a
		>
		<a
			href="{resolve('/cards/deck')}?deck={encodeURIComponent(deck)}"
			class="btn min-h-11 shrink-0"
			aria-label="Details for {deck}"
			title="Stats and history"
			><ChartColumn class="size-4" /><span class="max-[379px]:hidden">Details</span></a
		>
	</div>
</article>
