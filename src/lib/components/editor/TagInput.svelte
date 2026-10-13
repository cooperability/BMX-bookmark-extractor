<script lang="ts">
	import { normalizeTags } from '$lib/cards/edit';

	let {
		id,
		tags = $bindable([]),
		suggestions,
		name = 'tag'
	}: { id: string; tags?: string[]; suggestions: string[]; name?: string } = $props();

	let draft = $state('');

	// Typeahead from the user's own tags: a native datalist, which phones render
	// as keyboard suggestions. Tags already on the card drop out.
	const options = $derived.by(() => {
		const have = new Set(tags.map((t) => t.toLowerCase()));
		const q = draft.trim().toLowerCase();
		return suggestions
			.filter((s) => !have.has(s.toLowerCase()) && (!q || s.toLowerCase().includes(q)))
			.slice(0, 50);
	});

	function commit() {
		if (draft.trim()) tags = normalizeTags([...tags, draft]);
		draft = '';
	}

	// Space and Enter commit, as in Anki's tag editor. Tab moves on, and blur
	// commits. Backspace in an empty box takes the last chip back for editing.
	function onkeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' || e.key === ' ') {
			if (!draft.trim()) return;
			e.preventDefault();
			commit();
		} else if (e.key === 'Backspace' && !draft && tags.length) {
			e.preventDefault();
			draft = tags.at(-1)!;
			tags = tags.slice(0, -1);
		}
	}

	// A datalist pick fires input with the whole tag, and no key to commit it.
	function oninput(e: Event & { currentTarget: HTMLInputElement }) {
		// Chrome fires a plain Event, with no inputType, for a datalist pick.
		const type = e instanceof InputEvent ? e.inputType : '';
		if (type === 'insertReplacementText' || !type) {
			if (suggestions.includes(e.currentTarget.value)) commit();
		} else if (/\s/.test(draft)) commit();
	}
</script>

<div
	class="input flex min-h-11 flex-wrap items-center gap-1.5 px-2 py-1.5 focus-within:border-[var(--accent)]"
>
	{#each tags as tag (tag)}
		<span class="chip text-fg gap-0.5 py-0 pr-0.5">
			{tag}
			<button
				type="button"
				class="hover:text-again inline-flex size-7 items-center justify-center rounded-full lg:size-5"
				aria-label="Remove tag {tag}"
				onclick={() => (tags = tags.filter((t) => t !== tag))}>×</button
			>
			<input type="hidden" {name} value={tag} />
		</span>
	{/each}
	<input
		{id}
		class="min-w-24 flex-1 border-0 bg-transparent p-1 text-sm focus:ring-0"
		list="{id}-list"
		placeholder={tags.length ? '' : 'Add tags, space to separate'}
		autocomplete="off"
		autocapitalize="off"
		spellcheck="false"
		enterkeyhint="done"
		bind:value={draft}
		{onkeydown}
		{oninput}
		onblur={commit}
	/>
	<datalist id="{id}-list">
		{#each options as s (s)}<option value={s}></option>{/each}
	</datalist>
</div>
