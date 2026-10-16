<script lang="ts">
	import type { MapNode } from '$lib/quest/types';
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import Search from '@lucide/svelte/icons/search';

	let {
		nodes,
		current,
		busy,
		ongo
	}: {
		nodes: MapNode[];
		current: string;
		busy: boolean;
		ongo: (node: MapNode) => void;
	} = $props();

	// Everywhere the map shows, as a list: fast travel for keyboards and screen
	// readers, who cannot tap a dot. Halls first, then concepts by size, then cards.
	const ORDER = { deck: 0, tag: 1, concept: 1, card: 2 } as const;
	const SHOWN = 12;

	let query = $state('');
	const places = $derived(
		nodes
			.filter((n) => !n.ghost && n.id !== current)
			.sort(
				(a, b) =>
					ORDER[a.facet] - ORDER[b.facet] ||
					(b.weight ?? 0) - (a.weight ?? 0) ||
					a.title.localeCompare(b.title)
			)
	);
	const hits = $derived(
		query.trim()
			? places.filter((n) => n.title.toLowerCase().includes(query.trim().toLowerCase()))
			: places
	);
</script>

<details class="panel group">
	<summary class="flex min-h-11 cursor-pointer items-center justify-between px-4 select-none">
		<span class="eyebrow">Travel · {places.length} places</span>
		<ChevronDown class="text-muted size-4 transition-transform group-open:rotate-180" />
	</summary>
	<div class="px-4 pb-4">
		<label class="relative block">
			<span class="sr-only">Find a place</span>
			<Search
				class="text-muted pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2"
			/>
			<input
				class="input min-h-11 pl-10 text-sm"
				type="search"
				placeholder="Find a place"
				bind:value={query}
			/>
		</label>
		<ul class="mt-2 flex flex-col gap-1">
			{#each hits.slice(0, SHOWN) as n (n.id)}
				<li>
					<button
						class="hover:bg-surface-2 flex min-h-11 w-full items-center gap-3 rounded-lg px-2 text-left text-sm disabled:opacity-50"
						disabled={busy || (n.facet === 'card' && !n.open && !n.rematch)}
						onclick={() => ongo(n)}
					>
						<span class="min-w-0 flex-1 truncate">{n.title}</span>
						<span class="text-muted shrink-0 text-xs">
							{n.facet === 'deck'
								? 'Hall'
								: n.facet === 'card'
									? n.open
										? 'Known'
										: n.rematch
											? 'Rematch'
											: 'Sealed'
									: 'Tag'}
						</span>
					</button>
				</li>
			{/each}
		</ul>
		{#if hits.length > SHOWN}
			<p class="text-muted mt-2 text-xs">{hits.length - SHOWN} more: type to narrow.</p>
		{:else if !hits.length}
			<p class="text-muted mt-2 text-sm">Nowhere by that name on your map yet.</p>
		{/if}
	</div>
</details>
