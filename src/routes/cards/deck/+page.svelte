<script lang="ts">
	import { resolve } from '$app/paths';
	import BarChart from '$lib/components/charts/BarChart.svelte';
	import LineChart from '$lib/components/charts/LineChart.svelte';
	import CardBrowser from '$lib/components/deck/CardBrowser.svelte';
	import StatTile from '$lib/components/deck/StatTile.svelte';
	import StudyLink from '$lib/components/deck/StudyLink.svelte';

	let { data, form } = $props();

	type Row = (typeof data.mastery)[number];
	type Key = 'tag' | 'cards' | 'reviewed' | 'stability' | 'score';

	const pct = (n: number | null) => (n === null ? '–' : `${Math.round(n * 100)}%`);
	// A round's finish time is an instant: show it on the user's calendar. Forecast
	// days are already calendar-day strings in that zone, so they format as UTC.
	const date = (d: Date, month: 'short' | 'numeric' = 'short') =>
		d.toLocaleDateString('en', { month, day: 'numeric', timeZone: data.timeZone });
	const weekday = (day: string) =>
		new Date(`${day}T00:00:00Z`).toLocaleDateString('en', { weekday: 'narrow', timeZone: 'UTC' });

	const BAND = {
		strong: 'bg-good',
		mid: 'bg-hard',
		weak: 'bg-again'
	} as const;
	const BAND_TEXT = { strong: 'text-good', mid: 'text-hard', weak: 'text-again' } as const;

	let sortKey = $state<Key>('cards');
	let desc = $state(true);
	function sortBy(k: Key) {
		desc = sortKey === k ? !desc : k !== 'tag';
		sortKey = k;
	}
	// Nulls always sink, whichever way the column is sorted.
	const rows = $derived(
		[...data.mastery].sort((a: Row, b: Row) => {
			const x = a[sortKey];
			const y = b[sortKey];
			if (x === null) return y === null ? 0 : 1;
			if (y === null) return -1;
			const c = typeof x === 'string' ? x.localeCompare(y as string) : x - (y as number);
			return desc ? -c : c;
		})
	);
	// Real decks carry ~70 tags; the full table buried the card browser below it.
	const TAG_ROWS = 12;
	let allTags = $state(false);
	const shownRows = $derived(allTags ? rows : rows.slice(0, TAG_ROWS));

	const forecastTotal = $derived(data.forecast.reduce((n, d) => n + d.count, 0));
	const bars = $derived(
		data.forecast.map((d, i) => ({
			label: i === 0 ? 'Today' : weekday(d.day),
			value: d.count,
			title: `${i === 0 ? 'Today, including overdue' : d.day}: ${d.count} due`
		}))
	);
	const scored = $derived(data.history.filter((a) => a.score !== null));
	const newestFirst = $derived([...data.history].reverse());

	const COLUMNS: { key: Key; label: string; num: boolean }[] = [
		{ key: 'tag', label: 'Tag', num: false },
		{ key: 'cards', label: 'Cards', num: true },
		{ key: 'reviewed', label: 'Reviewed', num: true },
		{ key: 'stability', label: 'Stability', num: true },
		{ key: 'score', label: 'Standing', num: true }
	];
</script>

<svelte:head>
	<title>{data.deck} · Remediate</title>
</svelte:head>

