<script lang="ts">
	// Vertical bars, a value above and a short tick label under each. Fill follows currentColor.
	let {
		bars,
		label,
		height = 160
	}: {
		bars: { label: string; value: number; title?: string }[];
		label: string;
		height?: number;
	} = $props();

	const W = 560;
	const TOP = 18;
	const BOTTOM = 22;
	const max = $derived(Math.max(1, ...bars.map((b) => b.value)));
	const slot = $derived(W / Math.max(1, bars.length));
	const h = (v: number) => ((height - TOP - BOTTOM) * v) / max;
</script>

<svg viewBox="0 0 {W} {height}" class="h-auto w-full" role="img" aria-label={label}>
	<title>{label}</title>
	<line x1="0" x2={W} y1={height - BOTTOM} y2={height - BOTTOM} class="stroke-line" />
	{#each bars as b, i (i)}
		{@const x = i * slot + slot * 0.18}
		{@const bh = h(b.value)}
		<g>
			<title>{b.title ?? `${b.label}: ${b.value}`}</title>
			{#if b.value}
				<rect
					{x}
					y={height - BOTTOM - bh}
					width={slot * 0.64}
					height={bh}
					rx="3"
					fill="currentColor"
				/>
				<text
					x={x + slot * 0.32}
					y={height - BOTTOM - bh - 5}
					text-anchor="middle"
					class="fill-fg font-mono text-[11px]">{b.value}</text
				>
			{/if}
			<text
				x={x + slot * 0.32}
				y={height - 6}
				text-anchor="middle"
				class="fill-muted font-mono text-[10px]">{b.label}</text
			>
		</g>
	{/each}
</svg>
