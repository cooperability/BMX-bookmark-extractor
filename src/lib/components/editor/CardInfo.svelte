<script lang="ts">
	import { enhance, type SubmitFunction } from '$app/forms';
	import type { EditorCard } from '$lib/server/cards/edit';

	let { card, error, forget }: { card: EditorCard; error: string | null; forget: SubmitFunction } =
		$props();

	const day = (d: Date | null) =>
		d ? new Date(d).toLocaleString('en', { dateStyle: 'medium', timeStyle: 'short' }) : '–';
	const facts = $derived([
		['Added', day(card.createdAt)],
		['Edited', card.updatedAt ? day(card.updatedAt) : 'never'],
		['State', card.suspended ? `${card.state}, suspended` : card.state],
		['Due', card.scheduled ? day(card.due) : 'new'],
		['Stability', card.scheduled ? `${card.stability?.toFixed(1)}d` : '–'],
		['Difficulty', card.scheduled ? (card.difficulty?.toFixed(1) ?? '–') : '–'],
		['Reviews', String(card.reps ?? 0)],
		['Lapses', String(card.lapses ?? 0)],
		['Last review', day(card.lastReview)],
		['Note type', card.notetype]
	]);
	const RATING: Record<number, [string, string]> = {
		1: ['Again', 'text-again'],
		2: ['Hard', 'text-hard'],
		3: ['Good', 'text-good'],
		4: ['Easy', 'text-easy']
	};
</script>

<div class="flex-1 space-y-5 px-4 py-4 text-sm">
	{#if error}<p class="text-again text-sm" role="alert">{error}</p>{/if}
	<dl class="grid grid-cols-2 gap-x-6 gap-y-3 font-mono text-xs sm:grid-cols-3">
		{#each facts as [k, v] (k)}
			<div>
				<dt class="eyebrow text-[10px]">{k}</dt>
				<dd class="mt-0.5 break-words">{v}</dd>
			</div>
		{/each}
	</dl>
	<div>
		<h3 class="eyebrow">Review history</h3>
		{#if card.log.length}
			<ol class="mt-2 divide-y divide-[var(--line)]">
				{#each card.log as l, i (i)}
					<li class="flex items-center justify-between gap-3 py-1.5 font-mono text-xs">
						<span class="text-muted">{day(l.reviewedAt)}</span>
						<span class="text-muted">{l.surface}</span>
						<span class="w-12 text-right {RATING[l.rating]?.[1] ?? ''}">
							{RATING[l.rating]?.[0] ?? l.rating}
						</span>
					</li>
				{/each}
			</ol>
		{:else}
			<p class="text-muted mt-2">Never reviewed.</p>
		{/if}
	</div>
	<form method="POST" action="?/bulk" class="border-line border-t pt-4" use:enhance={forget}>
		<input type="hidden" name="op" value="forget" />
		<input type="hidden" name="id" value={card.id} />
		<button class="btn min-h-11 lg:min-h-0" disabled={!card.scheduled}>Forget: make it new</button>
		<p class="text-muted mt-1 text-xs">Review history stays. Only the schedule resets.</p>
	</form>
</div>
