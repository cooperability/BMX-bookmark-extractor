import { json } from '@sveltejs/kit';
import { databaseStatus } from '$lib/server/health';

// 503 when the database is down, so an uptime check sees the outage a page view would hit.
export async function GET() {
	const database = await databaseStatus();
	return json(
		{ status: database === 'ok' ? 'ok' : 'degraded', app: 'remediate', database },
		{ status: database === 'ok' ? 200 : 503, headers: { 'cache-control': 'no-store' } }
	);
}
