import { sha256 } from '@oslojs/crypto/sha2';
import { encodeBase64url } from '@oslojs/encoding';

function digest(input: string): string {
	return encodeBase64url(sha256(new TextEncoder().encode(input))).slice(0, 16);
}

/** URL-safe node id derived from an Anki GUID. Never put the raw GUID in markup or a path. */
export function internalId(guid: string): string {
	return digest(guid);
}

/**
 * Identity for exports with no `#guid column:` preamble, such as the legacy CSV.
 * Weaker than a GUID: editing a card changes the hash, so re-import creates a new
 * node instead of updating one.
 */
export function contentId(deck: string, front: string, back: string): string {
	return digest(`${deck}\u0000${front}\u0000${back}`);
}
