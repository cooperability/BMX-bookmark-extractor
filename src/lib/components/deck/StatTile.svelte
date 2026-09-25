<script lang="ts">
	let {
		label,
		value,
		hint = '',
		accent = false
	}: { label: string; value: string | number; hint?: string; accent?: boolean } = $props();
</script>

<div class="panel p-4 {accent ? 'border-accent' : ''}">
	<p class="eyebrow">{label}</p>
	<p class="mt-2 font-mono text-3xl font-semibold tracking-tight {accent ? 'text-accent' : ''}">
		{value}
	</p>
	{#if hint}<p class="text-muted mt-1 text-xs">{hint}</p>{/if}
</div>