<main class="mx-auto max-w-6xl px-4 py-8 sm:py-10">
	<a href={resolve('/cards')} class="text-sm text-muted hover:text-fg">← Decks</a>
	<header class="mt-3 flex flex-wrap items-end justify-between gap-4">
		<div class="min-w-0">
			<p class="eyebrow">Deck</p>
			<h1 class="mt-1 text-3xl font-bold tracking-tight break-words">{data.deck}</h1>
		</div>
		<StudyLink deck={data.deck} class="btn btn-primary px-6" />
	</header>

	<section class="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
		<StatTile label="Cards" value={data.total} />
		<StatTile label="Due now" value={data.due} accent={data.due > 0} />
		<StatTile label="New" value={data.fresh} />
		<StatTile
			label="Last round"
			value={pct(scored.at(-1)?.score ?? null)}
			hint="{data.history.length} rounds"
		/>
	</section>

	<div class="mt-4 grid gap-4 lg:grid-cols-2">
		<section class="panel p-5">
			<div class="flex items-baseline justify-between">
				<h2 class="eyebrow">Due, next 14 days</h2>
				<span class="font-mono text-xs text-muted">{forecastTotal} cards</span>
			</div>
			<div class="mt-4 text-accent">
				<BarChart
					{bars}
					label="Cards coming due per day for the next 14 days, {forecastTotal} in total"
				/>
			</div>
		</section>

		<section class="panel p-5">
			<div class="flex items-baseline justify-between">
				<h2 class="eyebrow">Round score over time</h2>
				<span class="font-mono text-xs text-muted">{scored.length} rounds</span>
			</div>
			{#if scored.length}
				<div class="mt-4 text-accent">
					<LineChart
						points={scored.map((a) => ({ label: date(a.finishedAt, 'numeric'), y: a.score! }))}
						label="Round scores, oldest to newest: {scored.map((a) => pct(a.score)).join(', ')}"
					/>
				</div>
			{:else}
				<p class="mt-10 text-center text-sm text-muted">Finish a round to see a trend.</p>
			{/if}
		</section>
	</div>

	<section class="panel mt-4 overflow-hidden">
		<div class="flex flex-wrap items-baseline justify-between gap-3 p-5 pb-3">
			<h2 class="eyebrow">Tag mastery</h2>
			<div class="flex gap-3 text-xs text-muted">
				<span class="flex items-center gap-1"><i class="size-2 rounded-full bg-good"></i>≥ 85%</span
				>
				<span class="flex items-center gap-1"
					><i class="size-2 rounded-full bg-hard"></i>60–84%</span
				>
				<span class="flex items-center gap-1"
					><i class="size-2 rounded-full bg-again"></i>&lt; 60%</span
				>
			</div>
		</div>
		<div class="overflow-x-auto">
			<table class="w-full text-sm">
				<thead class="border-y border-line bg-surface-2 text-left">
					<tr>
						{#each COLUMNS as c (c.key)}
							<th
								class="px-5 py-2 font-medium {c.num ? 'text-right' : ''}"
								aria-sort={sortKey === c.key ? (desc ? 'descending' : 'ascending') : 'none'}
							>
								<button class="eyebrow text-[10px] hover:text-fg" onclick={() => sortBy(c.key)}>
									{c.label}{sortKey === c.key ? (desc ? ' ↓' : ' ↑') : ''}
								</button>
							</th>
						{/each}
					</tr>
				</thead>
				<tbody>
					{#each shownRows as r (r.tag)}
						<tr class="border-b border-line last:border-0 hover:bg-surface-2">
							<td class="px-5 py-2">
								<span class="flex items-center gap-2">
									<i class="size-2 shrink-0 rounded-full {r.band ? BAND[r.band] : 'bg-line'}"></i>
									{r.tag}
								</span>
							</td>
							<td class="px-5 py-2 text-right font-mono">{r.cards}</td>
							<td class="px-5 py-2 text-right font-mono">{r.reviewed}</td>
							<td class="px-5 py-2 text-right font-mono">
								{r.stability === null ? '–' : `${r.stability.toFixed(1)}d`}
							</td>
							<td
								class="px-5 py-2 text-right font-mono {r.band ? BAND_TEXT[r.band] : 'text-muted'}"
							>
								{pct(r.score)}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
		{#if rows.length > TAG_ROWS}
			<div class="border-t border-line px-5 py-3">
				<button class="btn btn-ghost px-2 py-1 text-muted" onclick={() => (allTags = !allTags)}>
					{allTags ? 'Show fewer' : `Show all ${rows.length} tags`}
				</button>
			</div>
		{/if}
	</section>

	<CardBrowser deck={data.deck} browse={data.browse} />

	<section class="mt-8">
		<h2 class="eyebrow">Round history</h2>
		{#if newestFirst.length}
			<ol class="mt-3 space-y-2">
				{#each newestFirst as a (a.id)}
					<li class="panel flex flex-wrap items-center gap-x-5 gap-y-2 px-5 py-3">
						<span class="w-20 font-mono text-sm text-muted">{date(a.finishedAt)}</span>
						<span class="w-14 font-mono text-lg font-semibold">{pct(a.score)}</span>
						<span class="w-20 font-mono text-xs text-muted">{a.cardCount} cards</span>
						<span class="flex flex-1 flex-wrap gap-1.5">
							{#each a.weak as tag (tag)}
								<span class="chip border-again/40 text-again">{tag}</span>
							{/each}
							{#each a.strong as tag (tag)}
								<span class="chip border-good/40 text-good">{tag}</span>
							{/each}
						</span>
					</li>
				{/each}
			</ol>
		{:else}
			<p class="mt-3 text-sm text-muted">No finished rounds yet.</p>
		{/if}
	</section>

	<!-- Plain form with a required checkbox: works without JavaScript, and one click cannot delete. -->
	<section class="mt-12 border-t border-line pt-6">
		<h2 class="eyebrow text-again">Delete deck</h2>
		<form method="POST" action="?/delete" class="mt-3 flex flex-wrap items-center gap-4">
			<input type="hidden" name="deck" value={data.deck} />
			<label class="flex items-center gap-2 text-sm text-muted">
				<input type="checkbox" name="confirm" value="yes" required />
				Delete {data.total} cards, their review history and {data.history.length} rounds. This cannot
				be undone.
			</label>
			<button class="btn border-again/40 text-again hover:bg-again/10">Delete deck</button>
			{#if form?.message}<p class="text-sm text-again" role="alert">{form.message}</p>{/if}
		</form>
	</section>
</main>
