import type { RequestEvent } from '@sveltejs/kit';

export async function GET({ fetch }: RequestEvent) {
	try {
		// Use the backend service name for Docker Compose service discovery
		const backendUrl =
			process.env.NODE_ENV === 'production'
				? 'https://api.remediate.app/health'
				: 'http://backend:8000/health';

		const response = await fetch(backendUrl);

		if (!response.ok) {
			throw new Error(`Backend health check failed: ${response.status} ${response.statusText}`);
		}

		const healthData = await response.json();

		return new Response(JSON.stringify(healthData), {
			status: 200,
			headers: {
				'Content-Type': 'application/json'
			}
		});
	} catch (error) {
		console.error('Health check error:', error);
		return new Response(
			JSON.stringify({
				error: 'Failed to fetch backend health',
				message: error instanceof Error ? error.message : 'Unknown error'
			}),
			{
				status: 500,
				headers: {
					'Content-Type': 'application/json'
				}
			}
		);
	}
}
