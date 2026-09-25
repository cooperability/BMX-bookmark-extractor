<script lang="ts">
	let { size = 28, wordmark = true }: { size?: number; wordmark?: boolean } = $props();
</script>

<!-- Three bars, the short middle one topped up by a faint block: a gap, fixed. -->
<span class="inline-flex items-center gap-2 font-semibold tracking-tight text-fg">
	<svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" class="shrink-0">
		<rect width="32" height="32" rx="8" class="fill-accent" />
		<rect x="7" y="9" width="4" height="15" rx="1.5" class="fill-accent-fg" />
		<rect x="14" y="17" width="4" height="7" rx="1.5" class="fill-accent-fg" />
		<rect x="14" y="9" width="4" height="6" rx="1.5" class="fill-accent-fg" opacity="0.45" />
		<rect x="21" y="9" width="4" height="15" rx="1.5" class="fill-accent-fg" />
	</svg>
	{#if wordmark}<span>Remediate</span>{/if}
</span>
