<script lang="ts">
	import type { Snippet } from 'svelte';
	import { resolve } from '$app/paths';

	let {
		deck,
		class: klass = 'btn btn-primary',
		children
	}: { deck: string; class?: string; children?: Snippet } = $props();
</script>

<!-- Preload stays off: loading the study page opens a round and writes a row. -->
<a
	href="{resolve('/cards/study')}?deck={encodeURIComponent(deck)}"
	data-sveltekit-preload-data="false"
	class={klass}
	>{#if children}{@render children()}{:else}Study{/if}</a
>
