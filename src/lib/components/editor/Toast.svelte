<script lang="ts" module>
	export type Toast = { message: string; trashId?: string; link?: { href: string; label: string } };
</script>

<script lang="ts">
	import { enhance } from '$app/forms';
	import { STAY } from './forms';

	let {
		toast,
		onnotice,
		ondismiss
	}: { toast: Toast; onnotice: (message: string) => void; ondismiss: () => void } = $props();

	let undoing = $state(false);
</script>

<div
	class="panel fixed bottom-[max(1rem,env(safe-area-inset-bottom))] left-1/2 z-40 flex w-[min(28rem,calc(100vw-2rem))] -translate-x-1/2 items-center gap-3 px-4 py-3 text-sm shadow-lg"
	role="status"
>
	<span class="min-w-0 flex-1">{toast.message}</span>
	{#if toast.link}<a href={toast.link.href} class="btn btn-ghost min-h-11 px-3 lg:min-h-0"
			>{toast.link.label}</a
		>{/if}
	{#if toast.trashId}
		<form
			method="POST"
			action="?/undo"
			use:enhance={() => {
				undoing = true;
				return async ({ result, update }) => {
					undoing = false;
					if (result.type === 'success') onnotice(String(result.data?.message ?? 'Restored.'));
					else if (result.type === 'failure') onnotice(String(result.data?.message));
					await update(STAY);
				};
			}}
		>
			<input type="hidden" name="trash" value={toast.trashId} />
			<!-- Disabled in flight: a second click would find the trash spent and report that. -->
			<button class="btn min-h-11 px-3 lg:min-h-0" disabled={undoing}>Undo</button>
		</form>
	{/if}
	<button
		class="text-muted hover:text-fg min-h-11 px-1 lg:min-h-0"
		aria-label="Dismiss"
		onclick={ondismiss}>×</button
	>
</div>
