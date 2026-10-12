<script lang="ts">
	import { onMount } from 'svelte';
	import { sanitizeCardHtml } from '$lib/cards/sanitize';

	let {
		id,
		label,
		name,
		value = $bindable(''),
		invalid = false,
		describedby
	}: {
		id: string;
		label: string;
		name: string;
		value?: string;
		invalid?: boolean;
		describedby?: string;
	} = $props();

	let el = $state<HTMLDivElement>();
	let source = $state(false);
	let active = $state<Record<string, boolean>>({});

	// Typing writes innerHTML into value, so they only differ when value was set
	// from outside (a revert, the source view): then the DOM follows.
	$effect(() => {
		// Svelte renders nothing inside the field, so the DOM here is ours to set.
		// eslint-disable-next-line svelte/no-dom-manipulating
		if (el && !source && el.innerHTML !== value) el.innerHTML = value;
	});

	onMount(() => {
		// Tags, not inline styles: the sanitizer drops style attributes, and with them the formatting.
		document.execCommand('styleWithCSS', false, 'false');
		const track = () => {
			if (!el || !el.contains(document.getSelection()?.anchorNode ?? null)) return;
			active = Object.fromEntries(STATEFUL.map((c) => [c, document.queryCommandState(c)] as const));
		};
		document.addEventListener('selectionchange', track);
		return () => document.removeEventListener('selectionchange', track);
	});

	const STATEFUL = [
		'bold',
		'italic',
		'underline',
		'superscript',
		'subscript',
		'insertUnorderedList',
		'insertOrderedList'
	];

	const escapeHtml = (s: string) =>
		s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

	function sync() {
		if (el) value = el.innerHTML;
	}

	function run(cmd: string, arg?: string) {
		el?.focus();
		document.execCommand(cmd, false, arg);
		sync();
	}

	function code() {
		const sel = document.getSelection();
		const text = sel && el?.contains(sel.anchorNode) ? sel.toString() : '';
		if (text) run('insertHTML', `<code>${escapeHtml(text)}</code>`);
	}

	function link() {
		const url = prompt('Link to (https:// or mailto:)', 'https://');
		// The sanitizer keeps these schemes only, so anything else would save as plain text.
		if (url && /^(https?:|mailto:)/i.test(url.trim())) run('createLink', url.trim());
	}

	function toggleSource() {
		if (source) value = sanitizeCardHtml(value);
		source = !source;
	}

	// Pasted HTML goes through the same sanitizer as a save, so the field never
	// holds markup the card cannot.
	function onpaste(e: ClipboardEvent) {
		const html = e.clipboardData?.getData('text/html');
		const text = e.clipboardData?.getData('text/plain') ?? '';
		e.preventDefault();
		if (html) run('insertHTML', sanitizeCardHtml(html));
		else run('insertText', text);
	}

	// Anki's field shortcuts. Ctrl+B, I and U are the browser's own.
	function onkeydown(e: KeyboardEvent) {
		const mod = e.ctrlKey || e.metaKey;
		if (!mod) return;
		const k = e.key.toLowerCase();
		const act =
			e.shiftKey && k === 'x'
				? toggleSource
				: e.shiftKey && (k === '+' || k === '=')
					? () => run('superscript')
					: !e.shiftKey && k === '='
						? () => run('subscript')
						: !e.shiftKey && k === 'k'
							? link
							: null;
		if (!act) return;
		e.preventDefault();
		act();
	}

	type Tool = { label: string; title: string; on: () => void; cmd?: string; cls?: string };
	const TOOLS: Tool[] = [
		{ label: 'B', title: 'Bold (Ctrl+B)', on: () => run('bold'), cmd: 'bold', cls: 'font-bold' },
		{
			label: 'I',
			title: 'Italic (Ctrl+I)',
			on: () => run('italic'),
			cmd: 'italic',
			cls: 'italic'
		},
		{
			label: 'U',
			title: 'Underline (Ctrl+U)',
			on: () => run('underline'),
			cmd: 'underline',
			cls: 'underline'
		},
		{
			label: 'x²',
			title: 'Superscript (Ctrl+Shift+=)',
			on: () => run('superscript'),
			cmd: 'superscript'
		},
		{ label: 'x₂', title: 'Subscript (Ctrl+=)', on: () => run('subscript'), cmd: 'subscript' },
		{ label: '</>', title: 'Inline code', on: code, cls: 'font-mono text-[11px]' },
		{
			label: '•',
			title: 'Bulleted list',
			on: () => run('insertUnorderedList'),
			cmd: 'insertUnorderedList'
		},
		{
			label: '1.',
			title: 'Numbered list',
			on: () => run('insertOrderedList'),
			cmd: 'insertOrderedList'
		},
		{ label: '↗', title: 'Link (Ctrl+K)', on: link },
		{ label: 'T̸', title: 'Clear formatting', on: () => run('removeFormat') }
	];
</script>

<div>
	<div class="flex items-center justify-between gap-2">
		<label for={id} class="eyebrow" id="{id}-label">{label}</label>
		<button
			type="button"
			class="btn btn-ghost text-muted min-h-11 px-2 py-1 text-xs lg:min-h-0"
			aria-pressed={source}
			title="HTML source (Ctrl+Shift+X)"
			onclick={toggleSource}
		>
			{source ? 'Rich text' : 'HTML'}
		</button>
	</div>

	{#if !source}
		<!-- mousedown would move focus off the field and drop its selection before the command runs. -->
		<div class="mt-1 flex flex-wrap gap-1" role="toolbar" aria-label="{label} formatting">
			{#each TOOLS as t (t.title)}
				<button
					type="button"
					class="btn min-h-11 min-w-11 px-2 py-1 text-sm lg:min-h-8 lg:min-w-8 {t.cls ?? ''}"
					class:!bg-accent-soft={t.cmd && active[t.cmd]}
					title={t.title}
					aria-label={t.title}
					aria-pressed={t.cmd ? Boolean(active[t.cmd]) : undefined}
					onmousedown={(e) => e.preventDefault()}
					onclick={t.on}>{t.label}</button
				>
			{/each}
		</div>
		<div
			bind:this={el}
			{id}
			class="field card-html prose prose-sm dark:prose-invert input mt-2 max-w-none px-3 py-2"
			class:!border-again={invalid}
			contenteditable="true"
			role="textbox"
			tabindex="0"
			aria-multiline="true"
			aria-labelledby="{id}-label"
			aria-describedby={describedby}
			aria-invalid={invalid}
			oninput={sync}
			{onpaste}
			{onkeydown}
		></div>
		<input type="hidden" {name} {value} />
	{:else}
		<textarea
			{id}
			{name}
			class="input mt-2 min-h-40 font-mono text-xs"
			spellcheck="false"
			aria-describedby={describedby}
			bind:value
			{onkeydown}></textarea>
	{/if}
</div>

<style>
	.field {
		min-height: 6rem;
		max-height: 50vh;
		overflow-y: auto;
		overflow-wrap: anywhere;
		color: var(--fg);
	}
	.field:focus {
		outline: none;
	}
	.field :global(img) {
		max-width: 100%;
		height: auto;
	}
	.field :global(code::before),
	.field :global(code::after) {
		content: none;
	}
</style>
