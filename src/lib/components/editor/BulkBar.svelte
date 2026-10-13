<script lang="ts">
	import { enhance, type SubmitFunction } from '$app/forms';
	import { FLAGS } from '$lib/cards/edit';
	import { STAY } from './forms';
	import TagInput from './TagInput.svelte';

	let {
		ids,
		options,
		onclear,
		onnotice,
		ondeleted
	}: {
		ids: string[];
		options: { decks: string[]; tags: string[] };
		onclear: () => void;
		onnotice: (message: string) => void;
		ondeleted: (d: { trashId: string; count: number }) => void;
	} = $props();

	type Op = 'move' | 'tag' | 'untag' | 'flag' | 'replace' | 'forget' | 'delete';
	let op = $state<Op | null>(null);
	let busy = $state(false);
	let error = $state<string | null>(null);
	let tags = $state<string[]>([]);

	const n = $derived(ids.length);
	const cards = $derived(`${n} card${n === 1 ? '' : 's'}`);

	const OPS: { op: Op; label: string; danger?: boolean }[] = [
		{ op: 'move', label: 'Move' },
		{ op: 'tag', label: 'Add tags' },
		{ op: 'untag', label: 'Remove tags' },
		{ op: 'flag', label: 'Flag' },
		{ op: 'replace', label: 'Find & replace' },
		{ op: 'forget', label: 'Forget' },
		{ op: 'delete', label: 'Delete', danger: true }
	];

	function choose(next: Op) {
		op = op === next ? null : next;
		error = null;
		tags = [];
	}

	const submit: SubmitFunction = () => {
		busy = true;
		error = null;
		return async ({ result, update }) => {
			busy = false;
			if (result.type === 'failure') {
				error = String(result.data?.message ?? 'Could not apply that.');
				return;
			}
			if (result.type !== 'success') return update(STAY);
			const data = result.data ?? {};
			op = null;
			if ('trashId' in data) ondeleted(data as { trashId: string; count: number });
			else onnotice(String(data.message ?? 'Done.'));
			onclear();
			await update(STAY);
		};
	};
</script>

<div
	class="border-line bg-accent-soft/60 border-y px-4 py-3 lg:px-5"
	role="region"
	aria-label="Bulk actions"
>
	<div class="flex flex-wrap items-center gap-2">
		<span class="text-sm font-medium">{cards} selected</span>
		<button
			type="button"
			class="btn btn-ghost text-muted min-h-11 px-2 text-xs lg:min-h-0"
			onclick={onclear}>Clear</button
		>
		<span class="basis-full sm:basis-auto"></span>
		{#each OPS as o (o.op)}
			<button
				type="button"
				class="btn min-h-11 px-3 text-xs lg:min-h-0 {o.danger ? 'border-again/40 text-again' : ''}"
				aria-pressed={op === o.op}
				aria-expanded={op === o.op}
				onclick={() => choose(o.op)}>{o.label}</button
			>
		{/each}
		<form method="POST" action="?/bulk" class="contents" use:enhance={submit}>
			{#each ids as id (id)}<input type="hidden" name="id" value={id} />{/each}
			<button name="op" value="suspend" class="btn min-h-11 px-3 text-xs lg:min-h-0" disabled={busy}
				>Suspend</button
			>
			<button
				name="op"
				value="unsuspend"
				class="btn min-h-11 px-3 text-xs lg:min-h-0"
				disabled={busy}>Unsuspend</button
			>
		</form>
	</div>

	{#if op}
		<form
			method="POST"
			action={op === 'delete' ? '?/delete' : '?/bulk'}
			class="mt-3 grid gap-3 sm:flex sm:flex-wrap sm:items-end"
			use:enhance={submit}
		>
			{#each ids as id (id)}<input type="hidden" name="id" value={id} />{/each}
			<input type="hidden" name="op" value={op} />

			{#if op === 'move'}
				<label class="grid gap-1 sm:min-w-64 sm:flex-1">
					<span class="eyebrow">Move {cards} to deck</span>
					<input
						name="deck"
						class="input min-h-11 text-sm"
						list="bulk-deck-list"
						autocomplete="off"
						required
						maxlength="200"
					/>
					<datalist id="bulk-deck-list">
						{#each options.decks as d (d)}<option value={d}></option>{/each}
					</datalist>
				</label>
			{:else if op === 'tag' || op === 'untag'}
				<div class="grid gap-1 sm:min-w-64 sm:flex-1">
					<label for="bulk-tags" class="eyebrow"
						>{op === 'tag' ? 'Add to' : 'Remove from'} {cards}</label
					>
					<TagInput id="bulk-tags" name="tags" bind:tags suggestions={options.tags} />
				</div>
			{:else if op === 'flag'}
				<fieldset class="flex flex-wrap gap-1.5">
					<legend class="eyebrow mb-1">Flag {cards}</legend>
					{#each [{ value: 0, label: 'None', cls: 'border-line border' }, ...FLAGS] as f (f.value)}
						<button
							name="flag"
							value={f.value}
							class="btn min-h-11 gap-1.5 px-3 text-xs lg:min-h-0"
							disabled={busy}
						>
							<span class="size-3 rounded-full {f.cls}"></span>{f.label}
						</button>
					{/each}
				</fieldset>
			{:else if op === 'replace'}
				<label class="grid gap-1 sm:flex-1">
					<span class="eyebrow">Find</span>
					<input name="find" class="input min-h-11 text-sm" required maxlength="1000" />
				</label>
				<label class="grid gap-1 sm:flex-1">
					<span class="eyebrow">Replace with</span>
					<input name="replace" class="input min-h-11 text-sm" maxlength="1000" />
				</label>
				<label class="grid gap-1">
					<span class="eyebrow">In</span>
					<select name="field" class="input min-h-11 text-sm">
						<option value="both">Front and back</option>
						<option value="front">Front</option>
						<option value="back">Back</option>
					</select>
				</label>
				<label class="flex min-h-11 items-center gap-2 text-sm">
					<input type="checkbox" name="matchCase" /> Match case
				</label>
			{:else if op === 'forget'}
				<p class="text-sm sm:flex-1">
					Reset the schedule of {cards}. They come back as new. Review history stays.
				</p>
			{:else if op === 'delete'}
				<p class="text-sm sm:flex-1">
					Delete {cards} with their schedules and review history. You can undo this for a day.
				</p>
			{/if}

			{#if op !== 'flag'}
				<div class="flex gap-2">
					<button
						class="btn min-h-11 lg:min-h-0 {op === 'delete'
							? 'border-again/40 text-again hover:bg-again/10'
							: 'btn-primary'}"
						disabled={busy}
					>
						{busy ? 'Working…' : op === 'delete' ? `Delete ${cards}` : 'Apply'}
					</button>
					<button
						type="button"
						class="btn btn-ghost min-h-11 lg:min-h-0"
						onclick={() => (op = null)}>Cancel</button
					>
				</div>
			{/if}
		</form>
	{/if}
	{#if error}<p class="text-again mt-2 text-sm" role="alert">{error}</p>{/if}
</div>
