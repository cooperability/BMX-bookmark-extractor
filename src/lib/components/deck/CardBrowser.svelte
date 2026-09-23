<script lang="ts">
	import { resolve } from '$app/paths';
	import type { Browse } from '$lib/server/cards/browse';

	let { deck, browse }: { deck: string; browse: Browse } = $props();

	const p = $derived(browse.params);

	const STATE_CHIP = {
		new: '',
		learning: 'border-hard/40 text-hard',
		review: 'border-good/40 text-good',
		relearning: 'border-again/40 text-again'
	} as const;
	const RATING = [
		null,
		{ label: 'Again', cls: 'text-again' },
		{ label: 'Hard', cls: 'text-hard' },
		{ label: 'Good', cls: 'text-good' },
		{ label: 'Easy', cls: 'text-easy' }
	] as const;

	// Query string for another page with the current filters kept.
	function pageQuery(page: number) {
		const params: [string, string | null][] = [
			['deck', deck],
			['q', p.q || null],
			['tag', p.tag],
			['state', p.state],
			['sort', p.sort === 'due' ? null : p.sort],
			['page', page > 1 ? String(page) : null]
		];
		return params
			.filter(([, v]) => v)
			.map(([k, v]) => `${k}=${encodeURIComponent(v!)}`)
			.join('&');
	}

	let timer: ReturnType<typeof setTimeout> | undefined;
	function submitSoon(form: HTMLFormElement | null, delay = 0) {
		clearTimeout(timer);
		timer = setTimeout(() => form?.requestSubmit(), delay);
	}

	const first = $derived((p.page - 1) * browse.pageSize + 1);
	const last = $derived(first + browse.cards.length - 1);
	const filtered = $derived(Boolean(p.q || p.tag || p.state));
</script>

