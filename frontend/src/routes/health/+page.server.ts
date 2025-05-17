import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ fetch }) => {
	try {
		// The 'backend' hostname is available due to Docker Compose service discovery
		const response = await fetch('http://backend:8000/health');
		if (!response.ok) {
			throw new Error(`HTTP error! status: ${response.status}`);
		}
		const healthData = await response.json();
		return {
			status: 'success',
			healthData
		};
	} catch (error) {
		console.error('Failed to fetch health data:', error);
		const errorMessage = error instanceof Error ? error.message : 'Unknown error';
		return {
			status: 'error',
			error: `Failed to fetch health data: ${errorMessage}`
		};
	}
};
