<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { VIEWS } from './views';
</script>

<!-- Phones only: the views sit under the thumb. The top nav carries them from sm up. -->
<nav
	aria-label="Views"
	class="tabbar border-line bg-bg/90 fixed inset-x-0 bottom-0 z-20 border-t pb-[env(safe-area-inset-bottom)] backdrop-blur-md sm:hidden"
>
	<ul class="mx-auto grid h-16 max-w-md grid-cols-3">
		{#each VIEWS as v (v.href)}
			{@const here = v.match(page.url.pathname)}
			<li>
				<a
					href={resolve(v.href)}
					aria-current={here ? 'page' : undefined}
					class="text-muted aria-[current=page]:text-fg flex h-full flex-col items-center justify-center gap-1 text-[11px] font-medium tracking-wide transition-colors"
				>
					<span
						class="grid h-8 w-14 place-items-center rounded-full transition-colors {here
							? 'bg-accent-soft text-accent'
							: ''}"
					>
						<v.icon class="size-5" />
					</span>
					{v.label}
				</a>
			</li>
		{/each}
	</ul>
</nav>

<style>
	/* Its own layer in a page transition, so it holds still while the page crossfades. */
	.tabbar {
		view-transition-name: tabbar;
	}
</style>
