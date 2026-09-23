<script lang="ts">
	import { resolve } from '$app/paths';
	import Logo from '$lib/components/brand/Logo.svelte';

	let { data } = $props();

	let flipped = $state(false);
	let hovering = $state(false);

	$effect(() => {
		if (hovering) return;
		const id = setInterval(() => (flipped = !flipped), 3200);
		return () => clearInterval(id);
	});

	// Sample per-tag grading artifact for the strip visual: share of cards answered well.
	const tags = [
		{ tag: 'sql', score: 0.9 },
		{ tag: 'regex', score: 0.35 },
		{ tag: 'git', score: 0.7 },
		{ tag: 'dns', score: 0.25 }
	];
</script>

<svelte:head>
	<title>Remediate</title>
	<meta
		name="description"
		content="Remediate turns your Anki decks into spaced repetition rounds that aim at your weak areas."
	/>
</svelte:head>

<div class="backdrop relative min-h-dvh overflow-hidden">
	<header class="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
		<a href={resolve('/')} aria-label="Remediate home"><Logo /></a>
		{#if data.user}
			<a href={resolve('/cards')} class="btn btn-ghost">Open decks</a>
		{:else}
			<a href={resolve('/login')} class="btn btn-ghost">Log in</a>
		{/if}
	</header>

	<main class="mx-auto max-w-6xl px-4 pb-24">
		<section class="grid items-center gap-12 pt-10 sm:pt-16 lg:grid-cols-[1.15fr_1fr]">
			<div>
				<p class="eyebrow">re·me·di·ate &nbsp;/ to fix a gap /</p>
				<h1 class="mt-4 text-5xl leading-[0.95] font-bold tracking-tight text-balance sm:text-7xl">
					Remediate<span class="text-accent">.</span>
				</h1>
				<p class="mt-6 max-w-xl text-lg text-muted sm:text-xl">
					Find what you do not know, then fix it. Your Anki decks become spaced repetition rounds
					that grade themselves by tag and aim the next round at your weak spots.
				</p>
				<div class="mt-8 flex flex-wrap items-center gap-3">
					{#if data.user}
						<a href={resolve('/cards')} class="btn btn-primary px-6 py-3 text-base">Open decks</a>
					{:else}
						<a href={resolve('/login')} class="btn btn-primary px-6 py-3 text-base">Log in</a>
					{/if}
					<span class="font-mono text-xs text-muted">Invite only. Passwordless email code.</span>
				</div>
			</div>

			<!-- Demo card: flips on a timer, and holds the answer on hover. -->
			<div
				class="card-scene mx-auto w-full max-w-sm"
				role="img"
				aria-label="Sample flashcard. Question: Which git command replays commits onto a new base? Answer: git rebase."
				onmouseenter={() => ((hovering = true), (flipped = true))}
				onmouseleave={() => (hovering = false)}
			>
				<div class="card-inner" class:flipped>
					<div class="card-face panel p-6">
						<div class="flex items-center justify-between">
							<span class="chip">git</span>
							<span class="eyebrow">Question</span>
						</div>
						<p class="mt-10 text-2xl leading-snug font-semibold">
							Which command replays your commits onto a new base?
						</p>
						<p class="mt-auto flex items-center gap-2 pt-8 text-xs text-muted">
							Recall it, then flip
						</p>
					</div>
					<div class="card-face card-back panel p-6">
						<div class="flex items-center justify-between">
							<span class="chip">git</span>
							<span class="eyebrow">Answer</span>
						</div>
						<p class="mt-10 font-mono text-3xl font-semibold text-accent">git rebase</p>
						<div class="mt-auto grid grid-cols-4 gap-1.5 pt-8 text-center text-xs font-medium">
							<span class="rounded-lg bg-again/15 py-1.5 text-again">Again</span>
							<span class="rounded-lg bg-hard/15 py-1.5 text-hard">Hard</span>
							<span class="rounded-lg bg-good/15 py-1.5 text-good">Good</span>
							<span class="rounded-lg bg-easy/15 py-1.5 text-easy">Easy</span>
						</div>
					</div>
				</div>
			</div>
		</section>

		<section class="mt-24" aria-labelledby="round-heading">
			<p class="eyebrow">How a round works</p>
			<h2 id="round-heading" class="mt-2 text-3xl font-bold tracking-tight">
				Every round sets up the next one.
			</h2>
			<ol class="mt-8 grid gap-4 md:grid-cols-3">
				<li class="panel flex flex-col p-5">
					<span class="font-mono text-xs text-accent">01</span>
					<h3 class="mt-2 text-lg font-semibold">Study</h3>
					<p class="mt-1 text-sm text-muted">
						Pick a deck. FSRS puts due cards first, then spreads new cards across tags and
						interleaves them.
					</p>
					<div class="mt-auto flex gap-1.5 pt-6" aria-hidden="true">
						{#each ['due', 'due', 'new', 'due', 'new', 'due'] as kind, i (i)}
							<span
								class="h-8 flex-1 rounded-md {kind === 'due'
									? 'bg-accent'
									: 'border border-dashed border-line bg-surface-2'}"
							></span>
						{/each}
					</div>
				</li>
				<li class="panel flex flex-col p-5">
					<span class="font-mono text-xs text-accent">02</span>
					<h3 class="mt-2 text-lg font-semibold">Grade</h3>
					<p class="mt-1 text-sm text-muted">
						Your answers roll up into a grading artifact: each tag marked strong or weak.
					</p>
					<div class="mt-auto space-y-1.5 pt-6" aria-hidden="true">
						{#each tags as t (t.tag)}
							<div class="flex items-center gap-2">
								<span class="w-10 font-mono text-[11px] text-muted">{t.tag}</span>
								<span class="h-2 flex-1 overflow-hidden rounded-full bg-surface-2">
									<span
										class="block h-full rounded-full {t.score >= 0.5 ? 'bg-good' : 'bg-again'}"
										style="width: {t.score * 100}%"
									></span>
								</span>
							</div>
						{/each}
					</div>
				</li>
				<li class="panel flex flex-col p-5">
					<span class="font-mono text-xs text-accent">03</span>
					<h3 class="mt-2 text-lg font-semibold">Next round targets weak areas</h3>
					<p class="mt-1 text-sm text-muted">
						Weak tags get boosted. Strong tags get a few probes to confirm they stay strong.
					</p>
					<div class="mt-auto flex h-14 items-end gap-1.5 pt-6" aria-hidden="true">
						{#each tags as t (t.tag)}
							<span
								class="flex-1 rounded-md {t.score >= 0.5 ? 'bg-surface-2' : 'bg-accent'}"
								style="height: {Math.round((1.15 - t.score) * 100)}%"
							></span>
						{/each}
					</div>
				</li>
			</ol>
		</section>

		<section class="mt-16" aria-labelledby="coming-heading">
			<h2 id="coming-heading" class="eyebrow">Coming, not built yet</h2>
			<div class="mt-4 grid gap-4 sm:grid-cols-2">
				<div class="panel border-dashed p-5">
					<div class="flex items-center gap-2">
						<h3 class="font-semibold">Quest</h3>
						<span class="chip">coming</span>
					</div>
					<p class="mt-1 text-sm text-muted">A second surface on the same knowledge graph.</p>
				</div>
				<div class="panel border-dashed p-5">
					<div class="flex items-center gap-2">
						<h3 class="font-semibold">BMX harvest</h3>
						<span class="chip">coming</span>
					</div>
					<p class="mt-1 text-sm text-muted">Bookmarks pulled into the graph beside your cards.</p>
				</div>
			</div>
		</section>
	</main>

	<footer
		class="mx-auto flex max-w-6xl items-center justify-between border-t border-line px-4 py-6 text-xs text-muted"
	>
		<Logo size={18} />
		<span class="font-mono">FSRS scheduling</span>
	</footer>
</div>

<style>
	.backdrop {
		background-image:
			radial-gradient(ellipse 60% 50% at 70% 0%, var(--accent-soft), transparent 70%),
			linear-gradient(var(--line) 1px, transparent 1px),
			linear-gradient(90deg, var(--line) 1px, transparent 1px);
		background-size:
			100% 100%,
			48px 48px,
			48px 48px;
		background-position:
			0 0,
			-1px -1px,
			-1px -1px;
	}
	.backdrop::before {
		content: '';
		position: absolute;
		inset: 0;
		pointer-events: none;
		background: linear-gradient(to bottom, transparent, var(--bg) 85%);
		z-index: 0;
	}
	.backdrop::after {
		content: '';
		position: absolute;
		inset: 0;
		pointer-events: none;
		opacity: 0.06;
		background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
	}
	.backdrop > :global(*) {
		position: relative;
		z-index: 1;
	}

	.card-scene {
		perspective: 1200px;
		aspect-ratio: 4 / 3.4;
	}
	.card-inner {
		position: relative;
		height: 100%;
		transform-style: preserve-3d;
		transition: transform 0.7s cubic-bezier(0.2, 0.8, 0.2, 1);
	}
	.card-inner.flipped {
		transform: rotateY(180deg);
	}
	.card-face {
		position: absolute;
		inset: 0;
		display: flex;
		flex-direction: column;
		backface-visibility: hidden;
		box-shadow:
			var(--glow),
			0 24px 60px -30px rgb(0 0 0 / 0.35);
	}
	.card-back {
		transform: rotateY(180deg);
	}
</style>
