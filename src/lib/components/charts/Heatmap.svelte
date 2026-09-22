<script lang="ts">
	// Columns are weeks, rows Monday..Sunday. Null cells are days after today.
	type Cell = { day: string; count: number; level: number } | null;
	let { weeks, label }: { weeks: Cell[][]; label: string } = $props();

	const S = 14;
	const G = 3;
	const LEFT = 28;
	const TOP = 16;
	const OPACITY = [1, 0.3, 0.55, 0.8, 1];
	const ROWS = ['Mon', '', 'Wed', '', 'Fri', '', ''];
	const month = (day: string) =>
		new Date(`${day}T00:00:00Z`).toLocaleString('en', { month: 'short', timeZone: 'UTC' });
	// Label a column when its Monday opens a new month.
	const months = $derived(
		weeks.map((w, i) => {
			const d = w[0]?.day;
			const prev = weeks[i - 1]?.[0]?.day;
			return d && (!prev || month(prev) !== month(d)) ? month(d) : '';
		})
	);
	const width = $derived(LEFT + weeks.length * (S + G));
	const height = TOP + 7 * (S + G);
</script>

<!-- Fixed 1.5x scale: stretching to the container blew the 9px labels up past 25px. -->
<svg
	viewBox="0 0 {width} {height}"
	width={width * 1.5}
	class="h-auto max-w-full"
	role="img"
	aria-label={label}
>
	<title>{label}</title>
	{#each ROWS as r, i (i)}
		{#if r}
			<text x="0" y={TOP + i * (S + G) + S - 3} class="fill-muted font-mono text-[9px]">{r}</text>
		{/if}
	{/each}
	{#each weeks as week, w (w)}
		{#if months[w]}
			<text x={LEFT + w * (S + G)} y="10" class="fill-muted font-mono text-[9px]">{months[w]}</text>
		{/if}
		{#each week as cell, d (d)}
			{#if cell}
				<rect
					x={LEFT + w * (S + G)}
					y={TOP + d * (S + G)}
					width={S}
					height={S}
					rx="3"
					class={cell.level ? 'fill-accent' : 'fill-surface-2'}
					fill-opacity={OPACITY[cell.level]}
				>
					<title>{cell.day}: {cell.count} review{cell.count === 1 ? '' : 's'}</title>
				</rect>
			{/if}
		{/each}
	{/each}
</svg>
