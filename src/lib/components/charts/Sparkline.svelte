<script lang="ts">
	// Values are 0..1 scores, oldest first. Stroke follows currentColor.
	let {
		values,
		label,
		width = 96,
		height = 28,
		class: klass = ''
	}: {
		values: number[];
		label: string;
		width?: number;
		height?: number;
		class?: string;
	} = $props();

	const pad = 3;
	const points = $derived(
		values.map((v, i) => [
			values.length === 1 ? width / 2 : pad + (i * (width - 2 * pad)) / (values.length - 1),
			pad + (1 - v) * (height - 2 * pad)
		])
	);
	const last = $derived(points.at(-1));
</script>

<svg
	viewBox="0 0 {width} {height}"
	{width}
	{height}
	role="img"
	aria-label={label}
	class="overflow-visible {klass}"
>
	<title>{label}</title>
	<line
		x1={pad}
		x2={width - pad}
		y1={height / 2}
		y2={height / 2}
		class="stroke-line"
		stroke-dasharray="2 3"
	/>
	{#if points.length > 1}
		<polyline
			points={points.map((p) => p.join(',')).join(' ')}
			fill="none"
			stroke="currentColor"
			stroke-width="2"
			stroke-linecap="round"
			stroke-linejoin="round"
		/>
	{/if}
	{#if last}
		<circle cx={last[0]} cy={last[1]} r="2.5" fill="currentColor" />
	{/if}
</svg>
