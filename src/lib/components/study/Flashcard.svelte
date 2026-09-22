<script lang="ts">
	type Card = { front: string; back: string; tags: string[] };

	let { card, flipped }: { card: Card; flipped: boolean } = $props();
</script>

<!-- Card HTML is DOMPurify-sanitized at import (ingest/sanitize.ts) before it is stored. -->
<div class="scene">
	<div class="flip" class:flipped>
		<section
			class="face panel flex flex-col justify-center p-6 sm:p-10"
			aria-hidden={flipped}
			inert={flipped}
		>
			<p class="eyebrow">Question</p>
			<div class="mt-4 max-h-[60vh] overflow-y-auto">
				<!-- eslint-disable-next-line svelte/no-at-html-tags -->
				<div class="card-html prose max-w-none text-lg dark:prose-invert">{@html card.front}</div>
			</div>
			{#if card.tags.length}
				<div class="mt-6 flex flex-wrap gap-1.5">
					{#each card.tags as tag (tag)}<span class="chip">{tag}</span>{/each}
				</div>
			{/if}
		</section>

		<section
			class="face back panel flex flex-col p-6 sm:p-10"
			aria-hidden={!flipped}
			inert={!flipped}
		>
			<div class="max-h-32 overflow-y-auto border-b border-line pb-4 text-sm text-muted">
				<!-- eslint-disable-next-line svelte/no-at-html-tags -->
				<div class="card-html prose prose-sm max-w-none dark:prose-invert">{@html card.front}</div>
			</div>
			<p class="mt-4 eyebrow">Answer</p>
			<div class="mt-3 max-h-[min(60vh,40rem)] overflow-y-auto overscroll-contain pr-1">
				<!-- eslint-disable-next-line svelte/no-at-html-tags -->
				<div class="card-html prose max-w-none dark:prose-invert">{@html card.back}</div>
			</div>
			{#if card.tags.length}
				<div class="mt-6 flex flex-wrap gap-1.5">
					{#each card.tags as tag (tag)}<span class="chip">{tag}</span>{/each}
				</div>
			{/if}
		</section>
	</div>
</div>

<style>
	.scene {
		perspective: 1800px;
	}
	/* Both faces share one grid cell, so the card is as tall as its taller face. */
	.flip {
		display: grid;
		transform-style: preserve-3d;
		transition: transform 0.55s cubic-bezier(0.2, 0.8, 0.2, 1);
	}
	.flip.flipped {
		transform: rotateY(180deg);
	}
	.face {
		grid-area: 1 / 1;
		backface-visibility: hidden;
		-webkit-backface-visibility: hidden;
		min-height: 18rem;
	}
	.back {
		transform: rotateY(180deg);
	}
	/* Imported Anki HTML carries inline colors and wide media. */
	.card-html :global(img),
	.card-html :global(video) {
		max-width: 100%;
		height: auto;
	}
	.card-html :global(pre),
	.card-html :global(table) {
		display: block;
		overflow-x: auto;
	}
	.card-html {
		color: var(--fg);
		overflow-wrap: anywhere;
	}
</style>
