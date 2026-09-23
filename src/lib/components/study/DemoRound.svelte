<script lang="ts">
	import { fly } from 'svelte/transition';
	import { prefersReducedMotion } from 'svelte/motion';
	import Flashcard from './Flashcard.svelte';
	import RatingBar from './RatingBar.svelte';
	import RoundResults from './RoundResults.svelte';
	import { RATINGS, type Grades } from './ratings';
	import { MAX_REPEATS } from '$lib/cards/round';
	import { gradeRound, type GradedCard } from '$lib/cards/grading';

	// The study screen from /cards/study, run in the browser on sample cards. Nothing is saved.
	type Card = { id: string; front: string; back: string; tags: string[] };
	const CARDS: Card[] = [
		{
			id: 'rebase',
			front: 'Which git command replays your commits onto a new base?',
			back: '<code>git rebase</code>',
			tags: ['git']
		},
		{
			id: 'left-join',
			front: 'Which SQL join keeps every row from the left table, matched or not?',
			back: '<code>LEFT JOIN</code>. Unmatched right-side columns come back <code>NULL</code>.',
			tags: ['sql']
		},
		{
			id: 'lazy',
			front: 'What makes a regex quantifier lazy instead of greedy?',
			back: 'A trailing <code>?</code>, as in <code>.*?</code>',
			tags: ['regex']
		},
		{
			id: 'cname',
			front: 'Which DNS record type aliases one name to another?',
			back: '<code>CNAME</code>',
			tags: ['dns']
		},
		{
			id: 'reflog',
			front: 'Where does git keep the commits a bad reset appeared to lose?',
			back: 'In the reflog: <code>git reflog</code>, then reset back to the entry.',
			tags: ['git']
		}
	];

	let queue = $state<{ card: Card; repeats: number }[]>([]);
	let firsts = $state<GradedCard[]>([]);
	let flipped = $state(false);
	let grades = $state<Grades | null>(null);

	function start() {
		queue = CARDS.map((card) => ({ card, repeats: 0 }));
		firsts = [];
		flipped = false;
		grades = null;
	}
	start();

	const current = $derived(queue[0]);
	const done = $derived(firsts.length);
	const still = $derived(prefersReducedMotion.current);

	function rate(rating: number) {
		if (!current || !flipped) return;
		const [head, ...rest] = queue;
		// Only the first attempt counts toward the grade, as on the server.
		if (head.repeats === 0) firsts = [...firsts, { tags: head.card.tags, rating }];
		queue =
			rating === 1 && head.repeats < MAX_REPEATS
				? [...rest, { ...head, repeats: head.repeats + 1 }]
				: rest;
		flipped = false;
		if (queue.length === 0) grades = gradeRound(firsts);
	}

	let group: HTMLDivElement;
	// A clicked button unmounts (Show answer, a rating, Next round), which drops focus
	// to <body> and would leave the shortcuts below with nothing to listen on.
	const keepFocus = () => group.focus({ preventScroll: true });

	// Bound to the demo, not the window: Space must still scroll the landing page.
	function onkeydown(e: KeyboardEvent) {
		if (grades || !current || e.ctrlKey || e.metaKey || e.altKey) return;
		if (e.target instanceof HTMLButtonElement && (e.key === ' ' || e.key === 'Enter')) return;
		if (e.key === ' ' || e.key === 'Enter') {
			e.preventDefault();
			flipped = true;
		}
		const r = RATINGS.find((x) => x.key === e.key);
		if (r) rate(r.value);
	}
</script>

<!-- Focusable so its shortcuts work without claiming keys for the whole page. The buttons stay the primary controls. -->
<!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
<div
	class="flex flex-col gap-4 rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-8 focus-visible:ring-offset-bg"
	tabindex="0"
	role="group"
	aria-label="Demo study round"
	bind:this={group}
	{onkeydown}
>
	<div class="flex items-center gap-3 text-sm">
		<span class="min-w-0 flex-1 truncate font-medium">Sample deck</span>
		{#if current && current.repeats > 0 && !grades}
			<span class="chip border-again/30 bg-again/10 text-again">relearning</span>
		{/if}
		<span class="font-mono text-xs text-muted tabular-nums">{done} / {CARDS.length}</span>
	</div>
	<div
		class="h-1.5 overflow-hidden rounded-full bg-surface-2"
		role="progressbar"
		aria-label="Demo round progress"
		aria-valuemin={0}
		aria-valuemax={CARDS.length}
		aria-valuenow={done}
	>
		<div
			class="h-full rounded-full bg-accent transition-[width] duration-300"
			style="width: {(done / CARDS.length) * 100}%"
		></div>
	</div>

	{#if grades}
		<RoundResults
			{grades}
			priorScore={null}
			onnext={() => {
				start();
				keepFocus();
			}}
		/>
	{:else if current}
		{#key `${current.card.id}:${current.repeats}`}
			<div in:fly={{ x: still ? 0 : 24, duration: still ? 0 : 220 }}>
				<Flashcard card={current.card} {flipped} />
			</div>
		{/key}
		<RatingBar
			{flipped}
			busy={false}
			onflip={() => {
				flipped = true;
				keepFocus();
			}}
			onrate={(r) => {
				rate(r);
				keepFocus();
			}}
		/>
	{/if}
</div>
