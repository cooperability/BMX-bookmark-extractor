// Tracking params dropped on top of utm_* (TDD §6 diagram only names utm_*; these
// are the other common query-string trackers a bookmark corpus carries). Compared
// case-insensitively, so UTM_Source is dropped the same as utm_source.
const TRACKING_PARAMS = new Set(['fbclid', 'gclid', 'mc_cid', 'mc_eid']);

function isTrackingParam(key: string): boolean {
	const lower = key.toLowerCase();
	return lower.startsWith('utm_') || TRACKING_PARAMS.has(lower);
}

// Filters the raw query string segment-by-segment instead of round-tripping through
// URLSearchParams, which re-encodes on serialization even for params it keeps:
// "a=b%20c" becomes "a=b+c", a bare "?flag" gains a trailing "=", "~" becomes "%7E",
// "/" becomes "%2F". Kept segments are returned byte-for-byte from the input.
function stripTrackingParams(search: string): string {
	if (search === '') return '';
	const kept = search
		.slice(1)
		.split('&')
		.filter((segment) => {
			const eq = segment.indexOf('=');
			const rawKey = eq === -1 ? segment : segment.slice(0, eq);
			let key = rawKey;
			try {
				key = decodeURIComponent(rawKey);
			} catch {
				// Malformed percent-encoding in the key: compare the raw bytes.
			}
			return !isTrackingParam(key);
		});
	return kept.length === 0 ? '' : '?' + kept.join('&');
}

/**
 * Canonical form of a bookmarked URL, for dedupe against `harvests.url_normalized`.
 * http/https only; lowercases scheme+host, drops the fragment and any userinfo
 * credentials, strips utm_ and other tracking params (order and byte-encoding of
 * the rest preserved), and removes a trailing slash on non-root paths (TDD §6
 * diagram: "strip utm_* · fragment · trailing /"). Never throws.
 */
export function normalizeUrl(input: string): string | null {
	if (typeof input !== 'string') return null;

	let url: URL;
	try {
		url = new URL(input);
	} catch {
		return null;
	}
	if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;

	url.hash = '';
	url.username = '';
	url.password = '';
	url.search = stripTrackingParams(url.search);

	// Confirmed by testing: assigning an empty pathname makes the URL setter re-add
	// the root "/" on its own, so a "pathname !== '/'" guard here would be dead code.
	if (url.pathname.endsWith('/')) {
		url.pathname = url.pathname.replace(/\/+$/, '');
	}

	return url.toString();
}
