<script lang="ts">
	import type { PageData } from './$types';

	export let data: PageData;
</script>

<h1>Backend Health Check</h1>

{#if data.status === 'success' && data.healthData}
	<pre>{JSON.stringify(data.healthData, null, 2)}</pre>
{:else if data.status === 'error'}
	<p style="color: red;">Error loading health data:</p>
	<pre style="color: red;">{data.error}</pre>
{:else}
	<p>Loading health data...</p>
	// Should not happen if load function is correct
{/if}

<style>
	pre {
		background-color: #f0f0f0;
		padding: 1em;
		border-radius: 5px;
	}
</style>
