<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import type { SubmitFunction } from '@sveltejs/kit';
	import Logo from '$lib/components/brand/Logo.svelte';

	let { form } = $props();

	let code = $state('');
	let focused = $state(false);
	let submitting = $state(false);
	let verifyForm = $state<HTMLFormElement>();

	const focusOnMount = (node: HTMLElement) => node.focus();

	function onCodeInput() {
		code = code.replace(/\D/g, '').slice(0, 6);
		if (code.length === 6 && !submitting) verifyForm?.requestSubmit();
	}

	const track: SubmitFunction = () => {
		submitting = true;
		return async ({ result, update }) => {
			await update();
			submitting = false;
			if (result.type === 'failure') code = '';
		};
	};
</script>

<svelte:head>
	<title>Log in · Remediate</title>
</svelte:head>

<main class="grid min-h-dvh place-items-center px-4 py-12">
	<div class="w-full max-w-sm">
		<a href={resolve('/')} class="mx-auto mb-8 flex w-fit" aria-label="Remediate home">
			<Logo size={32} />
		</a>

		<div class="panel p-6 sm:p-8">
			<p class="eyebrow">{form?.sent ? 'Step 2 of 2' : 'Step 1 of 2'}</p>
			<h1 class="mt-2 text-2xl font-bold tracking-tight">
				{form?.sent ? 'Enter your code' : 'Log in'}
			</h1>

			{#if form?.sent}
				<p class="text-muted mt-3 text-sm">
					If <span class="text-fg font-medium">{form.email}</span> is allowed, a 6-digit code is on its
					way. It expires in 10 minutes.
				</p>
				<form
					bind:this={verifyForm}
					method="POST"
					action="?/verify"
					use:enhance={track}
					class="mt-6 space-y-4"
				>
					<input type="hidden" name="email" value={form.email} />
					<div class="relative">
						<div class="grid grid-cols-6 gap-2" aria-hidden="true">
							{#each [0, 1, 2, 3, 4, 5] as i (i)}
								{@const active = focused && i === Math.min(code.length, 5)}
								<span
									class="bg-surface-2 grid aspect-[4/5] place-items-center rounded-xl border font-mono text-2xl font-semibold transition {active
										? 'border-accent ring-accent/40 ring-2'
										: code[i]
											? 'border-fg/30'
											: 'border-line'}"
								>
									{code[i] ?? ''}
								</span>
							{/each}
						</div>
						<input
							use:focusOnMount
							name="code"
							bind:value={code}
							oninput={onCodeInput}
							onfocus={() => (focused = true)}
							onblur={() => (focused = false)}
							inputmode="numeric"
							autocomplete="one-time-code"
							pattern={'[0-9]{6}'}
							maxlength="6"
							required
							aria-label="Login code"
							class="absolute inset-0 h-full w-full cursor-text border-0 bg-transparent text-transparent caret-transparent opacity-0 focus:ring-0"
						/>
					</div>
					<button class="btn btn-primary w-full py-2.5" disabled={submitting}>
						{submitting ? 'Checking…' : 'Verify'}
					</button>
				</form>
				<form method="POST" action="?/send" use:enhance class="mt-3 text-center">
					<input type="hidden" name="email" value={form.email} />
					<button class="text-muted hover:text-fg text-sm underline-offset-4 hover:underline">
						Send a new code
					</button>
				</form>
			{:else}
				<p class="text-muted mt-3 text-sm">No password. We email you a 6-digit code.</p>
				<form method="POST" action="?/send" use:enhance class="mt-6 space-y-4">
					<input
						name="email"
						type="email"
						autocomplete="email"
						required
						placeholder="you@example.com"
						aria-label="Email"
						value={form?.email ?? ''}
						class="input py-2.5"
					/>
					<button class="btn btn-primary w-full py-2.5">Email me a code</button>
				</form>
			{/if}

			{#if form?.message}
				<p
					class="border-again/30 bg-again/10 text-again mt-4 rounded-xl border px-3 py-2 text-sm"
					role="alert"
				>
					{form.message}
				</p>
			{/if}
		</div>
	</div>
</main>
