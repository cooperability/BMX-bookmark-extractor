<script lang="ts">
	import { resolve } from '$app/paths';
	import { fly, fade } from 'svelte/transition';
	import { prefersReducedMotion } from 'svelte/motion';
	import { pct, type Grades } from './ratings';

	let {
		grades,
		priorScore,
		onnext
	}: { grades: Grades; priorScore: number | null; onnext: () => void } = $props();

	const still = $derived(prefersReducedMotion.current);
	const delta = $derived(
		grades.score === null || priorScore === null
			? null
			: Math.round(grades.score * 100) - Math.round(priorScore * 100)
	);
	const areas = $derived([...grades.areas].sort((a, b) => a.score - b.score));
	const barColor = (s: number) => (s < 0.6 ? 'bg-again' : s < 0.85 ? 'bg-hard' : 'bg-good');
</script>

<section class="flex flex-col gap-6" in:fade={{ duration: still ? 0 : 200 }}>
	<div class="panel p-6 text-center sm:p-10" in:fly={{ y: still ? 0 : 16, duration: 400 }}>
		<p class="eyebrow">Round score</p>
		<p class="mt-2 font-mono text-6xl font-bold tracking-tight sm:text-7xl">{pct(grades.score)}</p>
		{#if delta !== null}
			<p
				class="mt-3 font-mono text-sm {delta > 0
					? 'text-good'
					: delta < 0
						? 'text-again'
						: 'text-muted'}"
			>
				{delta > 0 ? '▲' : delta < 0 ? '▼' : '='}
				{Math.abs(delta)} pts vs last round ({pct(priorScore)})
			</p>
		{/if}
	</div>

	{#if areas.length}
		<div
			class="panel p-5 sm:p-6"
			in:fly={{ y: still ? 0 : 16, duration: 400, delay: still ? 0 : 80 }}
		>
			<p class="eyebrow">By area, weakest first</p>
			<ul class="mt-4 flex flex-col gap-3">
				{#each areas as a (a.tag)}
					<li>
						<div class="flex items-baseline justify-between gap-3 text-sm">
							<span class="truncate font-medium">{a.tag}</span>
							<span class="shrink-0 font-mono text-xs text-muted">
								{a.cards} card{a.cards === 1 ? '' : 's'}
								{#if a.again}· <span class="text-again">{a.again} again</span>{/if}
								· <span class="text-fg">{pct(a.score)}</span>
							</span>
						</div>
						<div class="mt-1.5 h-2 overflow-hidden rounded-full bg-surface-2">
							<div
								class="h-full rounded-full {barColor(a.score)}"
								style="width: {Math.max(a.score * 100, 2)}%"
							></div>
						</div>
					</li>
				{/each}
			</ul>
		</div>
	{/if}

	{#if grades.weak.length || grades.strong.length}
		<div
			class="grid gap-4 sm:grid-cols-2"
			in:fly={{ y: still ? 0 : 16, duration: 400, delay: still ? 0 : 160 }}
		>
			{#if grades.weak.length}
				<div class="panel p-5">
					<p class="eyebrow">Weak</p>
					<div class="mt-3 flex flex-wrap gap-1.5">
						{#each grades.weak as tag (tag)}
							<span class="chip border-again/30 bg-again/10 text-again">{tag}</span>
						{/each}
					</div>
				</div>
			{/if}
			{#if grades.strong.length}
				<div class="panel p-5">
					<p class="eyebrow">Strong</p>
					<div class="mt-3 flex flex-wrap gap-1.5">
						{#each grades.strong as tag (tag)}
							<span class="chip border-good/30 bg-good/10 text-good">{tag}</span>
						{/each}
					</div>
				</div>
			{/if}
		</div>
	{/if}

	<div class="flex flex-col gap-3 sm:flex-row">
		<button class="btn btn-primary py-3 sm:flex-1" onclick={onnext}>Next round</button>
		<a href={resolve('/cards')} class="btn py-3 sm:flex-1">Back to decks</a>
	</div>
</section>
