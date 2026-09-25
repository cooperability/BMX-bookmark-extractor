<script lang="ts">
	import { fade } from 'svelte/transition';
	import { prefersReducedMotion } from 'svelte/motion';
	import { pct } from './ratings';

	let { prior }: { prior: { score: number | null; weak: string[]; strong: string[] } } = $props();
</script>

<aside
	class="panel bg-surface-2/60 flex flex-col gap-3 px-5 py-4 text-sm"
	in:fade={{ duration: prefersReducedMotion.current ? 0 : 250 }}
>
	<div class="flex items-baseline justify-between gap-4">
		<p class="eyebrow">Last round</p>
		<p class="font-mono text-lg font-semibold">{pct(prior.score)}</p>
	</div>
	{#if prior.weak.length}
		<div class="flex flex-wrap items-center gap-1.5">
			<span class="text-muted mr-1 text-xs">Weak</span>
			{#each prior.weak as tag (tag)}
				<span class="chip border-again/30 bg-again/10 text-again">{tag}</span>
			{/each}
		</div>
	{/if}
	{#if prior.strong.length}
		<div class="flex flex-wrap items-center gap-1.5">
			<span class="text-muted mr-1 text-xs">Strong</span>
			{#each prior.strong as tag (tag)}
				<span class="chip border-good/30 bg-good/10 text-good">{tag}</span>
			{/each}
		</div>
	{/if}
	<p class="text-muted">This round: due cards first, weak areas boosted, topics interleaved.</p>
</aside>
