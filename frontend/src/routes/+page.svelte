<script lang="ts">
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';

	interface ModelStatus {
		loaded: boolean;
		model_name?: string;
		packages?: string[];
		download_time?: string;
	}

	interface SystemStatus {
		database: string;
		disk_space: string;
		memory_usage: string;
	}

	interface HealthData {
		status: string;
		version: string;
		environment: string;
		uptime_seconds: number;
		startup_time: string;
		models: Record<string, ModelStatus>;
		system: SystemStatus;
		domain: string;
	}

	let healthData: HealthData | null = null;
	let loading = true;
	let error: string | null = null;

	async function fetchHealth() {
		try {
			loading = true;
			error = null;
			const response = await fetch('/api/health');
			if (!response.ok) {
				throw new Error(`HTTP ${response.status}: ${response.statusText}`);
			}
			healthData = await response.json();
		} catch (e) {
			error = e instanceof Error ? e.message : 'Unknown error';
			console.error('Failed to fetch health data:', e);
		} finally {
			loading = false;
		}
	}

	onMount(() => {
		if (browser) {
			fetchHealth();
			// Refresh every 30 seconds
			const interval = setInterval(fetchHealth, 30000);
			return () => clearInterval(interval);
		}
	});

	function formatUptime(seconds: number): string {
		const hours = Math.floor(seconds / 3600);
		const minutes = Math.floor((seconds % 3600) / 60);
		const secs = Math.floor(seconds % 60);
		return `${hours}h ${minutes}m ${secs}s`;
	}

	function getStatusColor(status: string): string {
		switch (status) {
			case 'healthy':
				return 'text-green-600';
			case 'degraded':
				return 'text-yellow-600';
			default:
				return 'text-red-600';
		}
	}
</script>

<svelte:head>
	<title>Remediate.app - System Dashboard</title>
</svelte:head>

<div class="min-h-screen bg-gray-50 py-8">
	<div class="mx-auto max-w-6xl px-4">
		<header class="mb-8 text-center">
			<h1 class="mb-2 text-4xl font-bold text-gray-900">Remediate.app</h1>
			<p class="text-gray-600">Knowledge Management & Bookmark Processing System</p>
		</header>

		{#if loading}
			<div class="text-center">
				<div
					class="inline-block h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600"
				></div>
				<p class="mt-2 text-gray-600">Loading system status...</p>
			</div>
		{:else if error}
			<div class="mb-6 rounded-lg border border-red-200 bg-red-50 p-4">
				<h2 class="mb-2 text-lg font-semibold text-red-800">Connection Error</h2>
				<p class="text-red-600">{error}</p>
				<button
					on:click={fetchHealth}
					class="mt-3 rounded bg-red-600 px-4 py-2 text-white transition-colors hover:bg-red-700"
				>
					Retry
				</button>
			</div>
		{:else if healthData}
			<!-- System Status Overview -->
			<div class="mb-8 grid grid-cols-1 gap-6 md:grid-cols-3">
				<div class="rounded-lg bg-white p-6 shadow">
					<h3 class="mb-2 text-lg font-semibold text-gray-900">System Status</h3>
					<div class="flex items-center">
						<div
							class="mr-3 h-3 w-3 rounded-full {healthData.status === 'healthy'
								? 'bg-green-500'
								: healthData.status === 'degraded'
									? 'bg-yellow-500'
									: 'bg-red-500'}"
						></div>
						<span class="text-2xl font-bold {getStatusColor(healthData.status)}">
							{healthData.status.toUpperCase()}
						</span>
					</div>
					<p class="mt-2 text-gray-600">Version: {healthData.version}</p>
					<p class="text-gray-600">Environment: {healthData.environment}</p>
				</div>

				<div class="rounded-lg bg-white p-6 shadow">
					<h3 class="mb-2 text-lg font-semibold text-gray-900">Uptime</h3>
					<p class="text-2xl font-bold text-blue-600">{formatUptime(healthData.uptime_seconds)}</p>
					<p class="mt-2 text-sm text-gray-600">
						Started: {new Date(healthData.startup_time).toLocaleString()}
					</p>
				</div>

				<div class="rounded-lg bg-white p-6 shadow">
					<h3 class="mb-2 text-lg font-semibold text-gray-900">Database</h3>
					<p
						class="text-lg font-semibold {healthData.system.database === 'Connected'
							? 'text-green-600'
							: 'text-red-600'}"
					>
						{healthData.system.database}
					</p>
					<p class="mt-2 text-sm text-gray-600">Neo4j Graph Database</p>
				</div>
			</div>

			<!-- ML Models Status -->
			<div class="mb-8 rounded-lg bg-white shadow">
				<div class="border-b border-gray-200 px-6 py-4">
					<h2 class="text-xl font-semibold text-gray-900">ML Models</h2>
				</div>
				<div class="p-6">
					<div class="grid grid-cols-1 gap-6 md:grid-cols-2">
						{#each Object.entries(healthData.models) as [modelName, modelData] (modelName)}
							<div class="rounded-lg border p-4">
								<div class="mb-2 flex items-center justify-between">
									<h3 class="font-semibold text-gray-900 capitalize">
										{modelName.replace('_', ' ')}
									</h3>
									<div
										class="h-2 w-2 rounded-full {modelData.loaded ? 'bg-green-500' : 'bg-red-500'}"
									></div>
								</div>
								<p class="mb-2 text-sm text-gray-600">
									Status: <span
										class="{modelData.loaded ? 'text-green-600' : 'text-red-600'} font-medium"
									>
										{modelData.loaded ? 'Loaded' : 'Not Available'}
									</span>
								</p>
								{#if modelData.model_name}
									<p class="text-sm text-gray-600">Model: {modelData.model_name}</p>
								{/if}
								{#if modelData.packages}
									<p class="text-sm text-gray-600">Packages: {modelData.packages.join(', ')}</p>
								{/if}
								{#if modelData.download_time}
									<p class="mt-1 text-xs text-gray-500">
										Initialized: {new Date(modelData.download_time).toLocaleString()}
									</p>
								{/if}
							</div>
						{/each}
					</div>
				</div>
			</div>

			<!-- System Resources -->
			<div class="rounded-lg bg-white shadow">
				<div class="border-b border-gray-200 px-6 py-4">
					<h2 class="text-xl font-semibold text-gray-900">System Resources</h2>
				</div>
				<div class="p-6">
					<div class="grid grid-cols-1 gap-6 md:grid-cols-2">
						<div>
							<h3 class="mb-2 font-semibold text-gray-900">Memory Usage</h3>
							<p class="text-lg">{healthData.system.memory_usage}</p>
						</div>
						<div>
							<h3 class="mb-2 font-semibold text-gray-900">Disk Space</h3>
							<p class="text-lg">{healthData.system.disk_space}</p>
						</div>
					</div>
				</div>
			</div>
			<!-- Actions -->
			<div class="mt-8 text-center">
				<button
					on:click={fetchHealth}
					class="mr-4 rounded-lg bg-blue-600 px-6 py-2 text-white transition-colors hover:bg-blue-700"
				>
					Refresh Status
				</button>
				<a
					href="/health"
					class="rounded-lg bg-gray-600 px-6 py-2 text-white transition-colors hover:bg-gray-700"
				>
					Raw Health Data
				</a>
			</div>
		{/if}
	</div>
</div>
