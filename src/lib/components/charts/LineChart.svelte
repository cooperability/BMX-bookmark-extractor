<script lang="ts">
	// y is a 0..1 score, points oldest first, evenly spaced. Line follows currentColor.
	let {
		points,
		label,
		height = 180
	}: { points: { label: string; y: number }[]; label: string; height?: number } = $props();

	const W = 560;
	const L = 40;
	const R = 14;
	const T = 12;
	const B = 22;
	const GRID = [0, 0.5, 1];
	const x = (i: number) =>
		points.length === 1 ? (L + W - R) / 2 : L + (i * (W - L - R)) / (points.length - 1);
	const y = (v: number) => T + (1 - v) * (height - T - B);
	// Thin the x labels so they never collide.
	const every = $derived(Math.max(1, Math.ceil(points.length / 8)));
</script>

<svg viewBox="0 0 {W} {height}" class="h-auto w-full" role="img" aria-label={label}>
	<title>{label}</title>
	{#each GRID as g (g)}
		<line x1={L} x2={W - R} y1={y(g)} y2={y(g)} class="stroke-line" stroke-dasharray="3 4" />
		<text x={L - 8} y={y(g) + 3} text-anchor="end" class="fill-muted font-mono text-[10px]"
			>{g * 100}%</text
		>
	{/each}
	{#if points.length > 1}
		<polyline
			points={points.map((p, i) => `${x(i)},${y(p.y)}`).join(' ')}
			fill="none"
			stroke="currentColor"
			stroke-width="2.5"
			stroke-linejoin="round"
			stroke-linecap="round"
		/>
	{/if}
	{#each points as p, i (i)}
		<circle cx={x(i)} cy={y(p.y)} r="4" fill="currentColor" class="stroke-surface" stroke-width="2">
			<title>{p.label}: {Math.round(p.y * 100)}%</title>
		</circle>
		{#if i % every === 0 || i === points.length - 1}
			<text x={x(i)} y={height - 6} text-anchor="middle" class="fill-muted font-mono text-[10px]"
				>{p.label}</text
			>
		{/if}
	{/each}
</svg>
