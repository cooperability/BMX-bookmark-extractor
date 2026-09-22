<script lang="ts">
	import { resolve } from '$app/paths';

	let { deck, class: klass = 'btn btn-primary' }: { deck: string; class?: string } = $props();
</script>

<!-- Preload stays off: loading the study page opens a round and writes a row. -->
<a
	href="{resolve('/cards/study')}?deck={encodeURIComponent(deck)}"
	data-sveltekit-preload-data="off"
	class={klass}>Study</a
>