<section class="panel mt-4 overflow-hidden" id="cards">
	<div class="flex flex-wrap items-baseline justify-between gap-3 p-5 pb-3">
		<h2 class="eyebrow">Cards</h2>
		<span class="font-mono text-xs text-muted">
			{browse.total ? `${first}–${last} of ${browse.total}` : filtered ? 'No matches' : 'No cards'}
		</span>
	</div>

	<form
		method="GET"
		action={resolve('/cards/deck')}
		data-sveltekit-keepfocus
		data-sveltekit-noscroll
		class="grid gap-2 px-5 pb-4 sm:grid-cols-[1fr_auto_auto_auto]"
	>
		<input type="hidden" name="deck" value={deck} />
		<label class="sr-only" for="browse-q">Search cards</label>
		<input
			id="browse-q"
			class="input text-sm"
			type="search"
			name="q"
			value={p.q}
			placeholder="Search front and back"
			maxlength="200"
			oninput={(e) => submitSoon(e.currentTarget.form, 350)}
		/>
		<label class="sr-only" for="browse-tag">Tag</label>
		<select
			id="browse-tag"
			class="input text-sm sm:w-40"
			name="tag"
			onchange={(e) => submitSoon(e.currentTarget.form)}
		>
			<option value="" selected={!p.tag}>All tags</option>
			{#each browse.tags as tag (tag)}
				<option value={tag} selected={p.tag === tag}>{tag}</option>
			{/each}
		</select>
		<label class="sr-only" for="browse-state">State</label>
		<select
			id="browse-state"
			class="input text-sm sm:w-36"
			name="state"
			onchange={(e) => submitSoon(e.currentTarget.form)}
		>
			<option value="" selected={!p.state}>Any state</option>
			{#each ['new', 'learning', 'review', 'relearning'] as s (s)}
				<option value={s} selected={p.state === s}>{s}</option>
			{/each}
		</select>
		<label class="sr-only" for="browse-sort">Sort</label>
		<select
			id="browse-sort"
			class="input text-sm sm:w-40"
			name="sort"
			onchange={(e) => submitSoon(e.currentTarget.form)}
		>
			<option value="due" selected={p.sort === 'due'}>Due soonest</option>
			<option value="stability" selected={p.sort === 'stability'}>Weakest first</option>
			<option value="lapses" selected={p.sort === 'lapses'}>Most lapses</option>
			<option value="recent" selected={p.sort === 'recent'}>Recently reviewed</option>
		</select>
		<noscript><button class="btn">Apply</button></noscript>
	</form>

	{#if browse.cards.length}
		<div
			class="hidden grid-cols-[1fr_6rem_6rem_5rem_4rem] gap-4 border-y border-line bg-surface-2 px-5 py-2 sm:grid"
		>
			<span class="eyebrow text-[10px]">Front</span>
			<span class="eyebrow text-[10px]">State</span>
			<span class="eyebrow text-right text-[10px]">Due</span>
			<span class="eyebrow text-right text-[10px]">Stability</span>
			<span class="eyebrow text-right text-[10px]">Lapses</span>
		</div>
		<ul>
			{#each browse.cards as c (c.id)}
				<li class="border-b border-line last:border-0">
					<details class="group">
						<summary
							class="grid cursor-pointer list-none grid-cols-[1fr_auto] gap-x-4 gap-y-2 px-5 py-3 hover:bg-surface-2 sm:grid-cols-[1fr_6rem_6rem_5rem_4rem] sm:items-center [&::-webkit-details-marker]:hidden"
						>
							<div class="col-span-2 min-w-0 sm:col-span-1">
								<p class="text-sm break-words">
									<span class="mr-1 inline-block text-muted transition group-open:rotate-90">›</span
									>{c.front || '(empty front)'}
								</p>
								{#if c.tags.length}
									<p class="mt-1.5 flex flex-wrap gap-1">
										{#each c.tags as tag (tag)}
											<span class="chip py-0 text-[11px]">{tag}</span>
										{/each}
									</p>
								{/if}
							</div>
							<span><span class="chip {STATE_CHIP[c.state]}">{c.state}</span></span>
							<span
								class="text-right font-mono text-xs {c.overdue ? 'text-again' : 'text-muted'}"
								title="Due">{c.due}</span
							>
							<span class="hidden text-right font-mono text-xs sm:inline" title="Stability">
								{c.stability === null ? '–' : `${c.stability.toFixed(1)}d`}
							</span>
							<span
								class="hidden text-right font-mono text-xs sm:inline {c.lapses
									? 'text-again'
									: 'text-muted'}"
								title="Lapses">{c.lapses}</span
							>
						</summary>
						<div class="space-y-3 bg-surface-2 px-5 py-4 text-sm">
							<div>
								<p class="eyebrow text-[10px]">Back</p>
								<p class="mt-1 break-words">{c.back || '(empty back)'}</p>
							</div>
							<dl class="flex flex-wrap gap-x-6 gap-y-2 font-mono text-xs">
								<div>
									<dt class="eyebrow text-[10px]">Stability</dt>
									<dd>{c.stability === null ? '–' : `${c.stability.toFixed(1)}d`}</dd>
								</div>
								<div>
									<dt class="eyebrow text-[10px]">Difficulty</dt>
									<dd>{c.difficulty === null ? '–' : c.difficulty.toFixed(1)}</dd>
								</div>
								<div>
									<dt class="eyebrow text-[10px]">Reviews</dt>
									<dd>{c.reps}</dd>
								</div>
								<div>
									<dt class="eyebrow text-[10px]">Lapses</dt>
									<dd>{c.lapses}</dd>
								</div>
								<div>
									<dt class="eyebrow text-[10px]">Last rating</dt>
									<dd class={RATING[c.lastRating ?? 0]?.cls ?? 'text-muted'}>
										{RATING[c.lastRating ?? 0]?.label ?? '–'}
									</dd>
								</div>
							</dl>
						</div>
					</details>
				</li>
			{/each}
		</ul>
	{:else}
		<p class="border-t border-line px-5 py-10 text-center text-sm text-muted">
			{#if filtered}
				No cards match these filters.
				<a
					class="text-fg underline"
					href="{resolve('/cards/deck')}?deck={encodeURIComponent(deck)}"
					data-sveltekit-noscroll>Clear filters</a
				>
			{:else}
				This deck has no cards.
			{/if}
		</p>
	{/if}

	{#if browse.pages > 1}
		<nav
			class="flex items-center justify-between gap-3 border-t border-line px-5 py-3"
			aria-label="Card pages"
		>
			{#if p.page > 1}
				<a
					class="btn px-3 py-1.5"
					href="{resolve('/cards/deck')}?{pageQuery(p.page - 1)}"
					data-sveltekit-noscroll>← Prev</a
				>
			{:else}
				<span class="btn pointer-events-none px-3 py-1.5 opacity-50" aria-hidden="true">← Prev</span
				>
			{/if}
			<span class="font-mono text-xs text-muted">Page {p.page} of {browse.pages}</span>
			{#if p.page < browse.pages}
				<a
					class="btn px-3 py-1.5"
					href="{resolve('/cards/deck')}?{pageQuery(p.page + 1)}"
					data-sveltekit-noscroll>Next →</a
				>
			{:else}
				<span class="btn pointer-events-none px-3 py-1.5 opacity-50" aria-hidden="true">Next →</span
				>
			{/if}
		</nav>
	{/if}
</section>
